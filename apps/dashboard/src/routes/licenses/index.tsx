import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { licensesApi, productsApi, type LicenseType } from '@keyra/api-client';
import { Card, CardContent } from '@/components/ui';
import { Button, Input, Label } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Loader2, Copy, Key, Search, X, Shield, Smartphone, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime, formatExpiresAt } from '@/lib/date';

const LICENSE_TYPES: { value: LicenseType; label: string; color: string }[] = [
  { value: 'trial', label: 'Trial', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border border-violet-200 dark:border-violet-800' },
  { value: 'free', label: 'Free', color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700' },
  { value: 'personal', label: 'Personal', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800' },
  { value: 'professional', label: 'Professional', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800' },
  { value: 'business', label: 'Business', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' },
  { value: 'enterprise', label: 'Enterprise', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800' },
];

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
  const [searchQuery, setSearchQuery] = useState('');
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

  const { data: licensesResponse, isLoading, isFetching } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: async (data: {
      product_id: string;
      type: LicenseType;
      max_devices?: number;
      expires_at?: string;
    }) => {
      const res = await licensesApi.create({
        product_id: data.product_id,
        type: data.type,
        max_devices: data.max_devices,
        expires_at: data.expires_at,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setCreatedLicenseKey(data.key);
      setIsCreating(false);
      setNewLicense({ productId: '', type: 'trial', maxDevices: 1, expiresAt: '' });
      toast.success('License created successfully');
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
      toast.success('License updated successfully');
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
      toast.success('License deleted successfully');
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">Active</span>;
      case 'revoked':
        return <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">Revoked</span>;
      case 'expired':
        return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Expired</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">{status}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    const t = LICENSE_TYPES.find((lt) => lt.value === type);
    return (
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t?.color || ''}`}>
        {t?.label || type}
      </span>
    );
  };

  const licenses: License[] = licensesResponse?.data || [];
  const hasMore = licensesResponse?.pagination?.has_more || false;
  const currentCursor = licensesResponse?.pagination?.cursor;

  const filteredLicenses = licenses.filter((l) => {
    if (!searchQuery) return true;
    return (
      l.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.product_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handlePrevPage = () => setCursor(null);
  const handleNextPage = () => {
    if (currentCursor) setCursor(currentCursor);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Licenses</h1>
          <p className="text-sm text-muted-foreground">Create and manage license keys</p>
        </div>
        <Button onClick={() => setIsCreating(true)} disabled={!products?.length}>
          <Plus className="mr-2 h-4 w-4" />
          New License
        </Button>
      </div>

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
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newLicense.productId}
                onChange={(e) => setNewLicense({ ...newLicense, productId: e.target.value })}
              >
                <option value="">Select a product</option>
                {products?.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="type">License Type</Label>
                <select
                  id="type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newLicense.type}
                  onChange={(e) => setNewLicense({ ...newLicense, type: e.target.value as LicenseType })}
                >
                  {LICENSE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
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
                  className="w-full"
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
                className="w-full"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
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
                  data: {
                    type: editForm.type,
                    max_devices: editForm.maxDevices,
                    expires_at: editForm.expiresAt || undefined,
                  },
                });
              }
            }}
            className="space-y-4"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="edit-type">License Type</Label>
                <select
                  id="edit-type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value as LicenseType })}
                >
                  {LICENSE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
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
                  className="w-full"
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
                className="w-full"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingLicense(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete License</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdLicenseKey} onOpenChange={(open) => !open && setCreatedLicenseKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Shield className="h-5 w-5" />
              License Key Created
            </DialogTitle>
            <DialogDescription>Copy this key now. You won&apos;t be able to see it again.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={createdLicenseKey || ''} readOnly className="font-mono text-sm" />
            <Button onClick={() => createdLicenseKey && copyToClipboard(createdLicenseKey)} variant="default" size="icon">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatedLicenseKey(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search licenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
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

          {filteredLicenses.length > 0 ? (
            <>
              <div className="space-y-3">
                {filteredLicenses.map((license) => (
                  <Card key={license.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="flex items-center justify-between p-4 sm:p-6">
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                          <Key className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {getTypeBadge(license.type)}
                            {getStatusBadge(license.status)}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Smartphone className="h-3.5 w-3.5" />
                              {license.max_devices} device{license.max_devices !== 1 ? 's' : ''}
                            </span>
                            {license.expires_at && (
                              <span>Expires: {formatExpiresAt(license.expires_at)}</span>
                            )}
                            <span>Created {formatRelativeTime(license.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditForm({
                              type: license.type as LicenseType,
                              maxDevices: license.max_devices,
                              expiresAt: license.expires_at || '',
                            });
                            setEditingLicense(license);
                          }}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(license.id)}
                          className="text-destructive hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {license.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => revokeMutation.mutate(license.id)}
                            disabled={revokeMutation.isPending}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {licenses.length > 0 && <>Showing {licenses.length} items{hasMore ? '+' : ''}</>}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPage}
                    disabled={!cursor || isFetching}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!hasMore || isFetching}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <Key className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium mb-1">No licenses found</p>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                  {searchQuery || filterStatus !== 'all'
                    ? 'No licenses match your filters'
                    : 'Create your first license to start activating devices'}
                </p>
                {!searchQuery && filterStatus === 'all' && (
                  <Button onClick={() => setIsCreating(true)} disabled={!products?.length}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create License
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
