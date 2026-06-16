import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { auditLogsApi } from "@keyra/api-client";
import {
  PageHeader,
  Skeleton,
  EmptyState,
  StatusBadge,
  Input,
} from "@/components/ui";
import { FileText, Search, Download, Activity } from "lucide-react";
import { formatRelativeTime } from "@/lib/date";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface AuditLog {
  id: string;
  action: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  metadata: unknown;
  created_at: string;
}

const ACTION_VARIANTS: Record<
  string,
  "default" | "success" | "warning" | "danger" | "info" | "violet" | "slate"
> = {
  "user.registered": "success",
  "user.login": "info",
  "user.logout": "slate",
  "license.created": "success",
  "license.updated": "info",
  "license.revoked": "danger",
  "license.deleted": "danger",
  "product.created": "success",
  "product.deleted": "danger",
  "organization.created": "success",
  "webhook.created": "violet",
  "webhook.deleted": "danger",
};

function actionVariant(action: string) {
  return ACTION_VARIANTS[action] || "default";
}

function exportCsv(logs: AuditLog[]) {
  const headers = [
    "id",
    "action",
    "user",
    "resource_type",
    "resource_id",
    "ip_address",
    "created_at",
  ];
  const rows = logs.map((l) => [
    l.id,
    l.action,
    l.user_email || l.user_id || "",
    l.resource_type,
    l.resource_id,
    l.ip_address || "",
    l.created_at,
  ]);
  const csv = [headers, ...rows]
    .map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [resourceFilter, setResourceFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const res = await auditLogsApi.list({ limit: 100 });
      return res.data.data as AuditLog[];
    },
  });

  const logs = data || [];
  const actions = Array.from(new Set(logs.map((l) => l.action))).sort();
  const resources = Array.from(
    new Set(logs.map((l) => l.resource_type)),
  ).sort();

  const filtered = logs.filter((l) => {
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (resourceFilter !== "all" && l.resource_type !== resourceFilter)
      return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        l.action.toLowerCase().includes(q) ||
        l.resource_id.toLowerCase().includes(q) ||
        (l.user_email || "").toLowerCase().includes(q) ||
        (l.ip_address || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Track all administrative actions across your organization"
        icon={FileText}
        actions={
          <button
            onClick={() => exportCsv(filtered)}
            disabled={!filtered.length}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={actionFilter}
          onValueChange={(v) => v && setActionFilter(v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={resourceFilter}
          onValueChange={(v) => v && setResourceFilter(v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resources</SelectItem>
            {resources.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-1 rounded-xl border border-border bg-card overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/30">
              <tr className="text-xs font-medium text-muted-foreground">
                <th className="px-4 py-2.5 text-left">Action</th>
                <th className="px-4 py-2.5 text-left">User</th>
                <th className="px-4 py-2.5 text-left">Resource</th>
                <th className="px-4 py-2.5 text-left">IP</th>
                <th className="px-4 py-2.5 text-right">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((log) => (
                <tr
                  key={log.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <StatusBadge variant={actionVariant(log.action)}>
                      {log.action}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log.user_email || log.user_name || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{log.resource_type}</div>
                    <div className="font-mono text-[10px] text-muted-foreground truncate max-w-[180px]">
                      {log.resource_id}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                    {log.ip_address || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(log.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={Activity}
          title={
            search || actionFilter !== "all" || resourceFilter !== "all"
              ? "No matching logs"
              : "No audit logs yet"
          }
          description={
            search || actionFilter !== "all" || resourceFilter !== "all"
              ? "Try adjusting your filters"
              : "Administrative actions will appear here"
          }
        />
      )}
    </div>
  );
}
