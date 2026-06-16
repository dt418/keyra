import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { webhooksApi } from "@keyra/api-client";
import {
  Button,
  Input,
  Label,
  PageHeader,
  Skeleton,
  StatusBadge,
  EmptyState,
  ConfirmDialog,
} from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Webhook,
  Plus,
  Trash2,
  Copy,
  Zap,
  Loader2,
  History,
  Power,
  PowerOff,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import { formatRelativeTime } from "@/lib/date";

const WEBHOOK_EVENTS = [
  { value: "license.created", label: "License Created" },
  { value: "license.updated", label: "License Updated" },
  { value: "license.revoked", label: "License Revoked" },
  { value: "license.expired", label: "License Expired" },
  { value: "device.activated", label: "Device Activated" },
  { value: "device.deactivated", label: "Device Deactivated" },
];

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface Delivery {
  id: string;
  event_type: string;
  status: string;
  response_code: number | null;
  attempts: number;
  last_attempt_at: string | null;
  created_at: string;
}

export default function Webhooks() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ url: "", events: [] as string[] });
  const [createdSecret, setCreatedSecret] = useState<{
    id: string;
    secret: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewingDeliveries, setViewingDeliveries] = useState<Webhook | null>(
    null,
  );

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const res = await webhooksApi.list({ limit: 50 });
      return res.data.data as Webhook[];
    },
  });

  const { data: deliveries } = useQuery({
    queryKey: ["webhook-deliveries", viewingDeliveries?.id],
    queryFn: async () => {
      if (!viewingDeliveries) return [];
      const res = await webhooksApi.deliveries(viewingDeliveries.id, {
        limit: 50,
      });
      return res.data.data as Delivery[];
    },
    enabled: !!viewingDeliveries,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { url: string; events: string[] }) => {
      const res = await webhooksApi.create(data);
      return res.data.data as { id: string; secret: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setIsCreating(false);
      setForm({ url: "", events: [] });
      setCreatedSecret({ id: data.id, secret: data.secret });
    },
    onError: (err: unknown) =>
      toast.error(errorMessage(err, "Failed to create webhook")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await webhooksApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setDeleteConfirm(null);
      toast.success("Webhook deleted");
    },
    onError: (err: unknown) =>
      toast.error(errorMessage(err, "Failed to delete webhook")),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await webhooksApi.update(id, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["webhook-deliveries"] });
    },
    onError: (err: unknown) =>
      toast.error(errorMessage(err, "Failed to update webhook")),
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await webhooksApi.test(id);
      return res.data.data as {
        success: boolean;
        response_code: number | null;
        error: string | null;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["webhook-deliveries"] });
      if (data.success) {
        toast.success(`Test sent successfully (${data.response_code})`);
      } else {
        toast.error(`Test failed${data.error ? `: ${data.error}` : ""}`);
      }
    },
    onError: (err: unknown) =>
      toast.error(errorMessage(err, "Failed to test webhook")),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const toggleEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhooks"
        description="Send real-time event notifications to your services"
        icon={Webhook}
        actions={
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Webhook
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : webhooks && webhooks.length > 0 ? (
        <div className="grid gap-3">
          {webhooks.map((wh) => (
            <div
              key={wh.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <StatusBadge variant={wh.active ? "success" : "default"}>
                      {wh.active ? "Active" : "Paused"}
                    </StatusBadge>
                    <code className="font-mono text-xs text-muted-foreground truncate">
                      {wh.url}
                    </code>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {wh.events.map((e) => (
                      <span
                        key={e}
                        className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Created {formatRelativeTime(wh.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => testMutation.mutate(wh.id)}
                    title="Send test"
                    disabled={testMutation.isPending}
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setViewingDeliveries(wh)}
                    title="View deliveries"
                  >
                    <History className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      toggleMutation.mutate({ id: wh.id, active: !wh.active })
                    }
                    title={wh.active ? "Pause" : "Activate"}
                  >
                    {wh.active ? (
                      <PowerOff className="h-3.5 w-3.5" />
                    ) : (
                      <Power className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirm(wh.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Webhook}
          title="No webhooks configured"
          description="Create a webhook to receive real-time event notifications"
          primaryAction={{
            label: "Create Webhook",
            onClick: () => setIsCreating(true),
            icon: Plus,
          }}
        />
      )}

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Receive events at the URL you provide
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (form.url && form.events.length > 0) {
                createMutation.mutate(form);
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="url">Endpoint URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://api.example.com/webhooks"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Events</Label>
              <div className="mt-2 space-y-1.5 rounded-md border border-border p-3 max-h-60 overflow-y-auto">
                {WEBHOOK_EVENTS.map((e) => (
                  <label
                    key={e.value}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={form.events.includes(e.value)}
                      onChange={() => toggleEvent(e.value)}
                      className="h-3.5 w-3.5 rounded border-input"
                    />
                    <span className="font-mono text-xs">{e.value}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreating(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending ||
                  !form.url ||
                  form.events.length === 0
                }
              >
                {createMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!createdSecret}
        onOpenChange={(open) => !open && setCreatedSecret(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Zap className="h-5 w-5" />
              Webhook Created
            </DialogTitle>
            <DialogDescription>
              Save this signing secret. You won't see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={createdSecret?.secret || ""}
              readOnly
              className="font-mono text-xs"
            />
            <Button
              onClick={() =>
                createdSecret && copyToClipboard(createdSecret.secret)
              }
              variant="default"
              size="icon"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatedSecret(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewingDeliveries}
        onOpenChange={(open) => !open && setViewingDeliveries(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Delivery History</DialogTitle>
            <DialogDescription className="truncate">
              {viewingDeliveries?.url}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {deliveries && deliveries.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Event</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-left">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deliveries.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 font-mono text-xs">
                        {d.event_type}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          variant={
                            d.status === "success"
                              ? "success"
                              : d.status === "failed"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {d.status}
                        </StatusBadge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {d.response_code ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {formatRelativeTime(d.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState
                icon={History}
                title="No deliveries"
                description="No events have been sent yet"
              />
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewingDeliveries(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete Webhook"
        description="Are you sure you want to delete this webhook? Future events will not be delivered."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
      />
    </div>
  );
}
