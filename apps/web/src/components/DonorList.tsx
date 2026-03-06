import React, { useState } from "react";
import { Phone, Clock, CheckCircle2 } from "lucide-react";
import { BloodTypeBadge } from "@hemosync/ui";
import type { DonorScore } from "@hemosync/types";

export interface DonorListProps {
  readonly donors: ReadonlyArray<DonorScore>;
  readonly isLoading: boolean;
  readonly error: string | null;
}

export function DonorList({
  donors,
  isLoading,
  error,
}: DonorListProps): React.ReactElement {
  const [contactedIds, setContactedIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const markContacted = (donorId: string) => {
    setContactedIds((prev) => new Set([...prev, donorId]));
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
        {error}
      </p>
    );
  }

  if (donors.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-6">
        No eligible donors found nearby.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="pb-2 pr-4 font-semibold text-gray-600">Blood Type</th>
            <th className="pb-2 pr-4 font-semibold text-gray-600">Eligibility</th>
            <th className="pb-2 pr-4 font-semibold text-gray-600">ETA</th>
            <th className="pb-2 pr-4 font-semibold text-gray-600">Contact</th>
            <th className="pb-2 font-semibold text-gray-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {donors.slice(0, 5).map((ds) => {
            const isContacted = contactedIds.has(ds.donor.id);
            return (
              <tr
                key={ds.donor.id}
                className={[
                  "transition-colors",
                  isContacted ? "bg-green-50" : "hover:bg-gray-50",
                ].join(" ")}
              >
                <td className="py-3 pr-4">
                  <BloodTypeBadge bloodType={ds.donor.bloodType} />
                </td>
                <td className="py-3 pr-4">
                  <span
                    className={[
                      "text-xs font-medium",
                      ds.donor.isEligible ? "text-green-700" : "text-red-600",
                    ].join(" ")}
                  >
                    {ds.donor.isEligible ? "Eligible" : "Ineligible"}
                  </span>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ds.eligibilityReason}
                  </p>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1 text-gray-700">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>{ds.etaMinutes} min</span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <a
                    href={`tel:${ds.donor.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-hemosync-navy border border-hemosync-navy rounded-md hover:bg-blue-50 transition-colors"
                    aria-label={`Call donor at ${ds.donor.phone}`}
                  >
                    <Phone className="w-3 h-3" />
                    {ds.donor.phone}
                  </a>
                </td>
                <td className="py-3">
                  {isContacted ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Contacted
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => markContacted(ds.donor.id)}
                      className="text-xs text-gray-500 hover:text-hemosync-navy underline"
                    >
                      Mark contacted
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
