"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Microphone, MicrophoneSlash } from "@phosphor-icons/react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// Web Speech API no tiene tipos oficiales en TS/DOM todavía.
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (
    (w.SpeechRecognition as new () => SpeechRecognitionLike) ??
    (w.webkitSpeechRecognition as new () => SpeechRecognitionLike) ??
    null
  );
}

// El soporte de dictado depende del navegador (API externa al render de
// React), así que se lee con useSyncExternalStore: en el servidor y en el
// primer render de hidratación siempre reporta "no soportado" (evita
// desajustes de hidratación) y se actualiza al valor real justo después.
function subscribeNoop() {
  return () => {};
}
function getSupportedSnapshot() {
  return getSpeechRecognitionCtor() !== null;
}
function getServerSupportedSnapshot() {
  return false;
}

export function DictationTextarea({
  id,
  label,
  hint,
  value,
  onChange,
  required,
  error,
  minRows = 3,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  minRows?: number;
}) {
  const supported = useSyncExternalStore(
    subscribeNoop,
    getSupportedSnapshot,
    getServerSupportedSnapshot
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  function toggleDictation() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = "es-MX";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const results = (
        event as { results: ArrayLike<{ 0: { transcript: string } }> }
      ).results;
      const transcript = Array.from(results)
        .map((result) => result[0].transcript)
        .join(" ");
      onChange(value ? `${value} ${transcript}` : transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
        {supported && (
          <Button
            type="button"
            variant={listening ? "default" : "outline"}
            size="sm"
            onClick={toggleDictation}
            className="gap-1.5"
          >
            {listening ? (
              <MicrophoneSlash className="size-4" aria-hidden />
            ) : (
              <Microphone className="size-4" aria-hidden />
            )}
            {listening ? "Detener" : "Dictar"}
          </Button>
        )}
      </div>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <Textarea
        id={id}
        rows={minRows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
