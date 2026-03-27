import React from "react";
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { PowerBIPanel } from "@/components/PowerBIPanel";

interface SummaryStatProps {
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly value: string | number;
  readonly trend?: string;
  readonly trendPositive?: boolean;
}

function SummaryStat({
  icon,
  label,
  value,
  trend,
  trendPositive,
}: SummaryStatProps): React.ReactElement {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-blue-50 rounded-lg text-hemosync-navy">
          {icon}
        </div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {trend && (
        <p
          className={[
            "text-xs mt-1 font-medium",
            trendPositive ? "text-green-600" : "text-red-600",
          ].join(" ")}
        >
          {trend}
        </p>
      )}
    </div>
  );
}

export function Analytics(): React.ReactElement {
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Network performance and supply chain metrics
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryStat
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Fulfilment Rate"
          value="94.2%"
          trend="↑ 2.1% vs last month"
          trendPositive
        />
        <SummaryStat
          icon={<Clock className="w-5 h-5" />}
          label="Avg Response"
          value="8.4 min"
          trend="↓ 1.2 min improvement"
          trendPositive
        />
        <SummaryStat
          icon={<TrendingUp className="w-5 h-5" />}
          label="Total Requests"
          value={312}
          trend="This month"
        />
        <SummaryStat
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Escalations"
          value={18}
          trend="↑ 3 from last month"
          trendPositive={false}
        />
      </div>

      {/* Power BI panel */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-6">
          Detailed Analytics
        </h2>
        <PowerBIPanel />
      </div>
    </div>
  );
}
