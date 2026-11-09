"use client";

import { Mic, MicOff } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// The Web Speech API is not in every TypeScript DOM lib yet: only what this button uses.
type RecognitionResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const subscribeNever = () => () => {};

/** Server render and hydration assume no support; the client snapshot shows the button where it works. */
function useSpeechSupported(): boolean {
  return useSyncExternalStore(subscribeNever, () => recognitionConstructor() !== undefined, () => false);
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Permita el uso del micrófono para dictar.",
  "service-not-allowed": "Permita el uso del micrófono para dictar.",
  "no-speech": "No se escuchó nada. Intente de nuevo.",
  network: "Sin conexión: escriba el texto.",
  "audio-capture": "No se encontró un micrófono.",
};

/**
 * Dictation for a text field: the browser's speech recognition (Google on Chrome / Android, Apple on
 * Safari) writes what the driver says, in Colombian Spanish, at the end of the current text, which
 * stays editable. Hidden where the browser has no speech recognition (e.g. Firefox).
 */
export function DictateButton({
  value,
  onChange,
  maxLength,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  /** What is being dictated, for screen readers. */
  label: string;
}) {
  const supported = useSpeechSupported();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  // The results arrive asynchronously: append to the latest text, not to the one at start.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  useEffect(() => () => recognitionRef.current?.abort(), []);

  if (!supported) return null;

  function start() {
    const Ctor = recognitionConstructor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "es-CO";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          const current = valueRef.current.trimEnd();
          const next = (current ? `${current} ${text}` : text).slice(0, maxLength);
          valueRef.current = next;
          onChangeRef.current(next);
        } else {
          pending += `${text} `;
        }
      }
      setInterim(pending.trim());
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted") setError(ERRORS[event.error] ?? "No se pudo dictar. Escriba el texto.");
    };
    recognition.onend = () => {
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("No se pudo dictar. Escriba el texto.");
    }
  }

  function stop() {
    recognitionRef.current?.stop();
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        aria-label={listening ? `Dejar de dictar: ${label}` : `Dictar: ${label}`}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-lg border-2 px-3 text-base font-semibold outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/70",
          listening
            ? "animate-pulse border-destructive bg-destructive text-white motion-reduce:animate-none"
            : "border-input bg-background hover:bg-muted",
        )}
      >
        {listening ? <MicOff className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
        {listening ? "Escuchando… toque para parar" : "Dictar"}
      </button>
      {interim && (
        <p className="text-sm text-muted-foreground italic" aria-live="polite">
          {interim}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
