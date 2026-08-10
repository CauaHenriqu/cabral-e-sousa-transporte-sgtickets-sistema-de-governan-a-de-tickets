import React, { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  /** Permite cadastrar um novo valor digitando diretamente no campo */
  allowCreate?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onValueChange,
  options,
  placeholder = 'Selecione',
  searchPlaceholder = 'Buscar...',
  emptyText = 'Nenhum resultado encontrado.',
  className,
  disabled,
  allowCreate = false,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find(o => o.value === value) ?? (allowCreate && value ? { value, label: value } : undefined);
  const canCreate =
    allowCreate &&
    search.trim().length > 0 &&
    !options.some(o => o.label.toLowerCase() === search.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal h-auto min-h-10 py-2',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="text-left whitespace-normal break-words flex-1">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 z-50 bg-popover"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        align="start"
      >
        <Command
          filter={(val, search) => {
            const opt = options.find(o => o.value === val);
            const haystack = `${opt?.label ?? ''} ${opt?.description ?? ''}`.toLowerCase();
            return haystack.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{canCreate ? null : emptyText}</CommandEmpty>
            {canCreate && (
              <CommandGroup forceMount>
                <CommandItem
                  value={`__create__${search}`}
                  forceMount
                  onSelect={() => {
                    onValueChange(search.trim());
                    setSearch('');
                    setOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span className="whitespace-normal break-words">Cadastrar "{search.trim()}"</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {options.map(opt => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setSearch('');
                    setOpen(false);
                  }}
                >

                  <Check className={cn('mr-2 h-4 w-4', value === opt.value ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="whitespace-normal break-words">{opt.label}</span>
                    {opt.description && (
                      <span className="text-xs text-muted-foreground whitespace-normal break-words">{opt.description}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
