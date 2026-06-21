import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { licensesApi, productsApi, type LicenseType } from "@keyra/api-client";
import {
  Button,
  Input,
  PageHeader,
  Skeleton,
  StatusBadge,
  EmptyState,
  ConfirmDialog,
  DataTable,
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
  useZodForm,
  DateField,
  SelectField,
  NumberField,
} from "@/components/ui/form";
import {
  createLicenseFormSchema,
  createLicenseDefaults,
  editLicenseFormSchema,
  editLicenseDefaults,
  licenseTypeOptions,
} from "@keyra/shared-validation";
import {
  Plus,
  Loader2,
  Copy,
  Key,
  Pencil,
  Trash2,
  ShieldOff,
  Shield,
  Search,
  Copy as CopyIcon,
} from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/error-message";
import { formatRelativeTime } from "@/lib/date";
import type { ColumnDef } from "@tanstack/react-table";

const LICENSE_TYPE_BADGE_MAP: Record<string, string> = Object.fromEntries(
  licenseTypeOptions.map((o) => [o.value, o.variant]),
);

const PAGE_SIZE = 20;

type License = {
  id: string;
  product_id: string;
  product_name: string;
  type: string;
  status: string;
  max_devices: number;
  expires_at: string | null;
  created_at: string;
};

function LicenseRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-4 w-8" />
    </div>
  );
}

