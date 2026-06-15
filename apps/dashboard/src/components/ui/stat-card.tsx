import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  className?: string;
}

export function StatCard({ title, value, icon: Icon, description, trend, className }: StatCardProps) {
  const TrendIcon = trend?.direction === 'up' ? TrendingUp : TrendingDown;
  const trendColor = trend?.direction === 'up'
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400';

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <h3 className="text-2xl font-semibold tracking-tight text-foreground">
          {value}
        </h3>
        {trend && (
          <span className={cn('flex items-center gap-0.5 text-xs font-medium', trendColor)}>
            <TrendIcon className="h-3 w-3" />
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </Card>
  );
}
