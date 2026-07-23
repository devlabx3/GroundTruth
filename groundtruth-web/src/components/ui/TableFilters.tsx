import { useState } from 'react';
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';
import Input from './Input';
import Button from './Button';

export interface FilterConfig {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'select' | 'email';
  options?: Array<{ value: string; label: string }>;
}

interface TableFiltersProps {
  filters: FilterConfig[];
  onFiltersChange: (filters: Record<string, string>) => void;
  activeFilters: Record<string, string>;
}

export default function TableFilters({ filters, onFiltersChange, activeFilters }: TableFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({ ...activeFilters, [key]: value });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = Object.values(activeFilters).some((v) => v !== '');

  return (
    <div className="flex flex-col gap-3">
      <Button
        variant="secondary"
        onClick={() => setIsOpen(!isOpen)}
        className="w-fit px-3 py-1.5 text-xs">
        <MagnifyingGlassIcon size={16} />
        Filtros {hasActiveFilters && `(${Object.values(activeFilters).filter(Boolean).length})`}
      </Button>

      {isOpen && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3 bg-graphite-lighter rounded">
          {filters.map((filter) => (
            <div key={filter.key}>
              {filter.type === 'select' ? (
                <select
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  className="w-full px-2 py-1.5 border border-graphite-light rounded text-sm">
                  <option value="">{filter.placeholder || filter.label}</option>
                  {filter.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder={filter.placeholder || filter.label}
                  type={filter.type || 'text'}
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  className="w-full"
                />
              )}
            </div>
          ))}

          {hasActiveFilters && (
            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={handleClearFilters}
                className="px-2 py-1 text-xs gap-1">
                <XIcon size={14} />
                Limpiar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
