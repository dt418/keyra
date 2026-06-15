import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { licensesApi, productsApi, type LicenseType } from '@keyra/api-client';
import { Button, Input, Label, PageHeader, Skeleton, StatusBadge, EmptyState, ConfirmDialog, DataTable } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Loader2, Copy, Key, Pencil, Trash2, ShieldOff, Shield, Search, Copy as CopyIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/date';
import type { ColumnDef } from '@tanstack/react-table';

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

const LICENSE_TYPES: { value: LicenseType; label: string; variant: 'violet' | 'slate' | 'info' | 'success' | 'warning' | 'danger' }[] = [
  { value: 'trial', label: 'Trial', variant: 'violet' },
  { value: 'free', label: 'Free', variant: 'slate' },
  { value: 'personal', label: 'Personal', variant: 'info' },
  { value: 'professional', label: 'Professional', variant: 'info' },
  { value: 'business', label: 'Business', variant: 'info' },
  { value: 'enterprise', label: 'Enterprise', variant: 'warning' },
];

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
  const [newLicense, setNewLicense] = useState({
    productId: '',
    type: 'trial' as LicenseType,
    maxDevices: 1,
    expiresAt: '',
  });
  const [createdLicenseKey, setCreatedLicenseKey] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [cursor, setCursor] = useState<string | null>(null);
  const [editingLicense, setEditingLicense] = useState<License | null>(null);
  const [editForm, setEditForm] = useState({ type: 'trial' as LicenseType, maxDevices: 1, expiresAt: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await productsApi.list();
      return res.data.data;
    },
  });

  const { data: licensesResponse, isLoading } = useQuery({
    queryKey: ['licenses', cursor, filterStatus],
    queryFn: async () => {
      const res = await licensesApi.list({
        limit: PAGE_SIZE,
        cursor: cursor || undefined,
        status: filterStatus === 'all' ? undefined : filterStatus,
      });
      return res.data;
    },
  });

  const licenses: License[] = licensesResponse?.data || [];

  const createMutation = useMutation({
    mutationFn: async (data: { product_id: string; type: LicenseType; max_devices?: number; expires_at?: string }) => {
      const res = await licensesApi.create(data);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setCreatedLicenseKey(data.key);
      setIsCreating(false);
      setNewLicense({ productId: '', type: 'trial', maxDevices: 1, expiresAt: '' });
      toast.success('License created');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create license');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { type?: LicenseType; max_devices?: number; expires_at?: string } }) => {
      const res = await licensesApi.update(id, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setEditingLicense(null);
      toast.success('License updated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update license');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      await licensesApi.delete(licenseId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setDeleteConfirm(null);
      toast.success('License deleted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete license');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      await licensesApi.revoke(licenseId, { reason: 'Revoked by admin' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      toast.success('License revoked');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to revoke license');
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
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
      case 'active': return 'success' as const;
      case 'revoked': return 'danger' as const;
      case 'expired': return 'warning' as const;
      default: return 'default' as const;
    }
  };

  const typeVariant = (type: string) => {
    return LICENSE_TYPES.find((t) => t.value === type)?.variant || 'default' as const;
  };

  const columns: ColumnDef<License>[] = [
    {
      accessorKey: 'id',
      header: 'License Key',
      cell: ({ row }) => (
        <button
          onClick={() => copyToClipboard(row.original.id)}
          className="font-mono text-xs hover:text-primary inline-flex items-center gap-1 group"
        >
          <span className="truncate max-w-[160px]">{row.original.id.slice(0, 16)}...</span>
          <CopyIcon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      ),
    },
    {
      accessorKey: 'product_name',
      header: 'Product',
      cell: ({ row }) => <span className="text-sm">{row.original.product_name || '-'}</span>,
    },
    {
      accessorKey: 'type',
      header: 'Type',
      cell: ({ row }) => <StatusBadge variant={typeVariant(row.original.type)}>{row.original.type}</StatusBadge>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge variant={statusVariant(row.original.status)}>{row.original.status}</StatusBadge>,
    },
    {
      accessorKey: 'max_devices',
      header: 'Devices',
      cell: ({ row }) => <span className="text-sm tabular-nums">{row.original.max_devices}</span>,
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatRelativeTime(row.original.created_at)}</span>,
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          {row.original.status === 'active' && (
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
              setEditForm({
                type: row.original.type as LicenseType,
                maxDevices: row.original.max_devices,
                expiresAt: row.original.expires_at || '',
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
          <Button onClick={() => setIsCreating(true)} disabled={!products?.length}>
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
          {['all', 'active', 'revoked', 'expired'].map((status) => (
            <Button
              key={status}
              variant={filterStatus === status ? 'default' : 'outline'}
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
          {[...Array(5)].map((_, i) => <LicenseRowSkeleton key={i} />)}
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
          title={search || filterStatus !== 'all' ? 'No licenses match' : 'No licenses yet'}
          description={search || filterStatus !== 'all' ? 'Try a different filter or search' : 'Create your first license to start activating devices'}
          primaryAction={!search && filterStatus === 'all' && products?.length ? { label: 'Create License', onClick: () => setIsCreating(true), icon: Plus } : undefined}
        />
      )}

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create License</DialogTitle>
            <DialogDescription>Generate a new license key</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newLicense.productId && newLicense.type) {
                createMutation.mutate({
                  product_id: newLicense.productId,
                  type: newLicense.type,
                  max_devices: newLicense.maxDevices,
                  expires_at: newLicense.expiresAt || undefined,
                });
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="product">Product</Label>
              <select
                id="product"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                value={newLicense.productId}
                onChange={(e) => setNewLicense({ ...newLicense, productId: e.target.value })}
              >
                <option value="">Select a product</option>
                {products?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={newLicense.type}
                  onChange={(e) => setNewLicense({ ...newLicense, type: e.target.value as LicenseType })}
                >
                  {LICENSE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="maxDevices">Max Devices</Label>
                <Input
                  id="maxDevices"
                  type="number"
                  min={1}
                  value={newLicense.maxDevices}
                  onChange={(e) => setNewLicense({ ...newLicense, maxDevices: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="expiresAt">Expires At (optional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={newLicense.expiresAt}
                onChange={(e) => setNewLicense({ ...newLicense, expiresAt: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || !newLicense.productId}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingLicense} onOpenChange={(open) => !open && setEditingLicense(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit License</DialogTitle>
            <DialogDescription>Update license settings</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingLicense) {
                updateMutation.mutate({
                  id: editingLicense.id,
                  data: { type: editForm.type, max_devices: editForm.maxDevices, expires_at: editForm.expiresAt || undefined },
                });
              }
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="edit-type">Type</Label>
                <select
                  id="edit-type"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value as LicenseType })}
                >
                  {LICENSE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="edit-maxDevices">Max Devices</Label>
                <Input
                  id="edit-maxDevices"
                  type="number"
                  min={1}
                  value={editForm.maxDevices}
                  onChange={(e) => setEditForm({ ...editForm, maxDevices: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-expiresAt">Expires At (optional)</Label>
              <Input
                id="edit-expiresAt"
                type="datetime-local"
                value={editForm.expiresAt}
                onChange={(e) => setEditForm({ ...editForm, expiresAt: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingLicense(null)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdLicenseKey} onOpenChange={(open) => !open && setCreatedLicenseKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Shield className="h-5 w-5" />
              License Key Created
            </DialogTitle>
            <DialogDescription>Copy this key now. You won't be able to see it again.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={createdLicenseKey || ''} readOnly className="font-mono text-sm" />
            <Button onClick={() => createdLicenseKey && copyToClipboard(createdLicenseKey)} variant="default" size="icon">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatedLicenseKey(null)}>Done</Button>
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
