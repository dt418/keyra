import { Card, CardContent, CardHeader, CardTitle, CardDescription, PageHeader, Button } from '@/components/ui';
import { LifeBuoy, Mail, MessageCircle, Book, Github, ExternalLink, FileText, HelpCircle } from 'lucide-react';

const resources = [
  {
    icon: Book,
    title: 'Documentation',
    description: 'Guides, tutorials, and API reference',
    href: '#',
  },
  {
    icon: FileText,
    title: 'API Reference',
    description: 'Complete API documentation',
    href: '#',
  },
  {
    icon: Github,
    title: 'GitHub Repository',
    description: 'View source code and report issues',
    href: '#',
  },
  {
    icon: HelpCircle,
    title: 'FAQ',
    description: 'Frequently asked questions',
    href: '#',
  },
];

const channels = [
  {
    icon: Mail,
    title: 'Email Support',
    description: 'Get help via email within 24 hours',
    detail: 'support@keyra.dev',
  },
  {
    icon: MessageCircle,
    title: 'Live Chat',
    description: 'Chat with our support team in real-time',
    detail: 'Available Mon-Fri, 9am-5pm PST',
  },
];

export default function Support() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Get help and find resources"
        icon={LifeBuoy}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Support</CardTitle>
            <CardDescription>Get in touch with our team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {channels.map((channel) => (
              <div key={channel.title} className="flex items-start gap-3 rounded-md border border-border p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary flex-shrink-0">
                  <channel.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{channel.title}</div>
                  <div className="text-xs text-muted-foreground mb-1">{channel.description}</div>
                  <div className="text-xs font-mono">{channel.detail}</div>
                </div>
                <Button variant="outline" size="sm">Contact</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resources</CardTitle>
            <CardDescription>Self-serve documentation and resources</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {resources.map((resource) => (
              <a
                key={resource.title}
                href={resource.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:border-primary/50 hover:bg-accent"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground flex-shrink-0">
                  <resource.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{resource.title}</div>
                  <div className="text-xs text-muted-foreground">{resource.description}</div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Current operational status of all services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium">All systems operational</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
