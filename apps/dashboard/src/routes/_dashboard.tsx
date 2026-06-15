import { Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/app-sidebar';
import { TooltipProvider } from '@/components/ui';

export default function DashboardLayout() {
  return (
    <TooltipProvider>
      <div className="flex h-[100dvh] bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-7xl px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
