# @keyra-sdk/sdk-js

Standalone JavaScript SDK for verifying and managing [Keyra](https://github.com/dt418/keyra) licenses in customer applications.

## Installation

```bash
npm install @keyra-sdk/sdk-js
```

Requires Node.js 18+ (uses native `fetch`).

## Usage

```ts
import { createClient } from "@keyra-sdk/sdk-js";

const keyra = createClient({
  apiUrl: "https://your-keyra-instance.com",
  apiKey: "your-product-api-key",
});

// Verify a license
const result = await keyra.verify("LIC-XXXX-XXXX", "device-token-optional");
if (result.valid) {
  console.log("License OK:", result.licenseType);
} else {
  console.log("Invalid:", result.reason);
}

// Activate a device
const { deviceToken, expiresAt } = await keyra.activate({
  licenseKey: "LIC-XXXX-XXXX",
  deviceName: "User's Laptop",
  platform: "macos",
  appVersion: "1.0.0",
});

// Deactivate
await keyra.deactivate(deviceToken);
```

## API

### `createClient(options)`

| Option   | Type     | Description                               |
| -------- | -------- | ----------------------------------------- |
| `apiUrl` | `string` | Base URL of your Keyra API                |
| `apiKey` | `string` | Product API key issued by Keyra dashboard |

### `keyra.verify(licenseKey, deviceToken?)`

Returns a `VerifyResult`:

```ts
{
  valid: boolean;
  reason?: string;
  licenseId?: string;
  productName?: string;
  licenseType?: string;
  featureFlags?: Record<string, boolean>;
  expiresAt?: string;
}
```

### `keyra.activate(options)`

```ts
{
  licenseKey: string;
  deviceName: string;
  platform: "windows" | "linux" | "macos" | "ios" | "android";
  appVersion?: string;
  metadata?: Record<string, unknown>;
}
```

### `keyra.deactivate(deviceToken)`

Revokes a device activation.

### Stored device token helpers

- `keyra.getStoredDeviceToken()`
- `keyra.setStoredDeviceToken(token)`
- `keyra.clearStoredDeviceToken()`

## License

MIT
