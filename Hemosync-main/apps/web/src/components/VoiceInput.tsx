import React from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

type VoiceInputState = "idle" | "listening" | "processing";

export interface VoiceInputProps {
  readonly state: VoiceInputState;
  readonly transcript: string;
  readonly error: string | null;
  readonly onStart: () => void;
  readonly onStop: () => void;
}

/**
 * Standalone microphone button component with three visual states:
 * - idle: grey mic icon
 * - listening: red pulsing mic + animated sound waves
 * - processing: spinner
 */
export function VoiceInput({
  state,
  transcript,
  error,
  onStart,
  onStop,
}: VoiceInputProps): React.ReactElement {
  const handleClick = () => {
    if (state === "idle") {
      onStart();
    } else if (state === "listening") {
      onStop();
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex flex-col items-center">
        {/* Sound wave bars — only visible when listening */}
        {state === "listening" && (
          <div className="absolute -top-8 flex items-end gap-0.5 h-6">
            {[0.4, 0.7, 1, 0.7, 0.4, 0.7, 1, 0.7, 0.4].map((delay, i) => (
              <span
                key={i}
                className="w-1 rounded-full bg-hemosync-red animate-waveform"
                style={{
                  animationDelay: `${delay * 0.2}s`,
                  height: "100%",
                }}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleClick}
          disabled={state === "processing"}
          aria-label={
            state === "listening"
              ? "Stop recording"
              : state === "processing"
                ? "Processing…"
                : "Start voice input"
          }
          className={[
            "flex items-center justify-center",
            "w-16 h-16 rounded-full",
            "transition-all duration-200 focus:outline-none focus:ring-4",
            state === "idle"
              ? "bg-gray-200 hover:bg-gray-300 text-gray-600 focus:ring-gray-300"
              : state === "listening"
                ? "bg-hemosync-red text-white shadow-lg animate-pulse focus:ring-red-300"
                : "bg-gray-200 text-gray-400 cursor-not-allowed focus:ring-gray-200",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {state === "processing" ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : state === "listening" ? (
            <MicOff className="w-7 h-7" />
          ) : (
            <Mic className="w-7 h-7" />
          )}
        </button>
      </div>

      {/* Transcript preview */}
      {transcript && (
        <p className="max-w-xs text-center text-sm text-gray-700 italic">
          &ldquo;{transcript}&rdquo;
        </p>
      )}

      {/* Error message */}
      {error && (
        <p className="max-w-xs text-center text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      {state === "idle" && !transcript && !error && (
        <p className="text-xs text-gray-400">
          Press to dictate your blood request
        </p>
      )}
      {state === "listening" && (
        <p className="text-xs text-hemosync-red font-medium">
          Listening… press again to stop
        </p>
      )}
    </div>
  );
}
