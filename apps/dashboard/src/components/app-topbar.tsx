import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Bell, Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui';

const routeLabels: Record<string, string> = {
  dashboard: 'Overview',
  organizations: 'Organizations',
  products: 'Products',
  licenses: 'Licenses',
  devices: 'Devices',
  'api-keys': 'API Keys',
  docs: 'Documentation',
  settings: 'Settings',
  support: 'Support',
};

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  return segments.map((segment, index) => ({
    label: routeLabels[segment] || segment,
    href: '/' + segments.slice(0, index + 1).join('/'),
    isLast: index === segments.length - 1,
  }));
}

export function AppTopbar() {
  const { currentOrg } = useAuth();
  const location = useLocation();
  const breadcrumbs = getBreadcrumbs(location.pathname);
  const [shortcut, setShortcut] = useState('Ctrl K');

  useEffect(() => {
    setShortcut(navigator.platform.toLowerCase().includes('mac') ? '⌘ K' : 'Ctrl K');
  }, []);

  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  };

  return (
    <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6">
      <nav className="flex items-center gap-1.5 text-sm min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <div key={crumb.href} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
            {crumb.isLast ? (
              <span className="font-medium truncate">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {crumb.label}
              </Link>
            )}
          </div>
        ))}
        {currentOrg && (
          <div className="ml-2 hidden md:flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>·</span>
            <span className="truncate max-w-[160px]">{currentOrg.name}</span>
          </div>
        )}
      </nav>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={openCommandPalette}
          className="relative hidden md:flex h-8 w-56 items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="rounded border border-border bg-background px-1.5 text-[10px] font-mono">
            {shortcut}
          </kbd>
        </button>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Notifications">
          <Bell className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
