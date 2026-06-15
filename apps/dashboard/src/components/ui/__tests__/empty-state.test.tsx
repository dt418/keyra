import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/ui/empty-state';
import { Package } from 'lucide-react';
import userEvent from '@testing-library/user-event';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        icon={Package}
        title="No items"
        description="Get started by creating your first item"
      />
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
    expect(screen.getByText('Get started by creating your first item')).toBeInTheDocument();
  });

  it('renders primary action button', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Package}
        title="No items"
        primaryAction={{ label: 'Create item', onClick }}
      />
    );
    const button = screen.getByText('Create item');
    expect(button).toBeInTheDocument();
  });

  it('calls onClick when primary action clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Package}
        title="No items"
        primaryAction={{ label: 'Create', onClick }}
      />
    );
    await user.click(screen.getByText('Create'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders secondary action when provided', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={Package}
        title="No items"
        primaryAction={{ label: 'Create', onClick }}
        secondaryAction={{ label: 'Learn more', onClick }}
      />
    );
    expect(screen.getByText('Learn more')).toBeInTheDocument();
  });
});