export default function Licenses() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [createdLicenseKey, setCreatedLicenseKey] = useState<string | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const createForm = useZodForm({
    schema: createLicenseFormSchema,
    defaultValues: createLicenseDefaults,
  });

  const editForm = useZodForm({
    schema: editLicenseFormSchema,
    defaultValues: editLicenseDefaults,
  });

  useEffect(() => {
    if (editingLicense) {
      editForm.form.reset({
        type: editingLicense.type as LicenseType,
        maxDevices: editingLicense.max_devices,
        expiresAt: editingLicense.expires_at || "",
      });
    }
  }, [editingLicense, editForm.form]);

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await productsApi.list();
      return res.data.data;
    },
  });

  const { data: licensesResponse, isLoading } = useQuery({
    queryKey: ["licenses", cursor, filterStatus],
    queryFn: async () => {
      const res = await licensesApi.list({
        limit: PAGE_SIZE,
        cursor: cursor || undefined,
        status: filterStatus === "all" ? undefined : filterStatus,
      });
      return res.data;
    },
  });

  const licenses: License[] = licensesResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: {
      product_id: string;
      type: LicenseType;
      max_devices?: number;
      expires_at?: string;
    }) => {
      const res = await licensesApi.create(data);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      setCreatedLicenseKey(data.key);
      setIsCreating(false);
      createForm.form.reset(createLicenseDefaults);
      toast.success("License created");
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, "Failed to create license"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: { type?: LicenseType; max_devices?: number; expires_at?: string };
    }) => {
      const res = await licensesApi.update(id, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      setEditingLicense(null);
      toast.success("License updated");
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, "Failed to update license"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      await licensesApi.delete(licenseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      setDeleteConfirm(null);
      toast.success("License deleted");
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, "Failed to delete license"));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      await licensesApi.revoke(licenseId, { reason: "Revoked by admin" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["licenses"] });
      toast.success("License revoked");
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, "Failed to revoke license"));
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const filteredLicenses = licenses.filter((l) => {
    if (!search) return true;
    return (
      l.id.toLowerCase().includes(search.toLowerCase()) ||
      l.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      l.type.toLowerCase().includes(search.toLowerCase())
    );
  });

  const statusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success" as const;
      case "revoked":
        return "danger" as const;
      case "expired":
        return "warning" as const;
      default:
        return "default" as const;
    }
  };

  const typeVariant = (type: string) => {
    return (
      (LICENSE_TYPE_BADGE_MAP[type] as
        | "violet"
        | "slate"
        | "info"
        | "success"
        | "warning"
        | "danger"
        | undefined) || ("default" as const)
    );
  };

  const columns: ColumnDef<License>[] = [
    {
      accessorKey: "id",
      header: "License Key",
      cell: ({ row }) => (
        <button
          onClick={() => copyToClipboard(row.original.id)}
          className="font-mono text-xs hover:text-primary inline-flex items-center gap-1 group"
        >
          <span className="truncate max-w-[160px]">
            {row.original.id.slice(0, 16)}...
          </span>
          <CopyIcon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ),
    },
    {
      accessorKey: "product_name",
      header: "Product",
      cell: ({ row }) => (
        <span className="text-sm">{row.original.product_name || "-"}</span>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => (
        <StatusBadge variant={typeVariant(row.original.type)}>
          {row.original.type}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge variant={statusVariant(row.original.status)}>
          {row.original.status}
        </StatusBadge>
      ),
    },
    {
      accessorKey: "max_devices",
      header: "Devices",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.max_devices}</span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Created",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatRelativeTime(row.original.created_at)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          {row.original.status === "active" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => revokeMutation.mutate(row.original.id)}
              title="Revoke"
            >
              <ShieldOff className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              editForm.form.reset({
                type: row.original.type as any,
                maxDevices: row.original.max_devices,
                expiresAt: row.original.expires_at || "",
              });
              setEditingLicense(row.original);
            }}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteConfirm(row.original.id)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Licenses"
        description="Create and manage license keys"
        icon={Key}
        actions={
          <Button
            onClick={() => setIsCreating(true)}
            disabled={!products?.length}
          >
            <Plus className="mr-2 h-4 w-4" />
            New License
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search licenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {["all", "active", "revoked", "expired"].map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setFilterStatus(status);
                setCursor(null);
              }}
              className="capitalize"
            >
              {status}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1 rounded-xl border border-border bg-card overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <LicenseRowSkeleton key={i} />
          ))}
        </div>
      ) : filteredLicenses.length > 0 ? (
        <DataTable
          columns={columns}
          data={filteredLicenses}
          searchPlaceholder="Search..."
          toolbarRight={null}
        />
      ) : (
        <EmptyState
          icon={Key}
          title={
            search || filterStatus !== "all"
              ? "No licenses match"
              : "No licenses yet"
          }
          description={
            search || filterStatus !== "all"
              ? "Try a different filter or search"
              : "Create your first license to start activating devices"
          }
          primaryAction={
            !search && filterStatus === "all" && products?.length
              ? {
                  label: "Create License",
                  onClick: () => setIsCreating(true),
                  icon: Plus,
                }
              : undefined
          }
        />
      )}

      <Dialog
        open={isCreating}
        onOpenChange={(open) => {
          if (!open) {
            createForm.form.reset(createLicenseDefaults);
          }
          setIsCreating(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create License</DialogTitle>
            <DialogDescription>Generate a new license key</DialogDescription>
          </DialogHeader>
          <Form {...createForm.form}>
            <form
              id="create-license-form"
              onSubmit={createForm.form.handleSubmit((values) => {
                createMutation.mutate({
                  product_id: values.productId,
                  type: values.type,
                  max_devices: values.maxDevices,
                  expires_at: values.expiresAt || undefined,
                });
              })}
              className="space-y-4"
            >
              <FormField
                control={createForm.form.control}
                name="productId"
                render={() => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <FormControl>
                      <SelectField
                        name="productId"
                        options={
                          products?.map((p: any) => ({
                            value: p.id,
                            label: p.name,
                          })) || []
                        }
                        placeholder="Select a product"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={createForm.form.control}
                  name="type"
                  render={() => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <FormControl>
                        <SelectField
                          name="type"
                          options={licenseTypeOptions}
                          placeholder="Select type"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.form.control}
                  name="maxDevices"
                  render={() => (
                    <FormItem>
                      <FormLabel>Max Devices</FormLabel>
                      <FormControl>
                        <NumberField
                          name="maxDevices"
                          placeholder="2"
                          min={1}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={createForm.form.control}
                name="expiresAt"
                render={() => (
                  <FormItem>
                    <FormLabel>Expires At (optional)</FormLabel>
                    <FormControl>
                      <DateField
                        name="expiresAt"
                        placeholder="No expiration"
                        showTime
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
        open={!!editingLicense}
        onOpenChange={(open) => {
          if (!open) {
            editForm.form.reset(editLicenseDefaults);
            setEditingLicense(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit License</DialogTitle>
            <DialogDescription>Update license settings</DialogDescription>
          </DialogHeader>
          <Form {...editForm.form}>
            <form
              id="edit-license-form"
              onSubmit={editForm.form.handleSubmit((values) => {
                if (!editingLicense) return;
                updateMutation.mutate({
                  id: editingLicense.id,
                  data: {
                    type: values.type as LicenseType | undefined,
                    max_devices: values.maxDevices,
                    expires_at: values.expiresAt || undefined,
                  },
                });
              })}
              className="space-y-4"
            >
              <FormField
                control={editForm.form.control}
                name="type"
                render={() => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <FormControl>
                      <SelectField
                        name="type"
                        options={licenseTypeOptions}
                        placeholder="Select type"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.form.control}
                name="maxDevices"
                render={() => (
                  <FormItem>
                    <FormLabel>Max Devices</FormLabel>
                    <FormControl>
                      <NumberField name="maxDevices" placeholder="2" min={1} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.form.control}
                name="expiresAt"
                render={() => (
                  <FormItem>
                    <FormLabel>Expires At (optional)</FormLabel>
                    <FormControl>
                      <DateField
                        name="expiresAt"
                        placeholder="No expiration"
                        showTime
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
                  onClick={() => setEditingLicense(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
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
        open={!!createdLicenseKey}
        onOpenChange={(open) => !open && setCreatedLicenseKey(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Shield className="h-5 w-5" />
              License Key Created
            </DialogTitle>
            <DialogDescription>
              Copy this key now. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              value={createdLicenseKey || ""}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              onClick={() =>
                createdLicenseKey && copyToClipboard(createdLicenseKey)
              }
              variant="default"
              size="icon"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreatedLicenseKey(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete License"
        description="Are you sure you want to delete this license? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
      />
    </div>
  );
}
