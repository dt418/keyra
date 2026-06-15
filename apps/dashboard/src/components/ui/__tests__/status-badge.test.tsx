import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '@/components/ui/status-badge';

describe('StatusBadge', () => {
  it('renders default variant', () => {
    render(<StatusBadge>Default</StatusBadge>);
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('renders success variant', () => {
    render(<StatusBadge variant="success">Active</StatusBadge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders all variants without error', () => {
    const variants = ['default', 'success', 'warning', 'danger', 'info', 'violet', 'slate'] as const;
    variants.forEach((variant) => {
      const { container } = render(<StatusBadge variant={variant}>test</StatusBadge>);
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
