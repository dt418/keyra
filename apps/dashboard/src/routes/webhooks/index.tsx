import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { webhooksApi } from "@keyra/api-client";
import {
  Button,
  Input,
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
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  TextField,
  CheckboxField,
  MultiCheckboxField,
  useZodForm,
} from "@/components/ui/form";
import {
  createWebhookFormSchema,
  createWebhookDefaults,
  editWebhookFormSchema,
  editWebhookDefaults,
  webhookEventOptions,
  webhookEventLabels,
  type EditWebhookFormValues,
} from "@keyra/shared-validation";
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
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import { formatRelativeTime } from "@/lib/date";

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
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [createdSecret, setCreatedSecret] = useState<{
    id: string;
    secret: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [viewingDeliveries, setViewingDeliveries] = useState<Webhook | null>(
    null,
  );

  const createForm = useZodForm({
    schema: createWebhookFormSchema,
    defaultValues: createWebhookDefaults,
  });

  const editForm = useZodForm({
    schema: editWebhookFormSchema,
    defaultValues: editWebhookDefaults,
  });

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
    mutationFn: async (data: {
      url: string;
      events: string[];
      active: boolean;
    }) => {
      const res = await webhooksApi.create(data);
      return res.data.data as { id: string; secret: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setIsCreating(false);
      createForm.form.reset(createWebhookDefaults);
      setCreatedSecret({ id: data.id, secret: data.secret });
    },
    onError: (err: unknown) =>
      toast.error(errorMessage(err, "Failed to create webhook")),
  });

  const editMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { url: string; events: string[]; active: boolean };
    }) => {
      const res = await webhooksApi.update(id, data);
      return res.data.data as Webhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      queryClient.invalidateQueries({ queryKey: ["webhook-deliveries"] });
      setEditingWebhook(null);
      editForm.form.reset(editWebhookDefaults);
      toast.success("Webhook updated");
    },
    onError: (err: unknown) =>
      toast.error(errorMessage(err, "Failed to update webhook")),
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
                        {webhookEventLabels[
                          e as keyof typeof webhookEventLabels
                        ] ?? e}
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
                    className="h-8 w-8"
                    onClick={() => {
                      editForm.form.reset({
                        url: wh.url,
                        events: wh.events as EditWebhookFormValues["events"],
                        active: wh.active,
                      });
                      setEditingWebhook(wh);
                    }}
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
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

      <Dialog
        open={isCreating}
        onOpenChange={(open) => {
          if (!open) {
            createForm.form.reset(createWebhookDefaults);
          }
          setIsCreating(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
            <DialogDescription>
              Receive events at the URL you provide
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm.form}>
            <form
              id="create-webhook-form"
              onSubmit={createForm.form.handleSubmit((values) => {
                createMutation.mutate({
                  url: values.url.trim(),
                  events: values.events,
                  active: values.active,
                });
              })}
              className="space-y-4"
            >
              <FormField
                control={createForm.form.control}
                name="url"
                render={() => (
                  <FormItem>
                    <FormLabel>Endpoint URL</FormLabel>
                    <FormControl>
                      <TextField
                        name="url"
                        type="url"
                        placeholder="https://api.example.com/webhooks"
                        autoFocus
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.form.control}
                name="events"
                render={() => (
                  <FormItem>
                    <FormLabel>Events</FormLabel>
                    <FormControl>
                      <MultiCheckboxField
                        name="events"
                        options={webhookEventOptions}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingWebhook}
        onOpenChange={(open) => {
          if (!open) {
            editForm.form.reset(editWebhookDefaults);
            setEditingWebhook(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Webhook</DialogTitle>
            <DialogDescription>Update webhook configuration</DialogDescription>
          </DialogHeader>
          <Form {...editForm.form}>
            <form
              id="edit-webhook-form"
              onSubmit={editForm.form.handleSubmit((values) => {
                if (!editingWebhook) return;
                editMutation.mutate({
                  id: editingWebhook.id,
                  data: {
                    url: values.url.trim(),
                    events: values.events,
                    active: values.active,
                  },
                });
              })}
              className="space-y-4"
            >
              <FormField
                control={editForm.form.control}
                name="url"
                render={() => (
                  <FormItem>
                    <FormLabel>Endpoint URL</FormLabel>
                    <FormControl>
                      <TextField
                        name="url"
                        type="url"
                        placeholder="https://api.example.com/webhooks"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.form.control}
                name="events"
                render={() => (
                  <FormItem>
                    <FormLabel>Events</FormLabel>
                    <FormControl>
                      <MultiCheckboxField
                        name="events"
                        options={webhookEventOptions}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.form.control}
                name="active"
                render={() => (
                  <FormItem>
                    <FormControl>
                      <CheckboxField name="active" label="Active" />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingWebhook(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={editMutation.isPending}>
                  {editMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
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
