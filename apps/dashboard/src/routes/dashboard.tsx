import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Package, Key, Users, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

const stats = [
  { title: 'Products', value: '0', icon: Package, href: '/dashboard/products', label: 'Active products' },
  { title: 'Licenses', value: '0', icon: Key, href: '/dashboard/licenses', label: 'Active licenses' },
  { title: 'Organizations', value: '0', icon: Users, href: '/dashboard/organizations', label: 'Your organizations' },
  { title: 'Activations', value: '0', icon: Activity, href: '/dashboard/licenses', label: 'Total activations' },
];

const steps = [
  { title: 'Create an organization', desc: 'Start by creating an organization to manage your products and licenses' },
  { title: 'Add your first product', desc: 'Create a product and get an API key for license verification' },
  { title: 'Generate licenses', desc: 'Create and manage licenses for your customers' },
];

export default function DashboardIndex() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">Manage your products and licenses</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.title} to={stat.href} className="group">
            <Card className="transition-colors hover:border-primary/50">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Follow these steps to set up your license management system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step, i) => (
            <div key={step.title} className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                {i + 1}
              </div>
              <div className="flex-1 pt-1">
                <div className="font-medium">{step.title}</div>
                <div className="text-sm text-muted-foreground">{step.desc}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
