import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader, Button, Input, Label, StatusBadge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Settings as SettingsIcon, User, Shield, Bell, Database } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account and preferences"
        icon={SettingsIcon}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Account</CardTitle>
            </div>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="settings-name">Name</Label>
              <Input id="settings-name" defaultValue={user?.name || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email">Email</Label>
              <Input id="settings-email" type="email" defaultValue={user?.email || ''} disabled />
            </div>
            <Button disabled>Save Changes</Button>
            <p className="text-xs text-muted-foreground">Account editing coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>Manage authentication and access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Two-factor authentication</div>
                <div className="text-xs text-muted-foreground">Add an extra layer of security</div>
              </div>
              <StatusBadge variant="slate">Disabled</StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Active sessions</div>
                <div className="text-xs text-muted-foreground">Manage your active sessions</div>
              </div>
              <Button variant="outline" size="sm">View</Button>
            </div>
            <p className="text-xs text-muted-foreground">Advanced security options coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Notifications</CardTitle>
            </div>
            <CardDescription>Configure how you receive alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Email notifications</div>
                <div className="text-xs text-muted-foreground">Receive updates via email</div>
              </div>
              <StatusBadge variant="success">Enabled</StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Webhook alerts</div>
                <div className="text-xs text-muted-foreground">Send events to your endpoint</div>
              </div>
              <StatusBadge variant="slate">Disabled</StatusBadge>
            </div>
            <p className="text-xs text-muted-foreground">Webhook configuration coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <CardTitle>Data & Privacy</CardTitle>
            </div>
            <CardDescription>Export and delete your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Export data</div>
                <div className="text-xs text-muted-foreground">Download all your data as JSON</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => toast.info('Coming soon')}>
                Export
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Delete account</div>
                <div className="text-xs text-muted-foreground">Permanently delete your account and data</div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => toast.info('Coming soon')}>
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
