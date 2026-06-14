import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      className="toaster group"
      theme="light"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          title: 'text-sm font-medium',
          description: 'text-sm text-muted-foreground',
          actionButton: 'group-[.toaster]:bg-primary group-[.toaster]:text-primary-foreground',
          cancelButton: 'group-[.toaster]:bg-muted group-[.toaster]:text-muted-foreground',
          success: 'group-[.toaster]:bg-green-50 group-[.toaster]:text-green-900 group-[.toaster]:border-green-200',
          error: 'group-[.toaster]:bg-destructive/10 group-[.toaster]:text-destructive group-[.toaster]:border-destructive/20',
        },
      }}
    />
  );
}
