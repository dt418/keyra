import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '@keyra/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Label } from '@/components/ui';
import { Plus, Loader2, Copy, Key as KeyIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/utils';

export default function Products() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '' });
  const [showApiKey, setShowApiKey] = useState<string | null>(null);

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
        <Card>
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

      {showApiKey && (
        <Card className="border-green-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyIcon className="h-5 w-5 text-green-500" />
              API Key Created
            </CardTitle>
            <CardDescription>
              Copy this key now. You won't be able to see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={showApiKey} readOnly className="font-mono" />
              <Button onClick={() => copyToClipboard(showApiKey)}>
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
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : products && products.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product: any) => (
            <Card key={product.id}>
              <CardHeader>
                <CardTitle>{product.name}</CardTitle>
                <CardDescription>{product.description || 'No description'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Created {formatRelativeTime(product.created_at)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => getApiKeyMutation.mutate(product.id)}
                    disabled={getApiKeyMutation.isPending}
                  >
                    {getApiKeyMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <KeyIcon className="mr-2 h-4 w-4" />
                    )}
                    Get API Key
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground">No products yet</p>
            <Button variant="link" onClick={() => setIsCreating(true)}>
              Create your first product
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
