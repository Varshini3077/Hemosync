import React, { useState } from "react";
import { Phone, MapPin, Users, CheckCircle2 } from "lucide-react";
import type { ConfirmedBankInfo } from "@/hooks/useBroadcastStatus";
import { getFallbackDonors } from "@/lib/api-client";
import { useRequestStore } from "@/store/requestStore";
import { DonorList } from "./DonorList";
import type { DonorScore } from "@hemosync/types";

export interface ConfirmationCardProps {
  readonly confirmedBank: ConfirmedBankInfo;
  readonly requestId: string;
  readonly units: number;
}

export function ConfirmationCard({
  confirmedBank,
  requestId,
  units,
}: ConfirmationCardProps): React.ReactElement {
  const currentRequest = useRequestStore((s) => s.currentRequest);
  const [donors, setDonors] = useState<ReadonlyArray<DonorScore>>([]);
  const [showDonors, setShowDonors] = useState(false);
  const [donorsLoading, setDonorsLoading] = useState(false);
  const [donorsError, setDonorsError] = useState<string | null>(null);

  const handleFindDonors = async () => {
    setShowDonors(true);
    if (donors.length > 0) return;

    setDonorsLoading(true);
    setDonorsError(null);

    try {
      const response = await getFallbackDonors({
        requestId,
        bloodType: currentRequest?.bloodType ?? "O+",
        location: confirmedBank.location,
        limit: 5,
      });
      setDonors(response.donors);
    } catch (err) {
      setDonorsError(
        err instanceof Error ? err.message : "Failed to fetch donors",
      );
    } finally {
      setDonorsLoading(false);
    }
  };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${confirmedBank.location.lat},${confirmedBank.location.lng}`;
  const staticMapUrl = `https://atlas.microsoft.com/map/static/png?subscription-key=placeholder&center=${confirmedBank.location.lng},${confirmedBank.location.lat}&zoom=14&width=400&height=200&format=png`;

  return (
    <div className="space-y-6">
      {/* Confirmation banner */}
      <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-300 rounded-xl">
        <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
        <div>
          <h2 className="text-lg font-bold text-green-900">Supply Confirmed</h2>
          <p className="text-sm text-green-700">
            {units} unit{units !== 1 ? "s" : ""} secured from{" "}
            <strong>{confirmedBank.name}</strong>
          </p>
        </div>
      </div>

      {/* Bank details card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {/* Map thumbnail */}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative"
          aria-label={`Open ${confirmedBank.name} in Google Maps`}
        >
          <img
            src={staticMapUrl}
            alt={`Map location of ${confirmedBank.name}`}
            className="w-full h-36 object-cover bg-gray-100"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <MapPin className="w-8 h-8 text-hemosync-red" />
          </div>
        </a>

        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {confirmedBank.name}
            </h3>
            <div className="flex items-start gap-1.5 mt-1">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-600">{confirmedBank.address}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {confirmedBank.distanceKm.toFixed(1)} km away
            </p>
          </div>

          {/* Click-to-call */}
          <a
            href={`tel:${confirmedBank.phone}`}
            className="flex items-center justify-center gap-2 w-full px-5 py-3.5 bg-hemosync-navy text-white font-semibold rounded-lg hover:bg-blue-900 transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300 text-sm"
            aria-label={`Call ${confirmedBank.name} at ${confirmedBank.phone}`}
          >
            <Phone className="w-5 h-5" />
            {confirmedBank.phone}
          </a>
        </div>
      </div>

      {/* Find in-hospital donors */}
      <div className="border border-gray-200 rounded-xl bg-white">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-hemosync-navy" />
            <h3 className="text-sm font-semibold text-gray-900">
              In-Hospital Donors
            </h3>
          </div>
          <button
            type="button"
            onClick={() => void handleFindDonors()}
            className="text-xs font-medium text-hemosync-navy hover:text-blue-900 underline"
          >
            {showDonors ? "Refresh" : "Find Donors"}
          </button>
        </div>

        {showDonors && (
          <div className="p-4">
            <DonorList
              donors={donors}
              isLoading={donorsLoading}
              error={donorsError}
            />
          </div>
        )}

        {!showDonors && (
          <div className="p-4 text-center">
            <button
              type="button"
              onClick={() => void handleFindDonors()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-hemosync-gold text-white font-medium rounded-lg hover:opacity-90 text-sm transition-opacity focus:outline-none focus:ring-4 focus:ring-yellow-300"
            >
              <Users className="w-4 h-4" />
              Find In-Hospital Donors
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
