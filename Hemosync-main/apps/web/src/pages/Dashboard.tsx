import React from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Clock,
  Building2,
  Droplets,
  Plus,
  ChevronRight,
} from "lucide-react";
import { StatusIndicator } from "@hemosync/ui";
import { UrgencyPill } from "@hemosync/ui";
import { BloodTypeBadge } from "@hemosync/ui";
import { PowerBIPanel } from "@/components/PowerBIPanel";

interface StatCardProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string | number;
  readonly sub?: string;
}

function StatCard({ icon, label, value, sub }: StatCardProps): React.ReactElement {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 shadow-sm">
      <div className="p-2 bg-blue-50 rounded-lg text-hemosync-navy">{icon}</div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// Mock data for demonstration — in production, fetch from /api/requests
const MOCK_REQUESTS = [
  {
    id: "req-001",
    bloodType: "O+" as const,
    component: "PRBC" as const,
    units: 3,
    urgency: "CRITICAL" as const,
    status: "CONFIRMED" as const,
    createdAt: "2 min ago",
    bank: "City Blood Bank",
  },
  {
    id: "req-002",
    bloodType: "A-" as const,
    component: "FFP" as const,
    units: 2,
    urgency: "HIGH" as const,
    status: "BROADCASTING" as const,
    createdAt: "18 min ago",
    bank: null,
  },
  {
    id: "req-003",
    bloodType: "B+" as const,
    component: "PLATELETS" as const,
    units: 1,
    urgency: "NORMAL" as const,
    status: "CONFIRMED" as const,
    createdAt: "1 hr ago",
    bank: "Metro Hospital",
  },
  {
    id: "req-004",
    bloodType: "AB-" as const,
    component: "WHOLE_BLOOD" as const,
    units: 4,
    urgency: "CRITICAL" as const,
    status: "FAILED" as const,
    createdAt: "3 hr ago",
    bank: null,
  },
];

export function Dashboard(): React.ReactElement {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Emergency blood coordination overview
          </p>
        </div>
        <Link
          to="/requests/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-hemosync-red text-white font-semibold rounded-lg hover:opacity-90 transition-opacity text-sm focus:outline-none focus:ring-4 focus:ring-red-300"
        >
          <Plus className="w-4 h-4" />
          New Request
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Today's Requests"
          value={12}
          sub="↑ 3 from yesterday"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Avg Confirmation"
          value="8.4 min"
          sub="Last 7 days"
        />
        <StatCard
          icon={<Building2 className="w-5 h-5" />}
          label="Active Banks"
          value={24}
          sub="In broadcast pool"
        />
        <StatCard
          icon={<Droplets className="w-5 h-5" />}
          label="Units Saved"
          value={148}
          sub="This month"
        />
      </div>

      {/* Recent requests */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Recent Requests
          </h2>
          <span className="text-xs text-gray-400">Last 24 hours</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Blood / Component
                </th>
                <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Units
                </th>
                <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Urgency
                </th>
                <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Status
                </th>
                <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Bank
                </th>
                <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Created
                </th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MOCK_REQUESTS.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <BloodTypeBadge bloodType={req.bloodType} />
                      <span className="text-gray-600">{req.component}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-700 font-medium">
                    {req.units}
                  </td>
                  <td className="px-5 py-3">
                    <UrgencyPill urgency={req.urgency} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusIndicator status={req.status} />
                  </td>
                  <td className="px-5 py-3 text-gray-600 text-xs">
                    {req.bank ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-400 text-xs">
                    {req.createdAt}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      to={`/requests/${req.id}`}
                      className="text-hemosync-navy hover:underline inline-flex items-center gap-0.5"
                      aria-label={`View details for request ${req.id}`}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {MOCK_REQUESTS.length === 0 && (
          <div className="px-5 py-10 text-center text-gray-400 text-sm">
            No requests yet today.
          </div>
        )}
      </div>

      {/* Analytics panel */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">
          Analytics Overview
        </h2>
        <PowerBIPanel />
      </div>
    </div>
  );
}
