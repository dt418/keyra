import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@keyra/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Label, Skeleton } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Loader2, Copy, Key as KeyIcon, Package, Search, X, Eye, EyeOff, Check, AlertCircle, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/date';

type ProductWithApiKey = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  api_key_hash: string | null;
};

const PAGE_SIZE = 20;

function ProductCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function Products() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, string>>({});
  const [editingProduct, setEditingProduct] = useState<ProductWithApiKey | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  const { data: productsResponse, isLoading, isFetching } = useQuery({
    queryKey: ['products', cursor],
    queryFn: async () => {
      const res = await productsApi.list({ limit: PAGE_SIZE, cursor: cursor || undefined });
      return res.data;
    },
  });

  const products: ProductWithApiKey[] = productsResponse?.data || [];

  const { data: apiKeyStatuses } = useQuery({
    queryKey: ['products-api-keys'],
    queryFn: async () => {
      if (!products.length) return {};
      const statuses: Record<string, { hasApiKey: boolean }> = {};
      await Promise.all(
        products.map(async (p) => {
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
    enabled: products.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const res = await productsApi.create(data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-api-keys'] });
      setIsCreating(false);
      setNewProduct({ name: '', description: '' });
      toast.success('Product created successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create product');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description?: string } }) => {
      const res = await productsApi.update(id, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setEditingProduct(null);
      toast.success('Product updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update product');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (productId: string) => {
      await productsApi.delete(productId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-api-keys'] });
      setDeleteConfirm(null);
      toast.success('Product deleted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete product');
    },
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await productsApi.regenerateKey(productId);
      return res.data.data;
    },
    onSuccess: (data) => {
      setVisibleApiKeys((prev) => ({ ...prev, [data.productId]: data.apiKey }));
      queryClient.invalidateQueries({ queryKey: ['products-api-keys'] });
      toast.success('API key generated. Make sure to update your applications.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to regenerate API key');
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const toggleApiKeyVisibility = (productId: string) => {
    setVisibleApiKeys((prev) => {
      if (prev[productId]) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return prev;
    });
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const hasMore = productsResponse?.pagination?.has_more || false;
  const currentCursor = productsResponse?.pagination?.cursor;
  const handlePrevPage = () => setCursor(null);
  const handleNextPage = () => { if (currentCursor) setCursor(currentCursor); };

  const deleteProductName = products.find(p => p.id === deleteConfirm)?.name;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your products and API keys</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Product
        </Button>
      </div>

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Product</DialogTitle>
            <DialogDescription>Add a new product to generate license keys</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newProduct.name.trim()) {
                createMutation.mutate({
                  name: newProduct.name.trim(),
                  description: newProduct.description.trim() || undefined,
                });
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="name">Product Name</Label>
              <Input
                id="name"
                placeholder="My Awesome App"
                value={newProduct.name}
                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="Product description"
                value={newProduct.description}
                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !newProduct.name.trim()}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingProduct} onOpenChange={(open) => !open && setEditingProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product information</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingProduct && editForm.name.trim()) {
                updateMutation.mutate({
                  id: editingProduct.id,
                  data: {
                    name: editForm.name.trim(),
                    description: editForm.description.trim() || undefined,
                  },
                });
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="edit-name">Product Name</Label>
              <Input
                id="edit-name"
                placeholder="My Awesome App"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Input
                id="edit-description"
                placeholder="Product description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || !editForm.name.trim()}>
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
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteProductName}"? This action cannot be undone. All associated licenses will also be deleted.
            </DialogDescription>
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

      {isLoading ? (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : filteredProducts.length > 0 ? (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const apiKeyStatus = apiKeyStatuses?.[product.id];
              const hasApiKey = apiKeyStatus?.hasApiKey ?? false;
              const visibleKey = visibleApiKeys[product.id];
              const isRegenerating = regenerateKeyMutation.isPending && regenerateKeyMutation.variables === product.id;

              return (
                <Card key={product.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{product.name}</CardTitle>
                          <CardDescription className="line-clamp-1">
                            {product.description || 'No description'}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasApiKey ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <Check className="h-3 w-3" />
                            API Key Set
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                            <AlertCircle className="h-3 w-3" />
                            No API Key
                          </span>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Created {formatRelativeTime(product.created_at)}</span>
                    </div>

                    {visibleKey && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">API Key</Label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input
                              type="text"
                              value={visibleKey}
                              readOnly
                              className="pr-20 font-mono text-sm"
                            />
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => toggleApiKeyVisibility(product.id)}
                                title="Hide"
                              >
                                <EyeOff className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => copyToClipboard(visibleKey)}
                                title="Copy"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {hasApiKey && !visibleKey && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => regenerateKeyMutation.mutate(product.id)}
                          disabled={regenerateKeyMutation.isPending}
                        >
                          {isRegenerating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="mr-2 h-4 w-4" />
                          )}
                          Reveal Key
                        </Button>
                      )}
                      <Button
                        variant={hasApiKey ? 'secondary' : 'default'}
                        size="sm"
                        className={hasApiKey && !visibleKey ? '' : 'flex-1'}
                        onClick={() => regenerateKeyMutation.mutate(product.id)}
                        disabled={regenerateKeyMutation.isPending}
                      >
                        {isRegenerating ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <KeyIcon className="mr-2 h-4 w-4" />
                        )}
                        {hasApiKey ? 'Regenerate Key' : 'Generate API Key'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditForm({ name: product.name, description: product.description || '' });
                          setEditingProduct(product);
                        }}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm(product.id)}
                        className="text-destructive hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {hasApiKey && !visibleKey && (
                      <p className="text-xs text-muted-foreground">
                        Regenerating will invalidate your current key. Make sure to update your applications.
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {products.length > 0 && <>Showing {products.length} items{hasMore ? '+' : ''}</>}
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
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium mb-1">No products yet</p>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
              {searchQuery
                ? 'No products match your search'
                : 'Create your first product to start generating license keys'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Product
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
