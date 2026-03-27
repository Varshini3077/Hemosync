import { useState, useCallback, useRef } from "react";
import { startRecognition } from "@/lib/speech-client";
import { parseRequest } from "@/lib/api-client";
import { useRequestStore } from "@/store/requestStore";

export interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  error: string | null;
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const { isListening, setIsListening, setRequest } = useRequestStore();

  const startListening = useCallback(() => {
    setError(null);
    setTranscript("");
    setIsListening(true);

    const stop = startRecognition(
      (text) => {
        setTranscript(text);
      },
      (err) => {
        setError(err);
        setIsListening(false);
        stopRef.current = null;
      },
    );

    stopRef.current = stop;
  }, [setIsListening]);

  const stopListening = useCallback(() => {
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
    setIsListening(false);

    if (transcript.trim().length > 0) {
      parseRequest({ message: transcript })
        .then((parsed) => {
          if (
            parsed.bloodType &&
            parsed.component &&
            parsed.units &&
            parsed.urgency
          ) {
            setRequest({
              id: crypto.randomUUID(),
              bloodType: parsed.bloodType,
              component: parsed.component,
              units: parsed.units,
              urgency: parsed.urgency,
            });
          }
        })
        .catch((err: unknown) => {
          setError(
            err instanceof Error ? err.message : "Failed to parse request",
          );
        });
    }
  }, [transcript, setIsListening, setRequest]);

  return { isListening, transcript, startListening, stopListening, error };
}
