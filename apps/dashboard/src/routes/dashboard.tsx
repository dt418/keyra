import { Card, CardHeader, CardTitle, CardDescription, CardContent, Skeleton } from '@/components/ui';
import { Package, Key, Users, Activity, TrendingUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productsApi, orgsApi, licensesApi, activationsApi } from '@keyra/api-client';
import type { LucideIcon } from 'lucide-react';

function StatCard({ title, value, icon: Icon, href, label, trend }: {
  title: string;
  value: number | string;
  icon: LucideIcon;
  href: string;
  label: string;
  trend?: string;
}) {
  return (
    <Link to={href}>
      <Card className="group relative overflow-hidden transition-all hover:shadow-md hover:border-primary/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
            <Icon className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{value}</div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            {trend && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <TrendingUp className="h-3 w-3" />
                {trend}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-10 rounded-xl" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

function QuickAction({ title, description, href, icon: Icon }: {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}) {
  return (
    <Link to={href}>
      <Card className="group transition-all hover:shadow-md hover:border-primary/50">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-medium">{title}</div>
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardIndex() {
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await productsApi.list({ limit: 100 });
      return res.data.data;
    },
  });

  const { data: orgs, isLoading: orgsLoading } = useQuery({
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

  const isLoading = productsLoading || orgsLoading || licensesLoading || activationsLoading;

  const productCount = products?.length ?? 0;
  const orgCount = orgs?.length ?? 0;
  const activeLicenseCount = licenses?.filter((l: any) => l.status === 'active').length ?? 0;
  const activationCount = activations?.length ?? 0;

  const hasNoOrg = orgCount === 0;
  const hasNoProduct = productCount === 0;
  const hasNoLicense = activeLicenseCount === 0;
  const isEmpty = hasNoOrg && hasNoProduct && hasNoLicense;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Monitor your license management at a glance</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Products"
            value={productCount}
            icon={Package}
            href="/dashboard/products"
            label="Active products"
          />
          <StatCard
            title="Active Licenses"
            value={activeLicenseCount}
            icon={Key}
            href="/dashboard/licenses"
            label="Valid licenses"
          />
          <StatCard
            title="Organizations"
            value={orgCount}
            icon={Users}
            href="/dashboard/organizations"
            label="Your organizations"
          />
          <StatCard
            title="Devices"
            value={activationCount}
            icon={Activity}
            href="/dashboard/devices"
            label="Total activations"
          />
        </div>
      )}

      {isEmpty && !isLoading && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>Quick actions to set up your license management</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {hasNoOrg && (
              <QuickAction
                title="Create Organization"
                description="Start by creating an organization"
                href="/dashboard/organizations"
                icon={Users}
              />
            )}
            {!hasNoOrg && hasNoProduct && (
              <QuickAction
                title="Add Product"
                description="Create a product for license verification"
                href="/dashboard/products"
                icon={Package}
              />
            )}
            {!hasNoOrg && !hasNoProduct && hasNoLicense && (
              <QuickAction
                title="Generate License"
                description="Create your first license key"
                href="/dashboard/licenses"
                icon={Key}
              />
            )}
          </CardContent>
        </Card>
      )}

      {!isEmpty && !isLoading && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <QuickAction
                title="Create License"
                description="Generate a new license key"
                href="/dashboard/licenses"
                icon={Key}
              />
              <QuickAction
                title="View Devices"
                description="Manage activated devices"
                href="/dashboard/devices"
                icon={Activity}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest activations</CardDescription>
            </CardHeader>
            <CardContent>
              {activations && activations.length > 0 ? (
                <div className="space-y-3">
                  {activations.slice(0, 5).map((act: any) => (
                    <div key={act.id} className="flex items-center gap-3 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <Activity className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">{act.device_name || 'Unknown Device'}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {act.device_platform || 'Unknown'} • {new Date(act.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
