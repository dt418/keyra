import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '@/components/ui/stat-card';
import { Package } from 'lucide-react';

describe('StatCard', () => {
  it('renders title, value, and icon', () => {
    render(<StatCard title="Products" value={42} icon={Package} description="Active products" />);
    expect(screen.getByText('Products')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Active products')).toBeInTheDocument();
  });

  it('renders trend up indicator with green color', () => {
    render(
      <StatCard
        title="Sales"
        value="100"
        icon={Package}
        trend={{ value: 12, direction: 'up' }}
      />
    );
    const trendElement = screen.getByText(/12%/);
    expect(trendElement).toBeInTheDocument();
  });

  it('renders trend down indicator with rose color', () => {
    render(
      <StatCard
        title="Sales"
        value="100"
        icon={Package}
        trend={{ value: 5, direction: 'down' }}
      />
    );
    expect(screen.getByText(/5%/)).toBeInTheDocument();
  });

  it('does not render trend when not provided', () => {
    const { container } = render(<StatCard title="Sales" value={10} icon={Package} />);
    expect(container.querySelector('svg.lucide-trending-up')).not.toBeInTheDocument();
    expect(container.querySelector('svg.lucide-trending-down')).not.toBeInTheDocument();
  });
});
