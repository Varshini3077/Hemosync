import { useState, useEffect, useRef, useCallback } from "react";
import { getRequestStatus } from "@/lib/api-client";

export interface BankStatus {
  readonly bankId: string;
  readonly bankName: string;
  readonly reply: "YES" | "NO" | "CHECK" | "TIMEOUT" | "PENDING";
}

export interface ConfirmedBankInfo {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly distanceKm: number;
  readonly location: { readonly lat: number; readonly lng: number };
}

export interface BroadcastStatusHook {
  status: "PENDING" | "BROADCASTING" | "CONFIRMED" | "FAILED" | "FALLBACK" | null;
  banks: ReadonlyArray<BankStatus>;
  confirmedBank: ConfirmedBankInfo | null;
  elapsedSeconds: number;
  error: string | null;
}

const POLL_INTERVAL_MS = 3000;

export function useBroadcastStatus(requestId: string | null): BroadcastStatusHook {
  const [status, setStatus] = useState<BroadcastStatusHook["status"]>(null);
  const [banks, setBanks] = useState<ReadonlyArray<BankStatus>>([]);
  const [confirmedBank, setConfirmedBank] = useState<ConfirmedBankInfo | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!requestId || !isActiveRef.current) return;

    try {
      const data = await getRequestStatus(requestId);
      setStatus(data.status);
      setBanks(
        data.banks.map((b) => ({
          bankId: b.bankId,
          bankName: b.bankName,
          reply: b.reply,
        })),
      );

      if (data.confirmedBank) {
        setConfirmedBank(data.confirmedBank);
      }

      if (data.status === "CONFIRMED" || data.status === "FAILED") {
        stopPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch status");
    }
  }, [requestId, stopPolling]);

  useEffect(() => {
    if (!requestId) return;

    isActiveRef.current = true;
    setElapsedSeconds(0);

    void poll();

    intervalRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);

    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    return () => {
      isActiveRef.current = false;
      stopPolling();
    };
  }, [requestId, poll, stopPolling]);

  return { status, banks, confirmedBank, elapsedSeconds, error };
}
