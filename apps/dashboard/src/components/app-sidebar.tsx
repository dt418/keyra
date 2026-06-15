import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Key, LogOut, Users, Package, Monitor, ChevronsUpDown, Plus, Settings, LifeBuoy, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Button, Avatar, AvatarFallback, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Separator } from '@/components/ui';
import { ModeToggle } from '@/components/mode-toggle';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/dashboard/organizations', icon: Users, label: 'Organizations' },
  { to: '/dashboard/products', icon: Package, label: 'Products' },
  { to: '/dashboard/licenses', icon: Key, label: 'Licenses' },
  { to: '/dashboard/devices', icon: Monitor, label: 'Devices' },
];

const secondaryNav = [
  { to: '/dashboard/api-keys', icon: Key, label: 'API Keys' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
  { to: '/dashboard/support', icon: LifeBuoy, label: 'Support' },
];

export function AppSidebar() {
  const { user, logout, currentOrg, orgs, switchOrg } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-background">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Key className="h-3.5 w-3.5" />
        </div>
        <span className="font-semibold text-sm">Keyra</span>
      </div>

      <div className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex w-full items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-sm transition-colors hover:bg-accent" />
            }
          >
            <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
              {currentOrg?.name?.charAt(0).toUpperCase() || 'O'}
            </div>
            <span className="flex-1 truncate text-left font-medium">{currentOrg?.name || 'Select Org'}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            {orgs?.map((org) => (
              <DropdownMenuItem key={org.id} onClick={() => switchOrg(org.id)}>
                <div className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary mr-2">
                  {org.name.charAt(0).toUpperCase()}
                </div>
                {org.name}
                {currentOrg?.id === org.id && <Check className="ml-auto h-3.5 w-3.5" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/dashboard/organizations')}>
              <Plus className="mr-2 h-4 w-4" />
              New organization
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <Separator className="my-3" />

        <ul className="space-y-0.5">
          {secondaryNav.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-border p-2">
        <div className="flex items-center justify-between rounded-md p-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium leading-tight">{user?.name}</div>
              <div className="truncate text-[10px] text-muted-foreground leading-tight">{user?.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <ModeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleLogout}
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
