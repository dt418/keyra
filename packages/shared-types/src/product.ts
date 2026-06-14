export type Product = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  apiKeyHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProductInput = {
  name: string;
  description?: string;
};

export type UpdateProductInput = {
  name?: string;
  description?: string;
};
