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
import { getGetProfileQueryKey } from "@workspace/api-client-react";
import type {
  PepperContextValue,
  PepperMessage,
  PepperStatus,
  PepperVoice,
} from "./types";

const API_BASE = "/api";
const STORAGE_CONV = "pepper.conversationId";
const STORAGE_VOICE = "pepper.voice";

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

  const clearAuthRequired = useCallback(() => setAuthRequired(false), []);

  const conversationIdRef = useRef<number | null>(null);
  const conversationPromiseRef = useRef<Promise<number> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
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
      if (!trimmed || busy) return;
      const id = await ensureConversation();
      const userMsg: PepperMessage = { id: uid(), role: "user", content: trimmed };
      const assistantId = uid();
      setMessages((prev) => [
        ...prev,
        userMsg,
        { id: assistantId, role: "assistant", content: "" },
      ]);
      setStatus("thinking");
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
            if (typeof event.content === "string") {
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
        // readyForReveal); refresh the profile so the reveal trigger can react.
        void queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      }
    },
    [busy, ensureConversation, queryClient],
  );

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
        // readyForReveal); refresh the profile so the reveal trigger can react.
        void queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
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
    if (!wakeWordEnabled) {
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
        setOpen(true);
        void startListeningRef.current();
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
  }, [wakeWordEnabled]);

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
