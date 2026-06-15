import { Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/app-sidebar';
import { AppTopbar } from '@/components/app-topbar';
import { TooltipProvider } from '@/components/ui';

export default function DashboardLayout() {
  return (
    <TooltipProvider>
      <div className="flex h-[100dvh] bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppTopbar />
          <main className="flex-1 overflow-auto">
            <div className="w-full px-6 py-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
