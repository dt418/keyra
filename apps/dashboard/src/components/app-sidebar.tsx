import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Key,
  LogOut,
  Users,
  Package,
  Monitor,
  Settings,
  LifeBuoy,
  Book,
  FileText,
  Webhook,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { Button, Avatar, AvatarFallback, Separator } from "@/components/ui";
import { ModeToggle } from "@/components/mode-toggle";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { to: "/dashboard/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/dashboard/organizations", icon: Users, label: "Organizations" },
  { to: "/dashboard/products", icon: Package, label: "Products" },
  { to: "/dashboard/licenses", icon: Key, label: "Licenses" },
  { to: "/dashboard/devices", icon: Monitor, label: "Devices" },
];

const secondaryNav = [
  { to: "/dashboard/audit-logs", icon: FileText, label: "Audit Logs" },
  { to: "/dashboard/webhooks", icon: Webhook, label: "Webhooks" },
  { to: "/dashboard/api-keys", icon: Key, label: "API Keys" },
  { to: "/dashboard/docs", icon: Book, label: "Documentation" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
  { to: "/dashboard/support", icon: LifeBuoy, label: "Support" },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-background">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Key className="h-3.5 w-3.5" />
        </div>
        <span className="font-semibold text-sm">Keyra</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/dashboard"}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
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
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium leading-tight">
                {user?.name}
              </div>
              <div className="truncate text-[10px] text-muted-foreground leading-tight">
                {user?.email}
              </div>
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
