export type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
};

export type OrgMember = {
  userId: string;
  orgId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: Date;
};

export type PublicOrg = Omit<Organization, 'createdAt' | 'updatedAt'>;
