import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetProfileQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetReadinessScoresQueryKey,
  getGetRoadmapQueryKey,
  getGetOpportunityMatchesQueryKey,
} from "@workspace/api-client-react";
import type {
  AmbientCaptureHandlers,
  PepperContextValue,
  PepperMessage,
  PepperStatus,
  PepperVoice,
  TourState,
  TourStop,
} from "./types";

const API_BASE = "/api";
const STORAGE_CONV = "pepper.conversationId";
const STORAGE_VOICE = "pepper.voice";
const STORAGE_MUTED = "pepper.speechMuted";

const PepperContext = createContext<PepperContextValue | null>(null);

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type SSEHandler = (event: Record<string, unknown>) => void;

async function streamSSE(
  url: string,
  body: unknown,
  onEvent: SSEHandler,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  if (!res.body) throw new Error("No response stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        onEvent(JSON.parse(json));
      } catch {
        // ignore malformed chunk
      }
    }
  }
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ??
    (window as any).webkitSpeechRecognition ??
    null
  );
}

export function PepperProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PepperMessage[]>([]);
  const [status, setStatus] = useState<PepperStatus>("idle");
  const [voice, setVoiceState] = useState<PepperVoice>(() => {
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_VOICE)
        : null;
    return stored === "male" ? "male" : "female";
  });
  const [wakeWordEnabled, setWakeWordEnabledState] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [tour, setTour] = useState<TourState | null>(null);
  const [ambient, setAmbient] = useState(false);
  const [speechMuted, setSpeechMutedState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_MUTED) === "1";
    } catch {
      return false;
    }
  });

  const clearAuthRequired = useCallback(() => setAuthRequired(false), []);

  const conversationIdRef = useRef<number | null>(null);
  const conversationPromiseRef = useRef<Promise<number> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const ambientRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const openAmbientRef = useRef<() => void>(() => {});
  const dictationRecorderRef = useRef<MediaRecorder | null>(null);
  const dictationChunksRef = useRef<Blob[]>([]);
  const startListeningRef = useRef<() => Promise<void>>(async () => {});
  const recorder = useVoiceRecorder();
  const queryClient = useQueryClient();

  const wakeWordSupported = getSpeechRecognitionCtor() !== null;
  const busy = status === "thinking" || status === "speaking";

  const setVoice = useCallback((v: PepperVoice) => {
    setVoiceState(v);
    try {
      localStorage.setItem(STORAGE_VOICE, v);
    } catch {
      /* ignore */
    }
  }, []);

  // ===== Ambient "Hey Pep" layer + browser spoken replies =====

  const cancelSpeech = useCallback(() => {
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  }, []);

  const setSpeechMuted = useCallback(
    (muted: boolean) => {
      setSpeechMutedState(muted);
      try {
        localStorage.setItem(STORAGE_MUTED, muted ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (muted) cancelSpeech();
    },
    [cancelSpeech],
  );

  // Speak via the browser Web Speech API. Honors the male/female voice
  // preference when a matching system voice exists, otherwise the default.
  // No-op (but still runs onEnd) when muted or unsupported, so callers can
  // chain the next step regardless.
  const speak = useCallback(
    (text: string, opts?: { onEnd?: () => void }) => {
      const synth =
        typeof window !== "undefined" ? window.speechSynthesis : undefined;
      const trimmed = text.trim();
      if (speechMuted || !synth || !trimmed) {
        opts?.onEnd?.();
        return;
      }
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(trimmed);
      utter.rate = 1;
      utter.pitch = 1;
      try {
        const voices = synth.getVoices();
        if (voices.length) {
          const en = voices.filter((v) => /^en/i.test(v.lang));
          const pool = en.length ? en : voices;
          const wantMale = voice === "male";
          const femaleRe =
            /\b(female|woman|samantha|victoria|karen|moira|tessa|fiona|zira|susan|allison|ava|serena|joanna)\b/i;
          const maleRe =
            /\b(male|man|daniel|alex|fred|tom|james|john|guy|david|mark|oliver)\b/i;
          const match = pool.find((v) =>
            wantMale
              ? maleRe.test(v.name) && !femaleRe.test(v.name)
              : femaleRe.test(v.name),
          );
          if (match) utter.voice = match;
        }
      } catch {
        /* fall back to the default voice */
      }
      if (opts?.onEnd) utter.onend = () => opts.onEnd?.();
      synth.speak(utter);
    },
    [speechMuted, voice],
  );

  const openAmbient = useCallback(() => {
    setAmbient(true);
  }, []);
  // Latest openAmbient for the wake-word effect (avoids a stale closure).
  useEffect(() => {
    openAmbientRef.current = openAmbient;
  }, [openAmbient]);

  const closeAmbient = useCallback(() => {
    setAmbient(false);
    cancelSpeech();
    try {
      ambientRecognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    ambientRecognitionRef.current = null;
  }, [cancelSpeech]);

  // Capture one spoken command for the ambient layer via the browser
  // SpeechRecognition API. Returns a stop function.
  const captureCommand = useCallback((handlers: AmbientCaptureHandlers) => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      handlers.onEnd?.();
      return () => {};
    }
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    let finalText = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (const result of Array.from(event.results) as any[]) {
        const txt = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += txt;
        else interim += txt;
      }
      const live = (finalText + " " + interim).trim();
      if (live) handlers.onInterim?.(live);
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      if (ambientRecognitionRef.current === recognition) {
        ambientRecognitionRef.current = null;
      }
      const t = finalText.trim();
      if (t) handlers.onFinal(t);
      handlers.onEnd?.();
    };
    ambientRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      /* ignore */
    }
    return () => {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const ensureConversation = useCallback(async (): Promise<number> => {
    if (conversationIdRef.current != null) return conversationIdRef.current;
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(STORAGE_CONV)
        : null;
    if (stored) {
      const id = Number(stored);
      if (!Number.isNaN(id)) {
        conversationIdRef.current = id;
        return id;
      }
    }
    // Lock so concurrent callers share one create request instead of racing.
    if (conversationPromiseRef.current) return conversationPromiseRef.current;
    const promise = (async () => {
      const res = await fetch(`${API_BASE}/openai/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Pepper Chat" }),
        credentials: "include",
      });
      const data = (await res.json()) as { id: number };
      conversationIdRef.current = data.id;
      try {
        localStorage.setItem(STORAGE_CONV, String(data.id));
      } catch {
        /* ignore */
      }
      return data.id;
    })();
    conversationPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      conversationPromiseRef.current = null;
    }
  }, []);

  // Load prior messages once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored =
        typeof localStorage !== "undefined"
          ? localStorage.getItem(STORAGE_CONV)
          : null;
      if (!stored) return;
      const id = Number(stored);
      if (Number.isNaN(id)) return;
      conversationIdRef.current = id;
      try {
        const res = await fetch(
          `${API_BASE}/openai/conversations/${id}/messages`,
          { credentials: "include" },
        );
        if (!res.ok) return;
        const rows = (await res.json()) as {
          id: number;
          role: string;
          content: string;
        }[];
        if (cancelled) return;
        setMessages(
          rows
            .filter((r) => r.role === "user" || r.role === "assistant")
            .map((r) => ({
              id: String(r.id),
              role: r.role as "user" | "assistant",
              content: r.content,
            })),
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setStatus((s) => (s === "speaking" ? "idle" : s));
  }, []);

  const playAudio = useCallback((base64: string) => {
    return new Promise<void>((resolve) => {
      const audio = new Audio(`data:audio/mp3;base64,${base64}`);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        resolve();
      };
      audio.onerror = () => resolve();
      void audio.play().catch(() => resolve());
    });
  }, []);

  const sendText = useCallback(
    async (
      content: string,
      opts?: { mode?: "overlay"; section?: string; commit?: boolean },
    ) => {
      const trimmed = content.trim();
      if (!trimmed || busy) return {};
      const id = await ensureConversation();
      const userMsg: PepperMessage = { id: uid(), role: "user", content: trimmed };
      const assistantId = uid();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setStatus("thinking");
      let navigate: string | undefined;
      let tourStops: TourStop[] | undefined;
      let assistantText = "";
      try {
        await streamSSE(
          `${API_BASE}/openai/conversations/${id}/messages`,
          {
            content: trimmed,
            ...(opts?.mode ? { mode: opts.mode } : {}),
            ...(opts?.section != null ? { section: opts.section } : {}),
            ...(opts?.commit != null ? { commit: opts.commit } : {}),
          },
          (event) => {
            if (event.authRequired === true) {
              setAuthRequired(true);
            }
            // Allowlisted, server-resolved navigation target (Mode B overlay).
            if (typeof event.navigate === "string") {
              navigate = event.navigate;
            }
            // Server-owned guided tour: the ordered, allowlisted stops to walk.
            if (
              event.tour &&
              typeof event.tour === "object" &&
              Array.isArray((event.tour as { stops?: unknown }).stops)
            ) {
              tourStops = (event.tour as { stops: TourStop[] }).stops;
            }
            if (typeof event.content === "string") {
              assistantText += event.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + event.content }
                    : m,
                ),
              );
            }
          },
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.content === ""
              ? { ...m, content: "Sorry, I couldn't respond just then. Please try again." }
              : m,
          ),
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry, something went wrong reaching me. Please try again." }
              : m,
          ),
        );
      } finally {
        setStatus("idle");
        // The turn may have advanced the coach's extraction (e.g. flipping
        // readyForReveal, updating financials). Refresh the profile so the
        // reveal trigger can react, plus every engine-backed surface the
        // dashboard shows so it never lags behind the conversation.
        void queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetReadinessScoresQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetRoadmapQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetOpportunityMatchesQueryKey() });
      }
      return { navigate, tour: tourStops, reply: assistantText.trim() || undefined };
    },
    [busy, ensureConversation, queryClient],
  );

  const startTour = useCallback((stops: TourStop[]) => {
    // Defensive: the server is the allowlist authority, but only start on a
    // non-empty list of well-formed stops (each carries an in-app route).
    const valid = stops.filter(
      (s) => typeof s?.route === "string" && s.route.startsWith("/"),
    );
    if (!valid.length) return;
    setTour({ stops: valid, index: 0 });
  }, []);

  const tourNext = useCallback(() => {
    setTour((t) =>
      t ? (t.index + 1 >= t.stops.length ? null : { ...t, index: t.index + 1 }) : null,
    );
  }, []);

  const tourStop = useCallback(() => {
    setTour(null);
  }, []);

  const sendVoiceBlob = useCallback(
    async (blob: Blob) => {
      if (blob.size === 0) {
        setStatus("idle");
        return;
      }
      const id = await ensureConversation();
      const base64 = await blobToBase64(blob);
      setStatus("thinking");
      const assistantId = uid();
      let pendingAudio: string | null = null;
      let assistantStarted = false;
      try {
        await streamSSE(
          `${API_BASE}/openai/conversations/${id}/voice-messages`,
          { audio: base64, voice },
          (event) => {
            const type = event.type as string | undefined;
            if (type === "auth_required") {
              setAuthRequired(true);
            } else if (type === "user_transcript" && typeof event.data === "string") {
              setMessages((prev) => [
                ...prev,
                { id: uid(), role: "user", content: event.data as string },
              ]);
            } else if (type === "transcript" && typeof event.data === "string") {
              if (!assistantStarted) {
                assistantStarted = true;
                setMessages((prev) => [
                  ...prev,
                  { id: assistantId, role: "assistant", content: event.data as string },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + (event.data as string) }
                      : m,
                  ),
                );
              }
            } else if (type === "audio" && typeof event.data === "string") {
              pendingAudio = event.data as string;
            }
          },
        );
        if (pendingAudio) {
          setStatus("speaking");
          await playAudio(pendingAudio);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: "Sorry, I couldn't hear that clearly. Please try again.",
          },
        ]);
      } finally {
        setStatus("idle");
        // The turn may have advanced the coach's extraction (e.g. flipping
        // readyForReveal, updating financials). Refresh the profile so the
        // reveal trigger can react, plus every engine-backed surface the
        // dashboard shows so it never lags behind the conversation.
        void queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetReadinessScoresQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetRoadmapQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetOpportunityMatchesQueryKey() });
      }
    },
    [ensureConversation, voice, playAudio, queryClient],
  );

  const startListening = useCallback(async () => {
    if (busy || status === "listening") return;
    stopSpeaking();
    await recorder.startRecording();
    setStatus("listening");
  }, [busy, status, recorder, stopSpeaking]);

  // Keep a ref to the latest startListening so the wake-word effect never calls a stale closure.
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListening = useCallback(async () => {
    if (status !== "listening") return;
    const blob = await recorder.stopRecording();
    await sendVoiceBlob(blob);
  }, [status, recorder, sendVoiceBlob]);

  const toggleListening = useCallback(async () => {
    if (status === "listening") {
      await stopListening();
    } else {
      await startListening();
    }
  }, [status, startListening, stopListening]);

  const dictateStart = useCallback(async (): Promise<void> => {
    if (dictating) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    dictationChunksRef.current = [];
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) dictationChunksRef.current.push(e.data);
    };
    mr.start(100);
    dictationRecorderRef.current = mr;
    setDictating(true);
  }, [dictating]);

  const dictateStop = useCallback(async (): Promise<string> => {
    const mr = dictationRecorderRef.current;
    if (!mr) return "";
    const blob = await new Promise<Blob>((resolve) => {
      mr.onstop = () => {
        const b = new Blob(dictationChunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        mr.stream.getTracks().forEach((t) => t.stop());
        resolve(b);
      };
      mr.stop();
    });
    dictationRecorderRef.current = null;
    setDictating(false);
    if (blob.size === 0) return "";
    try {
      const base64 = await blobToBase64(blob);
      const res = await fetch(`${API_BASE}/openai/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64 }),
        credentials: "include",
      });
      if (!res.ok) return "";
      const data = (await res.json()) as { text: string };
      return data.text ?? "";
    } catch {
      return "";
    }
  }, []);

  // Wake word listener
  const setWakeWordEnabled = useCallback(
    (enabled: boolean) => {
      setWakeWordEnabledState(enabled);
    },
    [],
  );

  useEffect(() => {
    // Pause the wake-word listener while the ambient layer is open: the ambient
    // command capture uses the same SpeechRecognition API, and only one
    // recognition session can run at a time.
    if (!wakeWordEnabled || ambient) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0]?.transcript ?? "")
        .join(" ")
        .toLowerCase();
      if (/\bhey\s+pep(per)?\b/.test(transcript)) {
        recognition.stop();
        // Open the self-contained ambient layer (background + orb only). This
        // never changes the route or mounts the landing page.
        openAmbientRef.current();
      }
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      // Restart if still enabled and not currently in a voice turn.
      if (recognitionRef.current === recognition && wakeWordEnabled) {
        try {
          recognition.start();
        } catch {
          /* ignore */
        }
      }
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      /* ignore */
    }
    return () => {
      recognitionRef.current = null;
      recognition.onend = null;
      recognition.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wakeWordEnabled, ambient]);

  const reset = useCallback(async () => {
    stopSpeaking();
    conversationIdRef.current = null;
    try {
      localStorage.removeItem(STORAGE_CONV);
    } catch {
      /* ignore */
    }
    setMessages([]);
    setStatus("idle");
    setAuthRequired(false);
    setTour(null);
  }, [stopSpeaking]);

  const value: PepperContextValue = {
    open,
    setOpen,
    messages,
    status,
    busy,
    voice,
    setVoice,
    sendText,
    tour,
    startTour,
    tourNext,
    tourStop,
    startListening,
    stopListening,
    toggleListening,
    stopSpeaking,
    wakeWordEnabled,
    setWakeWordEnabled,
    wakeWordSupported,
    dictateStart,
    dictateStop,
    dictating,
    reset,
    authRequired,
    clearAuthRequired,
    ambient,
    openAmbient,
    closeAmbient,
    speechMuted,
    setSpeechMuted,
    speak,
    cancelSpeech,
    captureCommand,
  };

  return (
    <PepperContext.Provider value={value}>{children}</PepperContext.Provider>
  );
}

export function usePepper(): PepperContextValue {
  const ctx = useContext(PepperContext);
  if (!ctx) {
    throw new Error("usePepper must be used within a PepperProvider");
  }
  return ctx;
}
