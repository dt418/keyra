import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/components/theme-provider';
import { useAuth } from '@/lib/auth';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command';
import { LayoutDashboard, Users, Package, Key, Monitor, Settings, Book, LifeBuoy, Sun, Moon, Monitor as MonitorIcon, LogOut } from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview', shortcut: 'g o' },
  { to: '/dashboard/organizations', icon: Users, label: 'Organizations', shortcut: 'g r' },
  { to: '/dashboard/products', icon: Package, label: 'Products', shortcut: 'g p' },
  { to: '/dashboard/licenses', icon: Key, label: 'Licenses', shortcut: 'g l' },
  { to: '/dashboard/devices', icon: Monitor, label: 'Devices', shortcut: 'g d' },
];

const secondaryItems = [
  { to: '/dashboard/api-keys', icon: Key, label: 'API Keys' },
  { to: '/dashboard/docs', icon: Book, label: 'Documentation' },
  { to: '/dashboard/settings', icon: Settings, label: 'Settings' },
  { to: '/dashboard/support', icon: LifeBuoy, label: 'Support' },
];

const themeItems = [
  { value: 'light' as const, icon: Sun, label: 'Light mode' },
  { value: 'dark' as const, icon: Moon, label: 'Dark mode' },
  { value: 'system' as const, icon: MonitorIcon, label: 'System' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const { logout } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 0);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {navItems.map((item) => (
            <CommandItem
              key={item.to}
              value={item.label}
              onSelect={() => runCommand(() => navigate(item.to))}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          {secondaryItems.map((item) => (
            <CommandItem
              key={item.to}
              value={item.label}
              onSelect={() => runCommand(() => navigate(item.to))}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Theme">
          {themeItems.map((item) => (
            <CommandItem
              key={item.value}
              value={item.label}
              onSelect={() => runCommand(() => setTheme(item.value))}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem
            value="Sign out"
            onSelect={() => runCommand(() => logout().then(() => navigate('/login')))}
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
