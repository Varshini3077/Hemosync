/**
 * Parses raw WhatsApp text messages from hospital coordinators into structured
 * blood request data.
 *
 * Strategy:
 *   1. Run regex patterns against the raw text
 *   2. Compute a confidence score based on how many fields were matched
 *   3. If confidence is low (< 0.6), fall back to POST /api/parse-request
 *      which uses GPT-4o for NLP extraction
 *
 * Example input:  "Need 2 units O+ blood urgently"
 * Example output: { bloodType: 'O+', units: 2, urgency: 'HIGH', confidence: 0.85 }
 */

import type { BloodType, BloodComponent } from "@hemosync/types";

export interface ParsedMessage {
  bloodType: BloodType | null;
  component: BloodComponent | null;
  units: number | null;
  urgency: "CRITICAL" | "HIGH" | "NORMAL" | null;
  hospitalId: string | null;
  confidence: number;
}

// Regex patterns for extracting blood request fields

const BLOOD_TYPE_PATTERN =
  /\b(A[+-]|B[+-]|AB[+-]|O[+-])\b/i;

const UNITS_PATTERN =
  /\b(\d{1,2})\s*(?:units?|bags?|pints?)\b/i;

const COMPONENT_PATTERNS: [RegExp, BloodComponent][] = [
  [/\bPRBC\b|\bpacked\s+(?:red\s+)?(?:blood\s+)?cells?\b/i, "PRBC"],
  [/\bFFP\b|\bfresh\s+frozen\s+plasma\b/i, "FFP"],
  [/\bplatelets?\b/i, "PLATELETS"],
  [/\bcryoprecipitate\b/i, "CRYOPRECIPITATE"],
  [/\bwhole\s+blood\b/i, "WHOLE_BLOOD"],
];

const URGENCY_CRITICAL_PATTERN =
  /\b(critical|emergency|stat|immediate|life.?threatening)\b/i;

const URGENCY_HIGH_PATTERN =
  /\b(urgent|urgently|asap|high.?priority|surgery|acute)\b/i;

const HOSPITAL_ID_PATTERN =
  /\b(?:ward|dept|department|unit|hospital|hosp)\s+([A-Z0-9\-]+)\b/i;

/**
 * Attempt to parse a coordinator's WhatsApp message using regex patterns.
 * Returns a ParsedMessage with a confidence score (0–1).
 */
export function parseWhatsAppMessage(rawText: string): ParsedMessage {
  const text = rawText.trim();
  let matchCount = 0;
  let totalFields = 4; // bloodType, units, urgency, component

  // Extract blood type
  const bloodTypeMatch = BLOOD_TYPE_PATTERN.exec(text);
  const bloodType = bloodTypeMatch
    ? (normaliseBloodType(bloodTypeMatch[1] ?? "") as BloodType | null)
    : null;
  if (bloodType) matchCount++;

  // Extract units
  const unitsMatch = UNITS_PATTERN.exec(text);
  const units = unitsMatch ? parseInt(unitsMatch[1] ?? "0", 10) : null;
  if (units) matchCount++;

  // Extract component
  let component: BloodComponent | null = null;
  for (const [pattern, comp] of COMPONENT_PATTERNS) {
    if (pattern.test(text)) {
      component = comp;
      matchCount++;
      break;
    }
  }
  // If no explicit component matched, check for plain "blood" → default to PRBC
  if (!component && /\bblood\b/i.test(text)) {
    component = "PRBC";
    matchCount += 0.5; // partial match
  }

  // Extract urgency
  let urgency: "CRITICAL" | "HIGH" | "NORMAL" | null = null;
  if (URGENCY_CRITICAL_PATTERN.test(text)) {
    urgency = "CRITICAL";
    matchCount++;
  } else if (URGENCY_HIGH_PATTERN.test(text)) {
    urgency = "HIGH";
    matchCount++;
  } else if (bloodType || units) {
    // Presence of any core field suggests at least a NORMAL request
    urgency = "NORMAL";
    matchCount += 0.5;
  }

  // Extract hospital ID from message context
  const hospitalMatch = HOSPITAL_ID_PATTERN.exec(text);
  const hospitalId = hospitalMatch ? (hospitalMatch[1] ?? null) : null;

  const confidence = Math.min(matchCount / totalFields, 1.0);

  return {
    bloodType,
    component,
    units,
    urgency,
    hospitalId,
    confidence,
  };
}

/**
 * Normalise blood type string to match BloodType union.
 * Converts lowercase plus/minus signs and common variants.
 */
function normaliseBloodType(raw: string): BloodType | null {
  const normalised = raw.toUpperCase().replace(/POSITIVE/i, "+").replace(/NEGATIVE/i, "-");
  const valid: BloodType[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  return valid.includes(normalised as BloodType) ? (normalised as BloodType) : null;
}
