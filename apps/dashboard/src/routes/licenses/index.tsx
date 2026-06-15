import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { licensesApi, productsApi, type LicenseType } from '@keyra/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Button, Input, Label } from '@/components/ui';
import { Plus, Loader2, Copy, Key, Search, X, Shield, Smartphone, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime, formatExpiresAt } from '@/lib/date';

const LICENSE_TYPES: { value: LicenseType; label: string; color: string }[] = [
  { value: 'trial', label: 'Trial', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'free', label: 'Free', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400' },
  { value: 'personal', label: 'Personal', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'professional', label: 'Professional', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { value: 'business', label: 'Business', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { value: 'enterprise', label: 'Enterprise', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
];

const PAGE_SIZE = 20;

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
        return <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>;
      case 'revoked':
        return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">Revoked</span>;
      case 'expired':
        return <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Expired</span>;
      default:
        return <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-400">{status}</span>;
    }
  };

  const getTypeBadge = (type: string) => {
    const t = LICENSE_TYPES.find((lt) => lt.value === type);
    return (
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${t?.color || ''}`}>
        {t?.label || type}
      </span>
    );
  };

  const licenses = licensesResponse?.data || [];
  const hasMore = licensesResponse?.pagination?.has_more || false;
  const currentCursor = licensesResponse?.pagination?.cursor;

  const filteredLicenses = licenses.filter((l: any) => {
    if (!searchQuery) return true;
    return (
      l.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.product_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handlePrevPage = () => {
    setCursor(null);
  };

  const handleNextPage = () => {
    if (currentCursor) {
      setCursor(currentCursor);
    }
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

      {isCreating && (
        <Card className="animate-in fade-in slide-in-from-top-2 duration-200">
          <CardHeader>
            <CardTitle>Create License</CardTitle>
            <CardDescription>Generate a new license key</CardDescription>
          </CardHeader>
          <CardContent>
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
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || !newLicense.productId}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {createdLicenseKey && (
        <Card className="border-green-500 bg-green-50/50 dark:bg-green-950/20 animate-in fade-in slide-in-from-top-2 duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Shield className="h-5 w-5" />
              License Key Created
            </CardTitle>
            <CardDescription>
              Copy this key now. You won't be able to see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={createdLicenseKey} readOnly className="font-mono text-sm" />
              <Button onClick={() => copyToClipboard(createdLicenseKey)} variant="default" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setCreatedLicenseKey(null)}>
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                {filteredLicenses.map((license: any) => (
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
                  {licenses.length > 0 && (
                    <>Showing {licenses.length} items{hasMore ? '+' : ''}</>
                  )}
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
