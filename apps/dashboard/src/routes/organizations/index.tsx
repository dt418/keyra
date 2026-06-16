import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orgsApi } from '@keyra/api-client';
import { Card, Button, Input, Label, PageHeader, Skeleton, StatusBadge, EmptyState, ConfirmDialog } from '@/components/ui';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Loader2, Users, Pencil, Trash2, Search, Building2 } from 'lucide-react';
import { formatDate } from '@/lib/date';
import { useAuth } from '@/lib/auth';
import { errorMessage } from '@/lib/error-message';
import { toast } from 'sonner';

const PAGE_SIZE = 20;

type ApiOrg = { id: string; name: string; created_at: string };

function OrganizationCardSkeleton() {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-5 w-8" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function Organizations() {
  const queryClient = useQueryClient();
  const { refreshOrgs, currentOrg, switchOrg } = useAuth();
  const [isCreating, setIsCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<ApiOrg | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<ApiOrg | null>(null);
  const [search, setSearch] = useState('');

  const { data: orgsResponse, isLoading } = useQuery({
    queryKey: ['organizations', cursor],
    queryFn: async () => {
      const res = await orgsApi.list({ limit: PAGE_SIZE, cursor: cursor || undefined });
      return res.data;
    },
  });

  const organizations: ApiOrg[] = orgsResponse?.data || [];
  const hasMore = orgsResponse?.pagination?.has_more || false;
  const currentCursor = orgsResponse?.pagination?.cursor;

  const filteredOrgs = organizations.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await orgsApi.create({ name });
      return res.data.data;
    },
    onSuccess: async (newOrg) => {
      await refreshOrgs();
      if (newOrg) switchOrg(newOrg.id);
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setIsCreating(false);
      setNewOrgName('');
      toast.success('Organization created');
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, 'Failed to create organization'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await orgsApi.update(id, { name });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      refreshOrgs();
      setEditingOrg(null);
      toast.success('Organization updated');
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, 'Failed to update organization'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await orgsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      refreshOrgs();
      setDeleteConfirm(null);
      toast.success('Organization deleted');
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, 'Failed to delete organization'));
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizations"
        description="Manage your organizations and switch between them"
        icon={Building2}
        actions={
          <Button onClick={() => setIsCreating(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Organization
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search organizations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <OrganizationCardSkeleton key={i} />)}
        </div>
      ) : filteredOrgs.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredOrgs.map((org: ApiOrg) => (
              <Card key={org.id} className="group p-5 transition-colors hover:border-primary/50">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate">{org.name}</h3>
                        {currentOrg?.id === org.id && (
                          <StatusBadge variant="success">Current</StatusBadge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Created {formatDate(org.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setEditName(org.name);
                        setEditingOrg(org);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteConfirm(org)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-border">
                  <div>
                    <div className="text-xs text-muted-foreground">Products</div>
                    <div className="text-lg font-semibold mt-0.5">-</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Licenses</div>
                    <div className="text-lg font-semibold mt-0.5">-</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Devices</div>
                    <div className="text-lg font-semibold mt-0.5">-</div>
                  </div>
                </div>
                {currentOrg?.id !== org.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => switchOrg(org.id)}
                  >
                    Switch to this org
                  </Button>
                )}
              </Card>
            ))}
          </div>

          {organizations.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Showing {organizations.length} organizations{hasMore ? '+' : ''}</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCursor(null)}
                  disabled={!cursor}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => currentCursor && setCursor(currentCursor)}
                  disabled={!hasMore}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={Users}
          title={search ? 'No organizations match' : 'No organizations yet'}
          description={
            search
              ? 'Try a different search term'
              : 'Create your first organization to get started'
          }
          primaryAction={
            !search ? {
              label: 'Create organization',
              onClick: () => setIsCreating(true),
              icon: Plus,
            } : undefined
          }
        />
      )}

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>Add a new organization to manage products and licenses</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newOrgName.trim()) createMutation.mutate(newOrgName.trim());
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                placeholder="My Organization"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !newOrgName.trim()}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingOrg} onOpenChange={(open) => !open && setEditingOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>Update organization name</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingOrg && editName.trim()) {
                updateMutation.mutate({ id: editingOrg.id, name: editName.trim() });
              }
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="editOrgName">Organization Name</Label>
              <Input
                id="editOrgName"
                placeholder="My Organization"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingOrg(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending || !editName.trim()}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Delete Organization"
        description={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone. All associated products and licenses will also be deleted.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
      />
    </div>
  );
}
