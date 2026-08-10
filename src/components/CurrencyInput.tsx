import React from 'react';
import { Input } from '@/components/ui/input';

export const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

/** Campo monetário em R$. Valor sempre >= R$ 0,00, padrão "R$ 0,00". */
export const CurrencyInput: React.FC<CurrencyInputProps> = ({ value, onChange, className, disabled }) => {
  const display = value && value.trim() !== '' ? value : formatBRL(0);

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 15);
    const cents = digits ? parseInt(digits, 10) : 0;
    onChange(formatBRL(Math.max(0, cents)));
  };

  return (
    <Input
      inputMode="numeric"
      value={display}
      disabled={disabled}
      onChange={e => handleChange(e.target.value)}
      onFocus={() => { if (!value) onChange(formatBRL(0)); }}
      className={className}
    />
  );
};

export default CurrencyInput;
