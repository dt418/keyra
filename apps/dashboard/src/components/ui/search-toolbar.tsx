import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui';

export interface SearchToolbarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  right?: React.ReactNode;
}

export function SearchToolbar({ value, onChange, placeholder = 'Search...', right }: SearchToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-3 pb-4">
      <div className="relative max-w-sm flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
    </div>
  );
}
