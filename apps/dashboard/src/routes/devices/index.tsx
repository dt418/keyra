import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi, activationsApi } from '@keyra/api-client';
import { Button, PageHeader, Skeleton, StatusBadge, EmptyState, ConfirmDialog, DataTable } from '@/components/ui';
import { Monitor, Smartphone, Globe, Trash2, Activity, Apple, MonitorSmartphone } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/error-message';
import { formatRelativeTime } from '@/lib/date';
import type { ColumnDef } from '@tanstack/react-table';

const PAGE_SIZE = 20;

type Device = {
  id: string;
  license_id: string;
  device_name: string;
  device_platform: string;
  device_last_seen_at: string;
  created_at: string;
  status: 'online' | 'offline';
};

const PlatformIcon = ({ platform }: { platform: string }) => {
  const p = platform?.toLowerCase();
  if (p === 'windows') return <Monitor className="h-4 w-4" />;
  if (p === 'macos' || p === 'darwin') return <Apple className="h-4 w-4" />;
  if (['ios', 'android'].includes(p)) return <Smartphone className="h-4 w-4" />;
  if (p === 'linux') return <MonitorSmartphone className="h-4 w-4" />;
  return <Globe className="h-4 w-4" />;
};

const platformLabel = (platform: string) => {
  if (!platform) return 'Unknown';
  return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
};

function isOnline(lastSeen: string) {
  const diff = Date.now() - new Date(lastSeen).getTime();
  return diff < 5 * 60 * 1000;
}

function DeviceRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

export default function Devices() {
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<Device | null>(null);

  const { data: activationsResponse, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await activationsApi.list({ limit: PAGE_SIZE });
      return res.data;
    },
  });

  const activations: any[] = activationsResponse?.data || [];

  const devices: Device[] = activations.reduce((acc: Device[], act: any) => {
    if (!acc.find((d) => d.id === act.device_id)) {
      acc.push({
        id: act.device_id,
        license_id: act.license_id,
        device_name: act.device_name || 'Unknown Device',
        device_platform: act.device_platform || 'unknown',
        device_last_seen_at: act.device_last_seen_at,
        created_at: act.created_at,
        status: isOnline(act.device_last_seen_at) ? 'online' : 'offline',
      });
    }
    return acc;
  }, []);

  const deactivateMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      await devicesApi.deactivate(deviceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setDeleteConfirm(null);
      toast.success('Device deactivated');
    },
    onError: (err: unknown) => {
      toast.error(errorMessage(err, 'Failed to deactivate device'));
    },
  });

  const columns: ColumnDef<Device>[] = [
    {
      accessorKey: 'device_name',
      header: 'Device',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <PlatformIcon platform={row.original.device_platform} />
          </div>
          <div>
            <div className="font-medium text-sm">{row.original.device_name}</div>
            <div className="text-xs text-muted-foreground">{platformLabel(row.original.device_platform)}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'license_id',
      header: 'License',
      cell: ({ row }) => (
        <button
          onClick={() => navigator.clipboard.writeText(row.original.license_id)}
          className="font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          {row.original.license_id.slice(0, 12)}...
        </button>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge variant={row.original.status === 'online' ? 'success' : 'slate'}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${row.original.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          {row.original.status}
        </StatusBadge>
      ),
    },
    {
      accessorKey: 'device_last_seen_at',
      header: 'Last Seen',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{formatRelativeTime(row.original.device_last_seen_at)}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setDeleteConfirm(row.original)}
            title="Deactivate"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devices"
        description="Manage activated devices across your licenses"
        icon={Activity}
      />

      {isLoading ? (
        <div className="space-y-1 rounded-xl border border-border bg-card overflow-hidden">
          {[...Array(5)].map((_, i) => <DeviceRowSkeleton key={i} />)}
        </div>
      ) : devices.length > 0 ? (
        <DataTable
          columns={columns}
          data={devices}
          searchPlaceholder="Search devices..."
        />
      ) : (
        <EmptyState
          icon={Activity}
          title="No devices activated yet"
          description="Devices will appear here when users activate their licenses"
        />
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title="Deactivate Device"
        description={`Are you sure you want to deactivate "${deleteConfirm?.device_name}" (${deleteConfirm && platformLabel(deleteConfirm.device_platform)})? The user will need to reactivate their license on this device.`}
        confirmLabel="Deactivate"
        variant="destructive"
        loading={deactivateMutation.isPending}
        onConfirm={() => deleteConfirm && deactivateMutation.mutate(deleteConfirm.id)}
      />
    </div>
  );
}
