import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@keyra/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Label } from '@/components/ui';
import { Plus, Loader2, Copy, Key as KeyIcon, Package, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/date';

export default function Products() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '' });
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await productsApi.list();
      return res.data.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; orgId?: string }) => {
      const res = await productsApi.create(data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsCreating(false);
      setNewProduct({ name: '', description: '' });
      toast.success('Product created successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create product');
    },
  });

  const getApiKeyMutation = useMutation({
    mutationFn: async (productId: string) => {
      const res = await productsApi.getApiKey(productId);
      return res.data.data;
    },
    onSuccess: (data) => {
      setShowApiKey(data.apiKey);
      toast.success('API key generated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to get API key');
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const filteredProducts = products?.filter((p: any) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

      {isCreating && (
        <Card className="animate-in fade-in slide-in-from-top-2 duration-200">
          <CardHeader>
            <CardTitle>Create Product</CardTitle>
            <CardDescription>Add a new product to generate license keys</CardDescription>
          </CardHeader>
          <CardContent>
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
                  className="max-w-md"
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
                  className="max-w-md"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending || !newProduct.name.trim()}>
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
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

      {showApiKey && (
        <Card className="border-green-500 bg-green-50/50 dark:bg-green-950/20 animate-in fade-in slide-in-from-top-2 duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <KeyIcon className="h-5 w-5" />
              API Key Created
            </CardTitle>
            <CardDescription>
              Copy this key now. You won't be able to see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={showApiKey} readOnly className="font-mono text-sm" />
              <Button onClick={() => copyToClipboard(showApiKey)} variant="default" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setShowApiKey(null)}>
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
      ) : filteredProducts && filteredProducts.length > 0 ? (
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
            {filteredProducts.map((product: any) => (
              <Card key={product.id} className="group hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{product.name}</CardTitle>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {product.description || 'No description'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Created {formatRelativeTime(product.created_at)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => getApiKeyMutation.mutate(product.id)}
                      disabled={getApiKeyMutation.isPending}
                    >
                      {getApiKeyMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <KeyIcon className="mr-2 h-4 w-4" />
                      )}
                      API Key
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
