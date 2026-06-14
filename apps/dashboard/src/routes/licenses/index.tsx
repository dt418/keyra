import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { licensesApi, productsApi, type LicenseType } from '@keyra/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Button, Input, Label } from '@/components/ui';
import { Plus, Loader2, Copy, AlertTriangle } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

const LICENSE_TYPES: { value: LicenseType; label: string }[] = [
  { value: 'trial', label: 'Trial' },
  { value: 'free', label: 'Free' },
  { value: 'personal', label: 'Personal' },
  { value: 'professional', label: 'Professional' },
  { value: 'business', label: 'Business' },
  { value: 'enterprise', label: 'Enterprise' },
];

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

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await productsApi.list();
      return res.data.data;
    },
  });

  const { data: licenses, isLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      const res = await licensesApi.list();
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      productId: string;
      type: LicenseType;
      maxDevices?: number;
      expiresAt?: string;
    }) => {
      const res = await licensesApi.create(data);
      return res.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setCreatedLicenseKey(data.licenseKey);
      setIsCreating(false);
      setNewLicense({ productId: '', type: 'trial', maxDevices: 1, expiresAt: '' });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (licenseId: string) => {
      await licensesApi.revoke(licenseId, { reason: 'Revoked by admin' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">Active</span>;
      case 'revoked':
        return <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">Revoked</span>;
      case 'expired':
        return <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">Expired</span>;
      default:
        return <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Licenses</h1>
          <p className="text-muted-foreground">Create and manage license keys</p>
        </div>
        <Button onClick={() => setIsCreating(true)} disabled={!products?.length}>
          <Plus className="mr-2 h-4 w-4" />
          New License
        </Button>
      </div>

      {isCreating && (
        <Card>
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
                    productId: newLicense.productId,
                    type: newLicense.type,
                    maxDevices: newLicense.maxDevices,
                    expiresAt: newLicense.expiresAt || undefined,
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
                  className="w-32"
                />
              </div>
              <div>
                <Label htmlFor="expiresAt">Expires At (optional)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={newLicense.expiresAt}
                  onChange={(e) => setNewLicense({ ...newLicense, expiresAt: e.target.value })}
                  className="w-auto"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    'Create'
                  )}
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
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-green-500" />
              License Key Created
            </CardTitle>
            <CardDescription>
              Copy this key now. You won&apos;t be able to see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={createdLicenseKey} readOnly className="font-mono" />
              <Button onClick={() => copyToClipboard(createdLicenseKey)}>
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
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : licenses && licenses.length > 0 ? (
        <div className="space-y-4">
          {licenses.map((license: any) => (
            <Card key={license.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{license.type}</span>
                    {getStatusBadge(license.status)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ID: {license.id} • {license.maxDevices} device{license.maxDevices !== 1 ? 's' : ''}
                    {license.expiresAt && ` • Expires: ${new Date(license.expiresAt).toLocaleDateString()}`}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created {formatRelativeTime(license.createdAt)}
                  </div>
                </div>
                <div className="flex gap-2">
                  {license.status === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => revokeMutation.mutate(license.id)}
                      disabled={revokeMutation.isPending}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground">No licenses yet</p>
            <Button variant="link" onClick={() => setIsCreating(true)} disabled={!products?.length}>
              Create your first license
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
