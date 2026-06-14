export type Device = {
  id: string;
  licenseId: string;
  userId: string;
  name: string;
  platform: string;
  appVersion: string | null;
  lastSeenAt: Date | null;
  activatedAt: Date;
};

export type CreateDeviceInput = {
  licenseId: string;
  userId: string;
  name: string;
  platform: string;
  appVersion?: string;
};
