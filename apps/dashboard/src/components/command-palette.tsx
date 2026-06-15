import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/components/theme-provider';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, Input } from '@/components/ui';
import { LayoutDashboard, Users, Package, Key, Monitor, Settings, Book, LifeBuoy, Sun, Moon, LogOut, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/dashboard/organizations', icon: Users, label: 'Organizations' },
  { to: '/dashboard/products', icon: Package, label: 'Products' },
  { to: '/dashboard/licenses', icon: Key, label: 'Licenses' },
  { to: '/dashboard/devices', icon: Monitor, label: 'Devices' },
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
  { value: 'system' as const, icon: Monitor, label: 'System' },
];

type CommandItem = {
  id: string;
  label: string;
  icon: any;
  onSelect: () => void;
  group: string;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const { logout } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const allItems: CommandItem[] = [
    ...navItems.map((item) => ({
      id: item.to,
      label: item.label,
      icon: item.icon,
      onSelect: () => navigate(item.to),
      group: 'Navigation',
    })),
    ...secondaryItems.map((item) => ({
      id: item.to,
      label: item.label,
      icon: item.icon,
      onSelect: () => navigate(item.to),
      group: 'Settings',
    })),
    ...themeItems.map((item) => ({
      id: `theme-${item.value}`,
      label: item.label,
      icon: item.icon,
      onSelect: () => setTheme(item.value),
      group: 'Theme',
    })),
    {
      id: 'signout',
      label: 'Sign out',
      icon: LogOut,
      onSelect: () => logout().then(() => navigate('/login')),
      group: 'Account',
    },
  ];

  const filtered = query
    ? allItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.group.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  const groupedItems = filtered.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  const flatList = filtered;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatList[selectedIndex];
        if (item) item.onSelect();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [open, flatList, selectedIndex]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="max-w-xl gap-0 overflow-hidden p-0 top-[15%] translate-y-0"
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            setSelectedIndex((i) => Math.max(i - 1, 0));
          }
        }}
      >
        <div className="flex items-center border-b border-border px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((i) => Math.min(i + 1, flatList.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const item = flatList[selectedIndex];
                if (item) item.onSelect();
              }
            }}
            placeholder="Type a command or search..."
            className="h-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            autoFocus
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {flatList.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No results found.</p>
          ) : (
            Object.entries(groupedItems).map(([group, items]) => (
              <div key={group} className="mb-2">
                <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </div>
                {items.map((item) => {
                  const idx = flatList.indexOf(item);
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={item.onSelect}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                        isSelected ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>esc to close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
