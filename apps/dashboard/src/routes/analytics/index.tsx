import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@keyra/api-client";
import {
  Card,
  CardContent,
  PageHeader,
  Skeleton,
  StatCard,
  Button,
  EmptyState,
} from "@/components/ui";
import {
  BarChart3,
  Key,
  Monitor,
  Activity,
  Package,
  TrendingUp,
} from "lucide-react";

const PERIODS: { value: "7d" | "30d" | "90d"; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

const TYPE_COLORS: Record<string, string> = {
  trial: "bg-violet-500",
  free: "bg-slate-500",
  personal: "bg-sky-500",
  professional: "bg-blue-500",
  business: "bg-indigo-500",
  enterprise: "bg-amber-500",
};

function LineChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const width = 600;
  const height = 160;
  const padding = { top: 10, right: 10, bottom: 24, left: 32 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const stepX = data.length > 1 ? chartW / (data.length - 1) : chartW;

  const points = data.map((d, i) => ({
    x: padding.left + i * stepX,
    y: padding.top + chartH - (d.count / max) * chartH,
    ...d,
  }));

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((max / yTicks) * i),
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-40"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="text-muted-foreground/40">
        {ticks.map((t, i) => {
          const y = padding.top + chartH - (t / max) * chartH;
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="currentColor"
                strokeWidth="1"
              />
              <text
                x={padding.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-current text-[10px]"
              >
                {t}
              </text>
            </g>
          );
        })}
      </g>
      <path d={areaD} fill="url(#lineArea)" className="text-primary" />
      <path
        d={pathD}
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        className="text-primary"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" className="fill-primary" />
      ))}
    </svg>
  );
}

function BarChart({ data }: { data: { type: string; count: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="space-y-2">
      {data.map((row) => {
        const pct = (row.count / max) * 100;
        return (
          <div key={row.type} className="flex items-center gap-3 text-sm">
            <div className="w-24 capitalize text-muted-foreground">
              {row.type}
            </div>
            <div className="flex-1 h-6 rounded-md bg-muted overflow-hidden">
              <div
                className={`h-full ${TYPE_COLORS[row.type] || "bg-slate-500"} transition-all`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-12 text-right tabular-nums text-xs">
              {row.count}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("7d");

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: async () => {
      const res = await analyticsApi.overview();
      return res.data.data;
    },
  });

  const { data: byType, isLoading: byTypeLoading } = useQuery({
    queryKey: ["analytics-by-type"],
    queryFn: async () => {
      const res = await analyticsApi.licensesByType();
      return res.data.data as { type: string; count: number }[];
    },
  });

  const { data: timeSeries, isLoading: timeSeriesLoading } = useQuery({
    queryKey: ["analytics-time-series", period],
    queryFn: async () => {
      const res = await analyticsApi.activationsOverTime({ period });
      return res.data.data as { date: string; count: number }[];
    },
  });

  const { data: topProducts, isLoading: topProductsLoading } = useQuery({
    queryKey: ["analytics-top-products"],
    queryFn: async () => {
      const res = await analyticsApi.topProducts({ limit: 5 });
      return res.data.data as {
        id: string;
        name: string;
        license_count: number;
        active_count: number;
      }[];
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Insights into your license management"
        icon={BarChart3}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {overviewLoading || !overview ? (
          [...Array(4)].map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
              <Skeleton className="mt-2 h-3 w-20" />
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Active Licenses"
              value={overview.licenses.active}
              icon={Key}
              description={`${overview.licenses.total} total`}
            />
            <StatCard
              title="Devices"
              value={overview.devices}
              icon={Monitor}
              description="Distinct devices"
            />
            <StatCard
              title="Activations"
              value={overview.activations}
              icon={Activity}
              description="Total verifications"
            />
            <StatCard
              title="Products"
              value={overview.products}
              icon={Package}
              description="In your org"
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div>
              <h2 className="text-sm font-semibold">Activations Over Time</h2>
              <p className="text-xs text-muted-foreground">
                Daily activation count
              </p>
            </div>
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <Button
                  key={p.value}
                  variant={period === p.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPeriod(p.value)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <CardContent className="p-5">
            {timeSeriesLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : timeSeries && timeSeries.length > 0 ? (
              <LineChart data={timeSeries} />
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No data"
                description="No activations in this period"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold">Licenses by Type</h2>
            <p className="text-xs text-muted-foreground">
              Distribution across license types
            </p>
          </div>
          <CardContent className="p-5">
            {byTypeLoading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : byType && byType.length > 0 ? (
              <BarChart data={byType} />
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No data"
                description="No licenses yet"
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">Top Products</h2>
          <p className="text-xs text-muted-foreground">
            Most licensed products in your org
          </p>
        </div>
        <CardContent className="p-0">
          {topProductsLoading ? (
            <div className="p-5 space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : topProducts && topProducts.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 text-left">Product</th>
                  <th className="px-5 py-2 text-right">Total</th>
                  <th className="px-5 py-2 text-right">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3">{p.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {p.license_count}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-emerald-600">
                      {p.active_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon={Package}
              title="No products"
              description="Create a product to see analytics"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
