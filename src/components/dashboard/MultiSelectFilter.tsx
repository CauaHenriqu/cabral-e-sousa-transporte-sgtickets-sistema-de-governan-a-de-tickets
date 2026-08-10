import React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface MultiSelectFilterProps {
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  width?: string;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  allLabel,
  options,
  selected,
  onChange,
  width = 'min-w-[10rem]',
}) => {
  const allSelected = selected.length === 0;
  const display = allSelected
    ? allLabel
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? allLabel
      : `${label}: ${selected.length}`;

  const toggle = (val: string) => {
    if (selected.includes(val)) onChange(selected.filter((v) => v !== val));
    else onChange([...selected, val]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`text-[0.75rem] font-semibold bg-card border border-border rounded-lg px-2 py-1 text-foreground hover:bg-muted/40 flex items-center gap-1.5 ${width}`}
        >
          <span className="truncate flex-1 text-left">{display}</span>
          <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1 max-h-72 overflow-y-auto" align="start">
        <button
          type="button"
          onClick={() => onChange([])}
          className="w-full text-left text-[0.75rem] font-semibold px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
        >
          <span className="w-3.5 h-3.5 flex items-center justify-center">
            {allSelected && <Check size={12} className="text-primary" />}
          </span>
          {allLabel}
        </button>
        <div className="h-px bg-border my-1" />
        {options.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="w-full text-left text-[0.75rem] px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2"
            >
              <span
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${checked ? 'bg-primary border-primary' : 'border-border'}`}
              >
                {checked && <Check size={10} className="text-primary-foreground" />}
              </span>
              <span className="truncate">{opt.label}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};

export default MultiSelectFilter;
