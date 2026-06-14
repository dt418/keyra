import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib';
import { LayoutDashboard, Package, Key, LogOut, Users, Monitor } from 'lucide-react';
import { Button } from '@/components/ui';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/dashboard/organizations', icon: Users, label: 'Organizations' },
  { to: '/dashboard/products', icon: Package, label: 'Products' },
  { to: '/dashboard/licenses', icon: Key, label: 'Licenses' },
  { to: '/dashboard/devices', icon: Monitor, label: 'Devices' },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-[100dvh] bg-background">
      <aside className="flex w-64 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-4 py-5">
          <h1 className="text-lg font-semibold tracking-tight">Keyra</h1>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="border-t border-border p-4">
          <div className="mb-3 rounded-lg bg-accent/50 px-3 py-2">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
          </div>
          <Button variant="outline" className="w-full justify-start gap-2" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
