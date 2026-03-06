/**
 * BloodTypeBadge — a coloured badge that visually identifies a blood type.
 *
 * Colour scheme is chosen for at-a-glance recognition in clinical dashboards:
 *  - O-  → gold   (universal donor — most valuable, most distinctive)
 *  - O+  → green  (most common type)
 *  - A+/A- → blue shades
 *  - B+/B- → purple shades
 *  - AB+/AB- → red shades (universal recipient)
 */

import React from "react";
import type { BloodType } from "@hemosync/types";

/** Maps each blood type to a Tailwind background + text colour pair. */
const COLOUR_MAP: Record<BloodType, { bg: string; text: string; border: string }> = {
  "O-":  { bg: "bg-yellow-100", text: "text-yellow-900", border: "border-yellow-400" },
  "O+":  { bg: "bg-green-100",  text: "text-green-900",  border: "border-green-500"  },
  "A+":  { bg: "bg-blue-100",   text: "text-blue-900",   border: "border-blue-400"   },
  "A-":  { bg: "bg-blue-50",    text: "text-blue-800",   border: "border-blue-300"   },
  "B+":  { bg: "bg-purple-100", text: "text-purple-900", border: "border-purple-400" },
  "B-":  { bg: "bg-purple-50",  text: "text-purple-800", border: "border-purple-300" },
  "AB+": { bg: "bg-red-100",    text: "text-red-900",    border: "border-red-400"    },
  "AB-": { bg: "bg-red-50",     text: "text-red-800",    border: "border-red-300"    },
};

export interface BloodTypeBadgeProps {
  /** The blood type to display. */
  readonly bloodType: BloodType;
  /** Optional extra CSS class names. */
  readonly className?: string;
}

/**
 * Renders a small coloured badge showing the blood type label.
 * Intended for use in request cards, donor lists, and bank tables.
 */
export function BloodTypeBadge({ bloodType, className = "" }: BloodTypeBadgeProps): React.ReactElement {
  const colours = COLOUR_MAP[bloodType];

  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        "rounded-full border px-2.5 py-0.5",
        "text-xs font-semibold tracking-wide",
        colours.bg,
        colours.text,
        colours.border,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`Blood type ${bloodType}`}
    >
      {bloodType}
    </span>
  );
}
