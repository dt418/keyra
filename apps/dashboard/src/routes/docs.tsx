import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  PageHeader,
  Button,
  StatusBadge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui";
import {
  Book,
  Code2,
  Key,
  Copy,
  Check,
  Package,
  Terminal,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const installCode = {
  npm: "npm install @keyra-sdk/sdk-js",
  pnpm: "pnpm add @keyra-sdk/sdk-js",
  yarn: "yarn add @keyra-sdk/sdk-js",
  bun: "bun add @keyra-sdk/sdk-js",
};

const initCode = `import { createClient } from '@keyra-sdk/sdk-js';

const keyra = createClient({
  apiUrl: 'https://api.keyra.dev',
  apiKey: process.env.KEYRA_API_KEY!,
});`;

const verifyCode = `const result = await keyra.verify(licenseKey);

if (result.valid) {
  console.log('License is valid:', result.licenseType);
} else {
  console.error('Invalid license:', result.reason);
}`;

const activateCode = `const { deviceToken } = await keyra.activate({
  licenseKey: 'XXXX-XXXX-XXXX-XXXX',
  deviceName: 'My Laptop',
  platform: 'macos',
  appVersion: '1.0.0',
});

await keyra.setStoredDeviceToken(deviceToken);`;

const deactivateCode = `const deviceToken = await keyra.getStoredDeviceToken();
if (deviceToken) {
  await keyra.deactivate(deviceToken);
  await keyra.clearStoredDeviceToken();
}`;

function CodeBlock({
  code,
  language = "typescript",
}: {
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-md border border-border bg-muted/50 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-3 py-1.5">
        <span className="text-xs text-muted-foreground">{language}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
    </div>
  );
}

export default function Docs() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentation"
        description="Integrate Keyra in minutes with our SDK"
        icon={Book}
        actions={
          <StatusBadge variant="success">
            <Zap className="h-3 w-3 mr-0.5" />
            SDK v1.0
          </StatusBadge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Package className="h-4 w-4" />
            </div>
            <CardTitle>1. Install</CardTitle>
            <CardDescription>Add the SDK to your project</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="npm">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="npm">npm</TabsTrigger>
                <TabsTrigger value="pnpm">pnpm</TabsTrigger>
                <TabsTrigger value="yarn">yarn</TabsTrigger>
                <TabsTrigger value="bun">bun</TabsTrigger>
              </TabsList>
              {Object.entries(installCode).map(([pm, cmd]) => (
                <TabsContent key={pm} value={pm} className="mt-3">
                  <CodeBlock code={cmd} language="bash" />
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Key className="h-4 w-4" />
            </div>
            <CardTitle>2. Configure</CardTitle>
            <CardDescription>
              Initialize the client with your API key
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock code={initCode} />
            <p className="text-xs text-muted-foreground mt-3">
              Get your API key from a product's settings page.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Code2 className="h-4 w-4" />
            </div>
            <CardTitle>3. Use the SDK</CardTitle>
            <CardDescription>Verify, activate, and deactivate</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="verify">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="verify">Verify</TabsTrigger>
                <TabsTrigger value="activate">Activate</TabsTrigger>
                <TabsTrigger value="deactivate">Deactivate</TabsTrigger>
              </TabsList>
              <TabsContent value="verify" className="mt-3">
                <CodeBlock code={verifyCode} />
              </TabsContent>
              <TabsContent value="activate" className="mt-3">
                <CodeBlock code={activateCode} />
              </TabsContent>
              <TabsContent value="deactivate" className="mt-3">
                <CodeBlock code={deactivateCode} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <CardTitle>API Reference</CardTitle>
          </div>
          <CardDescription>
            Complete API documentation for all endpoints
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              {
                method: "POST",
                endpoint: "/api/v1/auth/register",
                desc: "Register a new user",
              },
              {
                method: "POST",
                endpoint: "/api/v1/auth/login",
                desc: "Sign in and get tokens",
              },
              {
                method: "POST",
                endpoint: "/api/v1/products",
                desc: "Create a new product",
              },
              {
                method: "GET",
                endpoint: "/api/v1/products",
                desc: "List products",
              },
              {
                method: "POST",
                endpoint: "/api/v1/verify",
                desc: "Verify a license key",
              },
              {
                method: "POST",
                endpoint: "/api/v1/activate",
                desc: "Activate a license on a device",
              },
              {
                method: "DELETE",
                endpoint: "/api/v1/devices/:id",
                desc: "Deactivate a device",
              },
              {
                method: "POST",
                endpoint: "/api/v1/licenses/:id/revoke",
                desc: "Revoke a license",
              },
            ].map((route) => (
              <div
                key={route.endpoint}
                className="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-accent transition-colors"
              >
                <span
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    route.method === "GET"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : route.method === "POST"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : route.method === "DELETE"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                          : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {route.method}
                </span>
                <code className="font-mono text-xs">{route.endpoint}</code>
                <span className="text-xs text-muted-foreground ml-auto">
                  {route.desc}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
