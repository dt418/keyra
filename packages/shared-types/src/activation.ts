export type Activation = {
  id: string;
  licenseId: string;
  deviceId: string;
  createdAt: Date;
  metadata: Record<string, unknown> | null;
};

export type CreateActivationInput = {
  licenseId: string;
  deviceId: string;
  metadata?: Record<string, unknown>;
};
