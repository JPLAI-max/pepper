export type PepperVoice = "female" | "male";

export type PepperStatus = "idle" | "listening" | "thinking" | "speaking";

export interface PepperMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
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

  /** Send a typed message; assistant reply streams into `messages`. */
  sendText: (content: string) => Promise<void>;

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

  /** Dictate into any field (press-and-hold): start recording, then stop to get the transcript. */
  dictateStart: () => Promise<void>;
  dictateStop: () => Promise<string>;
  /** True while a dictation recording is active. */
  dictating: boolean;

  /** Clear the current conversation and start fresh. */
  reset: () => Promise<void>;
}
