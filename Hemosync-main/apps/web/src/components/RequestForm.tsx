import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Send } from "lucide-react";
import { BloodTypeBadge } from "@hemosync/ui";
import type { BloodType, BloodComponent } from "@hemosync/types";
import { VoiceInput } from "./VoiceInput";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { parseRequest, getRankedBanks, triggerBroadcast } from "@/lib/api-client";
import { useRequestStore } from "@/store/requestStore";

const BLOOD_TYPES: BloodType[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const COMPONENTS: { value: BloodComponent; label: string }[] = [
  { value: "PRBC", label: "Packed Red Blood Cells (PRBC)" },
  { value: "FFP", label: "Fresh Frozen Plasma (FFP)" },
  { value: "PLATELETS", label: "Platelets" },
  { value: "WHOLE_BLOOD", label: "Whole Blood" },
];

type Urgency = "CRITICAL" | "HIGH" | "NORMAL";

const URGENCY_OPTIONS: { value: Urgency; label: string; description: string }[] = [
  { value: "CRITICAL", label: "Critical", description: "Immediate life threat" },
  { value: "HIGH", label: "High", description: "Urgent — short window available" },
  { value: "NORMAL", label: "Normal", description: "Scheduled or elective" },
];

interface FormError {
  readonly field: string;
  readonly message: string;
}

export function RequestForm(): React.ReactElement {
  const navigate = useNavigate();
  const { setRequest, setRankedBanks, updateBroadcastStatus } = useRequestStore();

  const [bloodType, setBloodType] = useState<BloodType | "">("");
  const [component, setComponent] = useState<BloodComponent | "">("");
  const [units, setUnits] = useState<number>(1);
  const [urgency, setUrgency] = useState<Urgency>("NORMAL");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ReadonlyArray<FormError>>([]);
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "processing">("idle");

  const { transcript, startListening, stopListening, error: speechError } = useSpeechRecognition();

  const currentRequest = useRequestStore((s) => s.currentRequest);

  // Pre-fill form when speech recognition parses a request
  React.useEffect(() => {
    if (currentRequest) {
      setBloodType(currentRequest.bloodType);
      setComponent(currentRequest.component);
      setUnits(currentRequest.units);
      setUrgency(currentRequest.urgency);
      setVoiceState("idle");
    }
  }, [currentRequest]);

  const handleVoiceStart = () => {
    setVoiceState("listening");
    startListening();
  };

  const handleVoiceStop = () => {
    setVoiceState("processing");
    stopListening();
  };

  const validate = (): boolean => {
    const newErrors: FormError[] = [];
    if (!bloodType) newErrors.push({ field: "bloodType", message: "Blood type is required" });
    if (!component) newErrors.push({ field: "component", message: "Component is required" });
    if (units < 1 || units > 10) newErrors.push({ field: "units", message: "Units must be between 1 and 10" });
    setErrors(newErrors);
    return newErrors.length === 0;
  };

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validate() || !bloodType || !component) return;

  setIsSubmitting(true);

  try {

const inputText = transcript.trim().length > 0 ? transcript : `Need ${units} units of ${component} blood type ${bloodType} urgency ${urgency}`;

const position = await new Promise<GeolocationPosition>((resolve, reject) =>
  navigator.geolocation.getCurrentPosition(resolve, reject)
);
const { latitude, longitude } = position.coords;

const res = await fetch(
       "https://hemosync-func-f6fvhrfdfqaweye7.canadacentral-01.azurewebsites.net/api/parse-request",
  {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": "hemosync-secret-key-2026" },
    body: JSON.stringify({ rawText: inputText, interface: "WEB", coordinatorId: "web-user", hospitalId: "default-hospital" }),
  }
);
  

    const data = await res.json();
    console.log("Backend response:", data);

    const requestId = crypto.randomUUID();

    setRequest({
      id: requestId,
      bloodType,
      component,
      units,
      urgency,
    });

    if (data.topBanks && data.topBanks.length > 0) {
      setRankedBanks(
        data.topBanks.map((b: any, index: number) => ({
          id: String(index),
          name: b.name,
          address: "Delhi (Simulated)",
          phone: "N/A",
          distanceKm: b.distance,
          estimatedDriveMinutes: Math.round(b.distance * 3),
          compositeScore: 0.9,
          reliabilityScore: 0.9,
        }))
      );
    }

    updateBroadcastStatus({
      status: data.fallback ? "PENDING" : "BROADCASTING",
      banks: [],
    });

    navigate(`/requests/${requestId}`);

  } catch (err) {
    console.error(err);

    setErrors([
      {
        field: "submit",
        message:
          err instanceof Error
            ? err.message
            : "Failed to connect to backend",
      },
    ]);
  } finally {
    setIsSubmitting(false);
  }
};

  const submitError = errors.find((e) => e.field === "submit");

  return (
  <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-8">
      {/* Voice Input */}
      <div className="flex flex-col items-center py-4 border border-dashed border-gray-300 rounded-xl bg-gray-50">
        <p className="text-sm font-medium text-gray-600 mb-4">
          Dictate your request or fill in the form below
        </p>
        <VoiceInput
          state={voiceState}
          transcript={transcript}
          error={speechError}
          onStart={handleVoiceStart}
          onStop={handleVoiceStop}
        />
      </div>

      {/* Blood Type */}
      <fieldset>
        <legend className="block text-sm font-semibold text-gray-800 mb-3">
          Blood Type <span className="text-hemosync-red">*</span>
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {BLOOD_TYPES.map((bt) => (
            <button
              key={bt}
              type="button"
              onClick={() => setBloodType(bt)}
              className={[
                "relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-hemosync-navy",
                bloodType === bt
                  ? "border-hemosync-navy shadow-md"
                  : "border-gray-200 hover:border-gray-300",
              ].join(" ")}
              aria-pressed={bloodType === bt}
              aria-label={`Select blood type ${bt}`}
            >
              <BloodTypeBadge bloodType={bt} />
            </button>
          ))}
        </div>
        {errors.find((e) => e.field === "bloodType") && (
          <p className="mt-1 text-xs text-red-600">
            {errors.find((e) => e.field === "bloodType")?.message}
          </p>
        )}
      </fieldset>

      {/* Component */}
      <div>
        <label
          htmlFor="component"
          className="block text-sm font-semibold text-gray-800 mb-2"
        >
          Blood Component <span className="text-hemosync-red">*</span>
        </label>
        <select
          id="component"
          value={component}
          onChange={(e) => setComponent(e.target.value as BloodComponent)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-hemosync-navy focus:border-transparent"
        >
          <option value="">Select component…</option>
          {COMPONENTS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {errors.find((e) => e.field === "component") && (
          <p className="mt-1 text-xs text-red-600">
            {errors.find((e) => e.field === "component")?.message}
          </p>
        )}
      </div>

      {/* Units */}
      <div>
        <label
          htmlFor="units"
          className="block text-sm font-semibold text-gray-800 mb-2"
        >
          Units Required
        </label>
        <input
          id="units"
          type="number"
          min={1}
          max={10}
          value={units}
          onChange={(e) => setUnits(Number(e.target.value))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-hemosync-navy focus:border-transparent"
        />
        {errors.find((e) => e.field === "units") && (
          <p className="mt-1 text-xs text-red-600">
            {errors.find((e) => e.field === "units")?.message}
          </p>
        )}
      </div>

      {/* Urgency */}
      <fieldset>
        <legend className="block text-sm font-semibold text-gray-800 mb-3">
          Urgency Level
        </legend>
        <div className="flex flex-col gap-2">
          {URGENCY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={[
                "flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                urgency === opt.value
                  ? opt.value === "CRITICAL"
                    ? "border-hemosync-red bg-red-50 animate-pulse-urgent"
                    : opt.value === "HIGH"
                      ? "border-amber-400 bg-amber-50"
                      : "border-blue-400 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300",
              ].join(" ")}
            >
              <input
                type="radio"
                name="urgency"
                value={opt.value}
                checked={urgency === opt.value}
                onChange={() => setUrgency(opt.value)}
                className="mt-0.5 accent-hemosync-navy"
              />
              <div>
                <span
                  className={[
                    "text-sm font-semibold",
                    opt.value === "CRITICAL"
                      ? "text-hemosync-red"
                      : opt.value === "HIGH"
                        ? "text-amber-700"
                        : "text-blue-700",
                  ].join(" ")}
                >
                  {opt.label}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Submit error */}
      {submitError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm">{submitError.message}</p>
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-hemosync-navy text-white font-semibold rounded-lg hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        {isSubmitting ? (
          <>
            <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            Broadcasting…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Submit &amp; Broadcast
          </>
        )}
      </button>
    </form>
  );
}
