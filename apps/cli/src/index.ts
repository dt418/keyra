#!/usr/bin/env node
import { KeyraClient, createClient } from '@keyra/sdk-js';
import inquirer from 'inquirer';

interface Config {
  apiUrl: string;
  apiKey: string;
}

async function loadConfig(): Promise<Config | null> {
  const apiUrl = process.env.KEYRA_API_URL;
  const apiKey = process.env.KEYRA_API_KEY;

  if (!apiUrl || !apiKey) {
    return null;
  }

  return { apiUrl, apiKey };
}

async function interactiveSetup(): Promise<Config> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiUrl',
      message: 'Enter API URL:',
      default: 'http://localhost:8788',
    },
    {
      type: 'password',
      name: 'apiKey',
      message: 'Enter API Key:',
    },
  ]);

  return answers;
}

async function verifyLicense(client: KeyraClient, licenseKey: string) {
  console.log('\nVerifying license...\n');
  const result = await client.verify(licenseKey);

  if (result.valid) {
    console.log('✓ License is VALID');
    console.log(`  Product: ${result.productName}`);
    console.log(`  Type: ${result.licenseType}`);
    if (result.expiresAt) {
      console.log(`  Expires: ${new Date(result.expiresAt).toLocaleString()}`);
    }
    if (result.featureFlags) {
      console.log('  Features:');
      Object.entries(result.featureFlags).forEach(([key, value]) => {
        console.log(`    ${key}: ${value ? '✓' : '✗'}`);
      });
    }
  } else {
    console.log('✗ License is INVALID');
    console.log(`  Reason: ${result.reason}`);
  }
}

async function activateDevice(client: KeyraClient) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'licenseKey',
      message: 'Enter license key:',
      validate: (input: string) => input.length > 0 || 'License key required',
    },
    {
      type: 'input',
      name: 'deviceName',
      message: 'Enter device name:',
      default: 'CLI Device',
    },
    {
      type: 'list',
      name: 'platform',
      message: 'Select platform:',
      choices: ['windows', 'linux', 'macos'],
    },
  ]);

  console.log('\nActivating device...\n');
  const result = await client.activate({
    licenseKey: answers.licenseKey,
    deviceName: answers.deviceName,
    platform: answers.platform,
  });

  console.log('✓ Device activated');
  console.log(`  Device Token: ${result.deviceToken}`);
  if (result.expiresAt) {
    console.log(`  Expires: ${new Date(result.expiresAt).toLocaleString()}`);
  }
}

async function deactivate(client: KeyraClient) {
  const token = await client.getStoredDeviceToken();
  if (!token) {
    console.log('No device token found. Use "keyra activate" first.');
    return;
  }

  console.log('\nDeactivating device...\n');
  await client.deactivate(token);
  await client.clearStoredDeviceToken();
  console.log('✓ Device deactivated');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  let config = await loadConfig();

  if (!config) {
    console.log('No configuration found. Setting up...\n');
    config = await interactiveSetup();
  }

  const client = createClient(config);

  switch (command) {
    case 'verify': {
      const licenseKey = args[1];
      if (!licenseKey) {
        console.error('Usage: keyra verify <license-key>');
        process.exit(1);
      }
      await verifyLicense(client, licenseKey);
      break;
    }
    case 'activate': {
      await activateDevice(client);
      break;
    }
    case 'deactivate': {
      await deactivate(client);
      break;
    }
    case 'help':
    default: {
      console.log(`
Keyra CLI - License Management

Usage:
  keyra <command> [options]

Commands:
  verify <license-key>   Verify a license key
  activate              Interactively activate a device
  deactivate            Deactivate the current device
  help                  Show this help message

Environment variables:
  KEYRA_API_URL     API base URL
  KEYRA_API_KEY     API key for authentication
      `);
    }
  }
}

main().catch(console.error);
