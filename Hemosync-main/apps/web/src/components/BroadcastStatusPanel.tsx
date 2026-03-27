import React from "react";
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { BankStatus } from "@/hooks/useBroadcastStatus";

export interface BroadcastStatusPanelProps {
  readonly elapsedSeconds: number;
  readonly banks: ReadonlyArray<BankStatus>;
  readonly status: "PENDING" | "BROADCASTING" | "CONFIRMED" | "FAILED" | "FALLBACK" | null;
  readonly error: string | null;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function BankRow({ bank }: { readonly bank: BankStatus }): React.ReactElement {
  const { reply } = bank;

  const dotClass =
    reply === "YES"
      ? "bg-green-500"
      : reply === "NO"
        ? "bg-red-500"
        : reply === "TIMEOUT"
          ? "bg-gray-400"
          : "bg-gray-300 animate-pulse"; // PENDING / CHECK

  const statusLabel =
    reply === "YES"
      ? "Confirmed"
      : reply === "NO"
        ? "Declined"
        : reply === "TIMEOUT"
          ? "Timed out"
          : reply === "CHECK"
            ? "Checking…"
            : "Waiting…";

  const isFirstYes = reply === "YES";

  return (
    <li
      className={[
        "flex items-center justify-between px-4 py-3 rounded-lg border transition-all",
        isFirstYes
          ? "border-green-400 bg-green-50 shadow-green-200 shadow-md"
          : "border-gray-200 bg-white",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          {(reply === "PENDING" || reply === "CHECK") && (
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${dotClass}`}
            />
          )}
          <span
            className={`relative inline-flex h-3 w-3 rounded-full ${dotClass}`}
          />
        </span>
        <span className="text-sm font-medium text-gray-900">{bank.bankName}</span>
      </div>
      <span
        className={[
          "text-xs font-semibold",
          reply === "YES"
            ? "text-green-700"
            : reply === "NO"
              ? "text-red-600"
              : reply === "TIMEOUT"
                ? "text-gray-500"
                : "text-gray-400",
        ].join(" ")}
      >
        {statusLabel}
      </span>
    </li>
  );
}

export function BroadcastStatusPanel({
  elapsedSeconds,
  banks,
  status,
  error,
}: BroadcastStatusPanelProps): React.ReactElement {
  const firstYes = banks.find((b) => b.reply === "YES");

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
        <XCircle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {status === "CONFIRMED" ? (
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          ) : status === "FAILED" ? (
            <XCircle className="w-6 h-6 text-red-500" />
          ) : (
            <Loader2 className="w-6 h-6 text-hemosync-navy animate-spin" />
          )}
          <h2 className="text-lg font-bold text-gray-900">
            {status === "CONFIRMED"
              ? "Supply Confirmed"
              : status === "FAILED"
                ? "No Supply Found"
                : status === "FALLBACK"
                  ? "Escalated to Donors"
                  : "Broadcasting to Banks…"}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 text-gray-500">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-mono">{formatElapsed(elapsedSeconds)}</span>
        </div>
      </div>

      {/* First YES notification */}
      {firstYes && status !== "CONFIRMED" && (
        <div className="p-3 bg-green-50 border border-green-300 rounded-lg text-sm text-green-800 font-medium">
          Confirming with {firstYes.bankName}…
        </div>
      )}

      {/* Banks list */}
      {banks.length > 0 ? (
        <ul className="space-y-2">
          {banks.map((bank) => (
            <BankRow key={bank.bankId} bank={bank} />
          ))}
        </ul>
      ) : (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Contacting blood banks…</span>
        </div>
      )}
    </div>
  );
}
