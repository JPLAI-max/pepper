export type PepperVoice = "female" | "male";

export type PepperStatus = "idle" | "listening" | "thinking" | "speaking";

export interface PepperMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/** A single stop in the guided demo tour, resolved + allowlisted server-side. */
export interface TourStop {
  /** Allowlisted in-app route to navigate to for this stop. */
  route: string;
  /** Short label shown in the tour banner. */
  name: string;
  /** One-line introduction shown at this stop. */
  intro: string;
}

/** Active guided-tour state held by the provider. */
export interface TourState {
  stops: TourStop[];
  /** Zero-based index of the current stop. */
  index: number;
}

/** Callbacks for a single ambient ("Hey Pep") spoken-command capture. */
export interface AmbientCaptureHandlers {
  /** Partial/interim transcript as the user speaks. */
  onInterim?: (text: string) => void;
  /** Final transcript once the user finishes speaking. */
  onFinal: (text: string) => void;
  /** Recognition ended (with or without a final result). */
  onEnd?: () => void;
}

export interface PepperContextValue {
  /** Whether the global Pepper panel is open. */
  open: boolean;
  setOpen: (open: boolean) => void;

  /** Conversation state. */
  messages: PepperMessage[];
  status: PepperStatus;
  /** True while a response is streaming (thinking or speaking). */
  busy: boolean;

  /** Selected voice for spoken replies. */
  voice: PepperVoice;
  setVoice: (voice: PepperVoice) => void;

  /**
   * Send a typed message; assistant reply streams into `messages`. Pass
   * overlay options to drive the "Hey Pep" Mode B coach: `mode: "overlay"`
   * with the current `section`, and `commit: true` only on a confirmed fill
   * (which runs the server-side extraction/persistence pass for this turn).
   */
  sendText: (
    content: string,
    opts?: { mode?: "overlay"; section?: string; commit?: boolean },
  ) => Promise<{ navigate?: string; tour?: TourStop[]; reply?: string }>;

  /**
   * Guided demo tour. `tour` is non-null while a walkthrough is active. The
   * provider holds only the data (stops + current index); the global TourBanner
   * component reacts to index changes to navigate (it lives inside the router).
   */
  tour: TourState | null;
  /** Begin a tour over the given server-resolved, allowlisted stops. */
  startTour: (stops: TourStop[]) => void;
  /** Advance to the next stop; ends the tour after the last stop. */
  tourNext: () => void;
  /** End the tour and remove the banner. */
  tourStop: () => void;

  /** Voice conversation: start/stop a spoken turn (records, transcribes, replies, speaks). */
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  /** Convenience toggle for a push-to-talk button. */
  toggleListening: () => Promise<void>;

  /** Stop any in-progress spoken reply playback. */
  stopSpeaking: () => void;

  /** Wake word ("Hey Pep") listener — optional, browser-dependent. */
  wakeWordEnabled: boolean;
  setWakeWordEnabled: (enabled: boolean) => void;
  wakeWordSupported: boolean;
  /**
   * Whether the browser exposes the SpeechRecognition API (Chrome/Edge). When
   * false, voice capture (wake word + ambient listening) is unavailable; the UI
   * must degrade to the typed/tap path and never dead-end. TTS (speechSynthesis)
   * is independent and may still work.
   */
  speechRecognitionSupported: boolean;

  /** Dictate into any field (press-and-hold): start recording, then stop to get the transcript. */
  dictateStart: () => Promise<void>;
  dictateStop: () => Promise<string>;
  /** True while a dictation recording is active. */
  dictating: boolean;

  /**
   * Ambient "Hey Pep" layer. A self-contained full-screen surface (background +
   * breathing orb only) shown over the current route on wake — it never changes
   * the route or mounts the landing page, so dismissing returns to exactly where
   * the user was.
   */
  ambient: boolean;
  /** Show the ambient layer (called by the wake word). Does not navigate. */
  openAmbient: () => void;
  /** Hide the ambient layer and cancel any in-progress speech. */
  closeAmbient: () => void;

  /** Whether spoken replies (Web Speech) are muted. Persisted. */
  speechMuted: boolean;
  setSpeechMuted: (muted: boolean) => void;
  /** Speak text via the browser Web Speech API (no-op when muted). */
  speak: (text: string, opts?: { onEnd?: () => void }) => void;
  /** Cancel any in-progress browser speech. */
  cancelSpeech: () => void;
  /**
   * Capture a single spoken command via the browser SpeechRecognition API for
   * the ambient layer. Returns a stop function. Used only while ambient is open.
   */
  captureCommand: (handlers: AmbientCaptureHandlers) => () => void;

  /** Clear the current conversation and start fresh. */
  reset: () => Promise<void>;

  /**
   * True when the server has signalled (via the chat/voice trust gate) that
   * the anonymous user shared financial specifics and should set up an account
   * to persist them. The in-progress conversation is preserved.
   */
  authRequired: boolean;
  /** Dismiss the auth-required signal (e.g. after sign-up or "keep chatting"). */
  clearAuthRequired: () => void;
}
