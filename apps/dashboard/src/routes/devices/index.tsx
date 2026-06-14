import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devicesApi, activationsApi } from '@keyra/api-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { Button } from '@/components/ui';
import { Loader2, Monitor, Smartphone, Globe, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/utils';

const getPlatformIcon = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'windows':
      return <Monitor className="h-4 w-4" />;
    case 'ios':
    case 'android':
    case 'macos':
      return <Smartphone className="h-4 w-4" />;
    default:
      return <Globe className="h-4 w-4" />;
  }
};

const getPlatformLabel = (platform: string) => {
  return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
};

export default function Devices() {
  const queryClient = useQueryClient();
  const [expandedLicenseId, setExpandedLicenseId] = useState<string | null>(null);

  const { data: activations, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const res = await activationsApi.list({ limit: 100 });
      return res.data.data;
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      await devicesApi.deactivate(deviceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device deactivated');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to deactivate device');
    },
  });

  const groupedByLicense = activations?.reduce((acc: Record<string, typeof activations>, act: any) => {
    const licenseId = act.license_id;
    if (!acc[licenseId]) {
      acc[licenseId] = [];
    }
    acc[licenseId].push(act);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
        <p className="text-sm text-muted-foreground">Manage activated devices across your licenses</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : groupedByLicense && Object.keys(groupedByLicense).length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedByLicense).map(([licenseId, licenseActivations]: [string, any]) => {
            const uniqueDevices = new Map();
            licenseActivations.forEach((act: any) => {
              if (!uniqueDevices.has(act.device_id)) {
                uniqueDevices.set(act.device_id, {
                  id: act.device_id,
                  name: act.device_name,
                  platform: act.device_platform,
                  lastSeen: act.last_seen_at,
                  activatedAt: act.activated_at,
                });
              }
            });
            const devices = Array.from(uniqueDevices.values());

            return (
              <Card key={licenseId}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">License</CardTitle>
                    <CardDescription className="font-mono text-xs">{licenseId.slice(0, 8)}...</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setExpandedLicenseId(expandedLicenseId === licenseId ? null : licenseId)}
                  >
                    {devices.length} device{devices.length !== 1 ? 's' : ''}
                  </Button>
                </CardHeader>
                {expandedLicenseId === licenseId && (
                  <CardContent className="space-y-3">
                    {devices.map((device: any) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          {getPlatformIcon(device.platform)}
                          <div>
                            <div className="font-medium">{device.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {getPlatformLabel(device.platform)} • Last seen {formatRelativeTime(device.lastSeen)}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deactivateMutation.mutate(device.id)}
                          disabled={deactivateMutation.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground">No devices activated yet</p>
            <p className="text-sm text-muted-foreground">Devices will appear here when users activate their licenses</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
