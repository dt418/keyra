export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};