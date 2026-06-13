export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicUser = Omit<User, 'createdAt' | 'updatedAt'>;
