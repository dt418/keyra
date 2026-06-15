import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

describe('ConfirmDialog', () => {
  it('renders title and description', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete Item"
        description="This will delete the item permanently."
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText('Delete Item')).toBeInTheDocument();
    expect(screen.getByText('This will delete the item permanently.')).toBeInTheDocument();
  });

  it('uses destructive styling for destructive variant', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Delete"
        description="Are you sure?"
        variant="destructive"
        confirmLabel="Delete forever"
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText('Delete forever')).toBeInTheDocument();
  });

  it('renders custom labels', () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={() => {}}
        title="Confirm"
        description="Description"
        confirmLabel="Yes, do it"
        cancelLabel="No, cancel"
        onConfirm={() => {}}
      />
    );
    expect(screen.getByText('Yes, do it')).toBeInTheDocument();
    expect(screen.getByText('No, cancel')).toBeInTheDocument();
  });
});
