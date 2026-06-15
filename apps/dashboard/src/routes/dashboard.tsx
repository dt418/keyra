import { Card, CardContent, StatCard, PageHeader, Skeleton } from '@/components/ui';
import { Package, Key, Users, Activity, Plus, ArrowRight, KeyRound, ShieldOff, MonitorSmartphone, MonitorX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productsApi, orgsApi, licensesApi, activationsApi } from '@keyra/api-client';
import { useAuth } from '@/lib/auth';
import type { LucideIcon } from 'lucide-react';

interface ActivityEvent {
  id: string;
  type: 'license_created' | 'license_revoked' | 'device_activated' | 'device_removed';
  title: string;
  description: string;
  timestamp: string;
}

function QuickAction({ title, description, href, icon: Icon }: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      to={href}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/50 hover:bg-accent"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary transition-transform group-hover:scale-110">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm">{title}</div>
        <div className="text-xs text-muted-foreground truncate">{description}</div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function ActivityIcon({ type }: { type: ActivityEvent['type'] }) {
  const map: Record<ActivityEvent['type'], { icon: LucideIcon; className: string }> = {
    license_created: { icon: KeyRound, className: 'bg-emerald-500/10 text-emerald-600' },
    license_revoked: { icon: ShieldOff, className: 'bg-rose-500/10 text-rose-600' },
    device_activated: { icon: MonitorSmartphone, className: 'bg-blue-500/10 text-blue-600' },
    device_removed: { icon: MonitorX, className: 'bg-slate-500/10 text-slate-600' },
  };
  const { icon: Icon, className } = map[type];
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${className}`}>
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}

export default function DashboardIndex() {
  const { user, currentOrg } = useAuth();

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await productsApi.list({ limit: 100 });
      return res.data.data;
    },
  });

  const { data: orgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      const res = await orgsApi.list();
      return res.data.data;
    },
  });

  const { data: licenses, isLoading: licensesLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      const res = await licensesApi.list({ limit: 100 });
      return res.data.data;
    },
  });

  const { data: activations, isLoading: activationsLoading } = useQuery({
    queryKey: ['activations'],
    queryFn: async () => {
      const res = await activationsApi.list({ limit: 100 });
      return res.data.data;
    },
  });

  const isLoading = productsLoading || licensesLoading || activationsLoading;
  const productCount = products?.length ?? 0;
  const activeLicenseCount = licenses?.filter((l: any) => l.status === 'active').length ?? 0;
  const activationCount = activations?.length ?? 0;
  const orgCount = orgs?.length ?? 0;

  const recentActivations = (activations || []).slice(0, 6).map((a: any) => ({
    id: a.id,
    type: 'device_activated' as const,
    title: a.device_name || 'Device',
    description: `${a.device_platform || 'Unknown'} • ${currentOrg?.name || 'Organization'}`,
    timestamp: a.created_at,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.name?.split(' ')[0] || 'there'}`}
        description={currentOrg ? `Managing ${currentOrg.name}` : 'Monitor your license management at a glance'}
        actions={
          <Link
            to="/dashboard/licenses"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            New License
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i} className="p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="mt-3 h-7 w-16" />
              <Skeleton className="mt-2 h-3 w-20" />
            </Card>
          ))
        ) : (
          <>
            <StatCard title="Products" value={productCount} icon={Package} description="Active products" />
            <StatCard title="Active Licenses" value={activeLicenseCount} icon={Key} description="Valid licenses" />
            <StatCard title="Devices" value={activationCount} icon={Activity} description="Total activations" />
            <StatCard title="Organizations" value={orgCount} icon={Users} description="Your organizations" />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div>
                <h2 className="text-sm font-semibold">Recent Activity</h2>
                <p className="text-xs text-muted-foreground">Latest device activations</p>
              </div>
              <Link
                to="/dashboard/devices"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
              </Link>
            </div>
            <CardContent className="p-0">
              {recentActivations.length > 0 ? (
                <ul className="divide-y divide-border">
                  {recentActivations.map((event: ActivityEvent) => (
                    <li key={event.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/30">
                      <ActivityIcon type={event.type} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{event.title}</div>
                        <div className="text-xs text-muted-foreground truncate">{event.description}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleDateString()}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-5 py-10 text-center">
                  <Activity className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <div className="border-b border-border px-5 py-3">
              <h2 className="text-sm font-semibold">Quick Actions</h2>
              <p className="text-xs text-muted-foreground">Common tasks</p>
            </div>
            <CardContent className="space-y-2 p-3">
              <QuickAction title="Create License" description="Generate a new license key" href="/dashboard/licenses" icon={Key} />
              <QuickAction title="New Product" description="Add a product to verify" href="/dashboard/products" icon={Package} />
              <QuickAction title="View Devices" description="Manage device activations" href="/dashboard/devices" icon={Activity} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
