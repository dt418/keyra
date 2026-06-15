import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '@keyra/api-client';
import { Card, Button, PageHeader, Skeleton, StatusBadge, EmptyState } from '@/components/ui';
import { Key, Copy, EyeOff, AlertCircle, Package, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/date';
import { Link } from 'react-router-dom';

type ApiProduct = { id: string; name: string; created_at: string };

export default function ApiKeys() {
  const [visibleKeys, setVisibleKeys] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await productsApi.list({ limit: 100 });
      return res.data.data;
    },
  });

  const { data: apiKeyStatuses } = useQuery({
    queryKey: ['products-api-keys'],
    queryFn: async () => {
      if (!products) return {};
      const statuses: Record<string, { hasApiKey: boolean }> = {};
      await Promise.all(
        products.map(async (p: ApiProduct) => {
          try {
            const res = await productsApi.getApiKey(p.id);
            statuses[p.id] = { hasApiKey: res.data.data.hasApiKey };
          } catch {
            statuses[p.id] = { hasApiKey: false };
          }
        })
      );
      return statuses;
    },
    enabled: !!products && products.length > 0,
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleRegenerate = async (productId: string) => {
    setRegenerating((prev) => ({ ...prev, [productId]: true }));
    try {
      const res = await productsApi.regenerateKey(productId);
      setVisibleKeys((prev) => ({ ...prev, [productId]: res.data.data.apiKey }));
      toast.success('API key regenerated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to regenerate');
    } finally {
      setRegenerating((prev) => ({ ...prev, [productId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Manage API keys for your products"
        icon={Key}
      />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </Card>
          ))}
        </div>
      ) : products && products.length > 0 ? (
        <div className="space-y-3">
          {products.map((product: ApiProduct) => {
            const status = apiKeyStatuses?.[product.id];
            const hasApiKey = status?.hasApiKey ?? false;
            const visibleKey = visibleKeys[product.id];
            const isRegenerating = regenerating[product.id];

            return (
              <Card key={product.id} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <Link to="/dashboard/products" className="font-semibold text-sm hover:text-primary">
                        {product.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Created {formatRelativeTime(product.created_at)}
                      </p>
                    </div>
                  </div>
                  {hasApiKey ? (
                    <StatusBadge variant="success">
                      <CheckCircle2 className="h-3 w-3 mr-0.5" />
                      Active
                    </StatusBadge>
                  ) : (
                    <StatusBadge variant="warning">
                      <AlertCircle className="h-3 w-3 mr-0.5" />
                      No Key
                    </StatusBadge>
                  )}
                </div>

                {visibleKey ? (
                  <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                    <code className="flex-1 font-mono text-xs truncate">{visibleKey}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => copyToClipboard(visibleKey)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {hasApiKey
                      ? 'Click "Regenerate" to view your API key'
                      : 'Generate an API key to start verifying licenses'}
                  </p>
                )}

                <div className="mt-4 flex gap-2">
                  <Button
                    variant={hasApiKey ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => handleRegenerate(product.id)}
                    disabled={isRegenerating}
                  >
                    {isRegenerating ? (
                      <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Key className="mr-2 h-3.5 w-3.5" />
                    )}
                    {hasApiKey ? 'Regenerate' : 'Generate'} Key
                  </Button>
                  {visibleKey && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setVisibleKeys((prev) => {
                          const next = { ...prev };
                          delete next[product.id];
                          return next;
                        });
                      }}
                    >
                      <EyeOff className="mr-2 h-3.5 w-3.5" />
                      Hide
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Key}
          title="No products yet"
          description="Create your first product to generate API keys"
          primaryAction={{ label: 'Create product', onClick: () => window.location.href = '/dashboard/products', icon: Package }}
        />
      )}
    </div>
  );
}
