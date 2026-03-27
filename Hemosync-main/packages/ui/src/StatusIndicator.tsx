/**
 * StatusIndicator — an animated dot showing the live status of a blood request.
 *
 * Visual semantics:
 *  - PENDING      → grey pulsing dot   (awaiting dispatch)
 *  - BROADCASTING → blue pulsing dot   (messages sent, waiting for replies)
 *  - CONFIRMED    → green solid dot    (supply secured)
 *  - FAILED       → red solid dot      (no supply found)
 *  - FALLBACK     → orange pulsing dot (escalated to donor matching)
 */

import React from "react";

/** Request status values that StatusIndicator can represent. */
export type RequestStatus =
  | "PENDING"
  | "BROADCASTING"
  | "CONFIRMED"
  | "FAILED"
  | "FALLBACK";

interface StatusStyle {
  readonly dotColour: string;
  readonly animate: boolean;
  readonly label: string;
}

/** Maps each status to its visual treatment. */
const STATUS_STYLES: Record<RequestStatus, StatusStyle> = {
  PENDING: {
    dotColour: "bg-gray-400",
    animate: true,
    label: "Pending",
  },
  BROADCASTING: {
    dotColour: "bg-blue-500",
    animate: true,
    label: "Broadcasting",
  },
  CONFIRMED: {
    dotColour: "bg-green-500",
    animate: false,
    label: "Confirmed",
  },
  FAILED: {
    dotColour: "bg-red-500",
    animate: false,
    label: "Failed",
  },
  FALLBACK: {
    dotColour: "bg-orange-400",
    animate: true,
    label: "Fallback",
  },
};

export interface StatusIndicatorProps {
  /** Current status of the blood request. */
  readonly status: RequestStatus;
  /** Whether to show the text label next to the dot (default: true). */
  readonly showLabel?: boolean;
  /** Optional extra CSS class names applied to the wrapper element. */
  readonly className?: string;
}

/**
 * Renders an animated (or static) coloured dot with an optional text label.
 * Pulsing dots (PENDING, BROADCASTING, FALLBACK) use the Tailwind `animate-ping`
 * utility via a layered approach so the dot remains visible while the outer
 * ring animates.
 */
export function StatusIndicator({
  status,
  showLabel = true,
  className = "",
}: StatusIndicatorProps): React.ReactElement {
  const { dotColour, animate, label } = STATUS_STYLES[status];

  return (
    <span
      className={["inline-flex items-center gap-2", className]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-label={`Status: ${label}`}
    >
      {/* Dot container — relative so the ping ring is positioned correctly */}
      <span className="relative flex h-2.5 w-2.5">
        {animate && (
          <span
            className={[
              "absolute inline-flex h-full w-full rounded-full opacity-75",
              "animate-ping",
              dotColour,
            ].join(" ")}
          />
        )}
        <span
          className={[
            "relative inline-flex h-2.5 w-2.5 rounded-full",
            dotColour,
          ].join(" ")}
        />
      </span>

      {showLabel && (
        <span className="text-sm font-medium text-gray-700">{label}</span>
      )}
    </span>
  );
}
