/**
 * UrgencyPill — a pill-shaped badge indicating the clinical urgency level
 * of a blood request.
 *
 * Colour semantics:
 *  - CRITICAL → red   (immediate life threat)
 *  - HIGH     → amber (urgent but a short window available)
 *  - NORMAL   → blue  (scheduled or elective)
 */

import React from "react";

/** Urgency levels supported by HemoSync blood requests. */
export type Urgency = "CRITICAL" | "HIGH" | "NORMAL";

/** Maps urgency levels to Tailwind colour classes and display labels. */
const URGENCY_STYLES: Record<Urgency, { bg: string; text: string; border: string; label: string }> = {
  CRITICAL: {
    bg: "bg-red-100",
    text: "text-red-800",
    border: "border-red-400",
    label: "Critical",
  },
  HIGH: {
    bg: "bg-amber-100",
    text: "text-amber-800",
    border: "border-amber-400",
    label: "High",
  },
  NORMAL: {
    bg: "bg-blue-100",
    text: "text-blue-800",
    border: "border-blue-400",
    label: "Normal",
  },
};

export interface UrgencyPillProps {
  /** The urgency level to display. */
  readonly urgency: Urgency;
  /** Optional extra CSS class names. */
  readonly className?: string;
}

/**
 * Renders a pill badge for a request's urgency level.
 * Used in request lists, broadcast dashboards, and notification cards.
 */
export function UrgencyPill({ urgency, className = "" }: UrgencyPillProps): React.ReactElement {
  const styles = URGENCY_STYLES[urgency];

  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        "rounded-full border px-3 py-0.5",
        "text-xs font-medium",
        styles.bg,
        styles.text,
        styles.border,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`Urgency: ${styles.label}`}
    >
      {styles.label}
    </span>
  );
}
