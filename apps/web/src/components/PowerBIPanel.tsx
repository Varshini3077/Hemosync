import React from "react";
import { useEmbedToken } from "@/hooks/useEmbedToken";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

// ---------------------------------------------------------------------------
// Static fallback data shown when VITE_POWERBI_ENABLED=false
// ---------------------------------------------------------------------------

const RESPONSE_TIME_DATA = [
  { bank: "City Blood Bank", avgMinutes: 8 },
  { bank: "Metro Hospital", avgMinutes: 12 },
  { bank: "Red Cross", avgMinutes: 6 },
  { bank: "National Bank", avgMinutes: 15 },
  { bank: "St. Mary's", avgMinutes: 10 },
];

const RELIABILITY_DATA = [
  { month: "Oct", rate: 88 },
  { month: "Nov", rate: 91 },
  { month: "Dec", rate: 85 },
  { month: "Jan", rate: 93 },
  { month: "Feb", rate: 96 },
  { month: "Mar", rate: 94 },
];

function LoadingSkeleton(): React.ReactElement {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-200 rounded w-1/3" />
      <div className="h-64 bg-gray-200 rounded-xl" />
      <div className="h-48 bg-gray-200 rounded-xl" />
    </div>
  );
}

function StaticFallback(): React.ReactElement {
  return (
    <div className="space-y-8">
      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        Power BI is disabled. Showing sample analytics data.
      </p>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Average Response Time by Bank (minutes)
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={RESPONSE_TIME_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="bank"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="avgMinutes" fill="#1B3A6B" radius={[4, 4, 0, 0]} name="Avg. Minutes" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          Network Reliability Rate (%)
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={RELIABILITY_DATA} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis domain={[80, 100]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="rate"
              stroke="#C8102E"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Reliability %"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function PowerBIPanel(): React.ReactElement {
  const powerBiEnabled = import.meta.env["VITE_POWERBI_ENABLED"] !== "false";
  const { embedUrl, token, isLoading, error } = useEmbedToken();

  if (!powerBiEnabled) {
    return <StaticFallback />;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !embedUrl || !token) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error ?? "Failed to load Power BI report. Showing fallback data."}
        </p>
        <StaticFallback />
      </div>
    );
  }

  // When Power BI credentials are available, render the embedded report.
  // powerbi-client-react is dynamically imported to avoid breaking the bundle
  // when the library is not configured.
  return (
    <PowerBIEmbed embedUrl={embedUrl} token={token} />
  );
}

interface PowerBIEmbedProps {
  readonly embedUrl: string;
  readonly token: string;
}

function PowerBIEmbed({ embedUrl, token }: PowerBIEmbedProps): React.ReactElement {
  const [EmbedComponent, setEmbedComponent] =
    React.useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    import("powerbi-client-react")
      .then((mod) => {
        setEmbedComponent(() => mod.PowerBIEmbed as React.ComponentType<Record<string, unknown>>);
      })
      .catch(() => {
        setLoadError(true);
      });
  }, []);

  if (loadError) {
    return <StaticFallback />;
  }

  if (!EmbedComponent) {
    return <LoadingSkeleton />;
  }

  return (
    <EmbedComponent
      embedConfig={{
        type: "report",
        embedUrl,
        accessToken: token,
        tokenType: 1, // Embed token
        settings: {
          panes: { filters: { visible: false }, pageNavigation: { visible: true } },
        },
      }}
      cssClassName="h-[600px] w-full rounded-xl overflow-hidden border border-gray-200"
    />
  );
}
