import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '@/components/ui/page-header';
import { Package } from 'lucide-react';

describe('PageHeader', () => {
  it('renders title and description', () => {
    render(<PageHeader title="Products" description="Manage your products" icon={Package} />);
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('Manage your products')).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <PageHeader
        title="Products"
        actions={<button>Add Product</button>}
      />
    );
    expect(screen.getByText('Add Product')).toBeInTheDocument();
  });

  it('works without icon and description', () => {
    render(<PageHeader title="Simple" />);
    expect(screen.getByText('Simple')).toBeInTheDocument();
  });
});
