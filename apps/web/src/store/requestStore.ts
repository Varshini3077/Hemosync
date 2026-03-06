import { create } from "zustand";
import type { BloodType, BloodComponent, DonorScore, BroadcastResult } from "@hemosync/types";

export interface CurrentRequest {
  readonly id: string;
  readonly bloodType: BloodType;
  readonly component: BloodComponent;
  readonly units: number;
  readonly urgency: "CRITICAL" | "HIGH" | "NORMAL";
}

export interface RankedBank {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly distanceKm: number;
  readonly estimatedDriveMinutes: number;
  readonly compositeScore: number;
  readonly reliabilityScore: number;
}

export interface BroadcastStatusState {
  readonly status: "PENDING" | "BROADCASTING" | "CONFIRMED" | "FAILED" | "FALLBACK";
  readonly banks: ReadonlyArray<{
    readonly bankId: string;
    readonly bankName: string;
    readonly reply: "YES" | "NO" | "CHECK" | "TIMEOUT" | "PENDING";
  }>;
}

export interface ConfirmedBank {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly distanceKm: number;
  readonly location: { readonly lat: number; readonly lng: number };
}

interface RequestStore {
  currentRequest: CurrentRequest | null;
  broadcastStatus: BroadcastStatusState | null;
  rankedBanks: ReadonlyArray<RankedBank>;
  confirmedBank: ConfirmedBank | null;
  fallbackDonors: ReadonlyArray<DonorScore>;
  fallbackBroadcastResults: ReadonlyArray<BroadcastResult>;
  isListening: boolean;

  setRequest: (request: CurrentRequest) => void;
  updateBroadcastStatus: (status: BroadcastStatusState) => void;
  setRankedBanks: (banks: ReadonlyArray<RankedBank>) => void;
  setConfirmed: (bank: ConfirmedBank) => void;
  setFallbackDonors: (
    donors: ReadonlyArray<DonorScore>,
    broadcastResults: ReadonlyArray<BroadcastResult>,
  ) => void;
  setIsListening: (listening: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentRequest: null,
  broadcastStatus: null,
  rankedBanks: [] as ReadonlyArray<RankedBank>,
  confirmedBank: null,
  fallbackDonors: [] as ReadonlyArray<DonorScore>,
  fallbackBroadcastResults: [] as ReadonlyArray<BroadcastResult>,
  isListening: false,
} as const;

export const useRequestStore = create<RequestStore>((set) => ({
  ...initialState,

  setRequest: (request) => set({ currentRequest: request }),

  updateBroadcastStatus: (status) => set({ broadcastStatus: status }),

  setRankedBanks: (banks) => set({ rankedBanks: banks }),

  setConfirmed: (bank) =>
    set({
      confirmedBank: bank,
      broadcastStatus: {
        status: "CONFIRMED",
        banks: [],
      },
    }),

  setFallbackDonors: (donors, broadcastResults) =>
    set({
      fallbackDonors: donors,
      fallbackBroadcastResults: broadcastResults,
    }),

  setIsListening: (listening) => set({ isListening: listening }),

  reset: () => set(initialState),
}));
