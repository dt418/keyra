import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@keyra/api-client';
import { Card, Button, Input, Label, PageHeader, Skeleton, StatusBadge, EmptyState, ConfirmDialog } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, TextField, useZodForm } from '@/components/ui/form';
import { editProductFormSchema, editProductDefaults, createProductFormSchema, createProductDefaults } from '@keyra/shared-validation';
import { Plus, Loader2, Copy, Key as KeyIcon, Package, Pencil, Trash2, Eye, EyeOff, AlertCircle, Search, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/error-message';
import { formatRelativeTime } from '@/lib/date';

const PAGE_SIZE = 20;

type ApiProduct = { id: string; name: string; description: string | null; created_at: string; updated_at: string };
type ProductWithStatus = ApiProduct & {
  hasApiKey?: boolean;
};

function ProductCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </Card>
  );
}

export default function Products() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, string>>({});
  const [editingProduct, setEditingProduct] = useState<ProductWithStatus | null>(null);
  const createForm = useZodForm({
    schema: createProductFormSchema,
    defaultValues: createProductDefaults,
  });
  const editForm = useZodForm({
    schema: editProductFormSchema,
    defaultValues: editProductDefaults,
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  useEffect(() => {
    if (editingProduct) {
      editForm.form.reset({
        name: editingProduct.name,
        description: editingProduct.description || '',
      });
    }
  }, [editingProduct]);

  const { data: productsResponse, isLoading, isFetching } = useQuery({
    queryKey: ['products', cursor],
    queryFn: async () => {
      const res = await productsApi.list({ limit: PAGE_SIZE, cursor: cursor || undefined });
      return res.data;
    },
  });

  const products: ProductWithStatus[] = productsResponse?.data || [];

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
      createForm.form.reset(createProductDefaults);
      toast.success('Product created');
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, 'Failed to create product'));
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
      toast.success('Product updated');
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, 'Failed to update product'));
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
      toast.success('Product deleted');
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, 'Failed to delete product'));
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
    onError: (err: unknown) => {
      toast.error(errorMessage(err, 'Failed to regenerate API key'));
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
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const hasMore = productsResponse?.pagination?.has_more || false;
  const currentCursor = productsResponse?.pagination?.cursor;
  const deleteProductName = products.find((p) => p.id === deleteConfirm)?.name;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage your products and API keys"
        icon={Package}
        actions={
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Product
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => <ProductCardSkeleton key={i} />)}
        </div>
      ) : filteredProducts.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const apiKeyStatus = apiKeyStatuses?.[product.id];
              const hasApiKey = apiKeyStatus?.hasApiKey ?? false;
              const visibleKey = visibleApiKeys[product.id];
              const isRegenerating = regenerateKeyMutation.isPending && regenerateKeyMutation.variables === product.id;

              return (
                <Card key={product.id} className="group p-5 transition-colors hover:border-primary/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                        <Package className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm truncate">{product.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {product.description || 'No description'}
                        </p>
                      </div>
                    </div>
                    {hasApiKey ? (
                      <StatusBadge variant="success">
                        <CheckCircle2 className="h-3 w-3 mr-0.5" />
                        Key Set
                      </StatusBadge>
                    ) : (
                      <StatusBadge variant="warning">
                        <AlertCircle className="h-3 w-3 mr-0.5" />
                        No Key
                      </StatusBadge>
                    )}
                  </div>

                  {visibleKey && (
                    <div className="mt-4 space-y-2 rounded-md border border-border bg-muted/30 p-2">
                      <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">API Key</Label>
                      <div className="flex items-center gap-1">
                        <code className="flex-1 text-[10px] font-mono truncate">{visibleKey}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleApiKeyVisibility(product.id)}>
                          <EyeOff className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(visibleKey)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-border space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Created {formatRelativeTime(product.created_at)}</span>
                    </div>
                    <div className="flex gap-1">
                      {hasApiKey && !visibleKey && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8"
                          onClick={() => regenerateKeyMutation.mutate(product.id)}
                          disabled={regenerateKeyMutation.isPending}
                        >
                          {isRegenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      )}
                      <Button
                        variant={hasApiKey ? 'secondary' : 'default'}
                        size="sm"
                        className="flex-1 h-8"
                        onClick={() => regenerateKeyMutation.mutate(product.id)}
                        disabled={regenerateKeyMutation.isPending}
                      >
                        {isRegenerating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <KeyIcon className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingProduct(product);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(product.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {hasApiKey && !visibleKey && (
                      <p className="text-[10px] text-muted-foreground leading-tight">
                        Click key icon to regenerate (invalidates old key)
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {products.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Showing {products.length} products{hasMore ? '+' : ''}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCursor(null)} disabled={!cursor || isFetching}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => currentCursor && setCursor(currentCursor)} disabled={!hasMore || isFetching}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Package}
          title={search ? 'No products match' : 'No products yet'}
          description={search ? 'Try a different search term' : 'Create your first product to start generating license keys'}
          primaryAction={!search ? { label: 'Create product', onClick: () => setIsCreating(true), icon: Plus } : undefined}
        />
      )}

      <Dialog
        open={isCreating}
        onOpenChange={(open) => {
          if (!open) {
            createForm.form.reset(createProductDefaults);
          }
          setIsCreating(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Product</DialogTitle>
            <DialogDescription>Add a new product to generate license keys</DialogDescription>
          </DialogHeader>
          <Form {...createForm.form}>
            <form
              id="create-product-form"
              onSubmit={createForm.form.handleSubmit((values) => {
                createMutation.mutate({
                  name: values.name.trim(),
                  description: values.description?.trim() || undefined,
                });
              })}
              className="space-y-4"
            >
              <FormField
                control={createForm.form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Awesome App" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Product description" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingProduct}
        onOpenChange={(open) => {
          if (!open) {
            editForm.form.reset(editProductDefaults);
            setEditingProduct(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update product information</DialogDescription>
          </DialogHeader>
          <Form {...editForm.form}>
            <form
              id="edit-product-form"
              onSubmit={editForm.form.handleSubmit((values) => {
                if (!editingProduct) return;
                updateMutation.mutate({
                  id: editingProduct.id,
                  data: {
                    name: values.name.trim(),
                    description: values.description?.trim() || undefined,
                  },
                });
              })}
              className="space-y-4"
            >
              <FormField
                control={editForm.form.control}
                name="name"
                render={() => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <TextField name="name" placeholder="My Awesome App" autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.form.control}
                name="description"
                render={() => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <TextField name="description" placeholder="Product description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingProduct(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete Product"
        description={`Are you sure you want to delete "${deleteProductName}"? This action cannot be undone. All associated licenses will also be deleted.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
      />
    </div>
  );
}
