import React from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, AlertTriangle } from "lucide-react";
import { useBroadcastStatus } from "@/hooks/useBroadcastStatus";
import { useRequestStore } from "@/store/requestStore";
import { BroadcastStatusPanel } from "@/components/BroadcastStatusPanel";
import { ConfirmationCard } from "@/components/ConfirmationCard";

export function RequestDetail(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const currentRequest = useRequestStore((s) => s.currentRequest);

  const {
    status,
    banks,
    confirmedBank,
    elapsedSeconds,
    error,
  } = useBroadcastStatus(id ?? null);

  const resolvedStatus = status ?? currentRequest?.urgency ? status : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-hemosync-navy transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-900 font-medium">
          Request {id ? `#${id.slice(0, 8)}` : ""}
        </span>
      </div>

      {/* Request summary */}
      {currentRequest && (
        <div className="bg-hemosync-navy text-white rounded-xl p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">
                Active Request
              </p>
              <p className="text-xl font-bold mt-1">
                {currentRequest.units} unit{currentRequest.units !== 1 ? "s" : ""} of{" "}
                {currentRequest.component} · {currentRequest.bloodType}
              </p>
            </div>
            <span
              className={[
                "px-3 py-1 rounded-full text-xs font-semibold",
                currentRequest.urgency === "CRITICAL"
                  ? "bg-hemosync-red text-white"
                  : currentRequest.urgency === "HIGH"
                    ? "bg-amber-400 text-amber-900"
                    : "bg-blue-400 text-blue-900",
              ].join(" ")}
            >
              {currentRequest.urgency}
            </span>
          </div>
        </div>
      )}

      {!id && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">No request ID found. Please create a new request.</p>
        </div>
      )}

      {/* Status panel */}
      {id && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          {resolvedStatus === "CONFIRMED" && confirmedBank ? (
            <ConfirmationCard
              confirmedBank={confirmedBank}
              requestId={id}
              units={currentRequest?.units ?? 1}
            />
          ) : (
            <BroadcastStatusPanel
              status={status}
              banks={banks}
              elapsedSeconds={elapsedSeconds}
              error={error}
            />
          )}
        </div>
      )}
    </div>
  );
}
