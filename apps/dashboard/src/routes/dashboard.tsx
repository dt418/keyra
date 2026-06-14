import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Package, Key, Users, Activity, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { productsApi, orgsApi, licensesApi, activationsApi } from '@keyra/api-client';

function StatCard({ title, value, icon: Icon, href, label }: {
  title: string;
  value: number | string;
  icon: any;
  href: string;
  label: string;
}) {
  return (
    <Link to={href} className="group">
      <Card className="transition-colors hover:border-primary/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardIndex() {
  const { data: products } = useQuery({
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

  const { data: licenses } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      const res = await licensesApi.list({ limit: 100 });
      return res.data.data;
    },
  });

  const { data: activations } = useQuery({
    queryKey: ['activations'],
    queryFn: async () => {
      const res = await activationsApi.list({ limit: 100 });
      return res.data.data;
    },
  });

  const productCount = products?.length ?? 0;
  const orgCount = orgs?.length ?? 0;
  const activeLicenseCount = licenses?.filter((l: any) => l.status === 'active').length ?? 0;
  const activationCount = activations?.length ?? 0;

  const hasNoOrg = orgCount === 0;
  const hasNoProduct = productCount === 0;
  const hasNoLicense = activeLicenseCount === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Manage your products and licenses</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Products"
          value={productCount}
          icon={Package}
          href="/dashboard/products"
          label="Active products"
        />
        <StatCard
          title="Licenses"
          value={activeLicenseCount}
          icon={Key}
          href="/dashboard/licenses"
          label="Active licenses"
        />
        <StatCard
          title="Organizations"
          value={orgCount}
          icon={Users}
          href="/dashboard/organizations"
          label="Your organizations"
        />
        <StatCard
          title="Activations"
          value={activationCount}
          icon={Activity}
          href="/dashboard/devices"
          label="Total activations"
        />
      </div>

      {(hasNoOrg || hasNoProduct || hasNoLicense) && (
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Follow these steps to set up your license management system</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasNoOrg && (
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  1
                </div>
                <div className="flex-1 pt-1">
                  <div className="font-medium">Create an organization</div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Start by creating an organization to manage your products and licenses
                  </div>
                  <Link to="/dashboard/organizations" className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    <Plus className="mr-1 h-3 w-3" />
                    Create organization
                  </Link>
                </div>
              </div>
            )}

            {!hasNoOrg && hasNoProduct && (
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  2
                </div>
                <div className="flex-1 pt-1">
                  <div className="font-medium">Add your first product</div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Create a product and get an API key for license verification
                  </div>
                  <Link to="/dashboard/products" className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    <Plus className="mr-1 h-3 w-3" />
                    Create product
                  </Link>
                </div>
              </div>
            )}

            {!hasNoOrg && !hasNoProduct && hasNoLicense && (
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  3
                </div>
                <div className="flex-1 pt-1">
                  <div className="font-medium">Generate licenses</div>
                  <div className="mb-2 text-sm text-muted-foreground">
                    Create and manage licenses for your customers
                  </div>
                  <Link to="/dashboard/licenses" className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    <Plus className="mr-1 h-3 w-3" />
                    Create license
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
