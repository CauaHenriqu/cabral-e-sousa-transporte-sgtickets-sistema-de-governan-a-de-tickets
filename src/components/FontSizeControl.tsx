import React, { useEffect, useState } from 'react';
import { Minus, Plus, Type } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const MIN_SIZE = 12;
const MAX_SIZE = 48;
const DEFAULT_SIZE = 18;
const STEP = 2;
const STORAGE_KEY = 'sgtickets-font-size';

const FontSizeControl: React.FC = () => {
  // Sempre abre com o tamanho padrão (18px)
  const [fontSize, setFontSize] = useState(DEFAULT_SIZE);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    localStorage.setItem(STORAGE_KEY, String(fontSize));
  }, [fontSize]);

  const decrease = () => setFontSize(prev => Math.max(MIN_SIZE, prev - STEP));
  const increase = () => setFontSize(prev => Math.min(MAX_SIZE, prev + STEP));
  const reset = () => setFontSize(DEFAULT_SIZE);

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={decrease}
            disabled={fontSize <= MIN_SIZE}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 text-muted-foreground"
          >
            <Minus size={16} />
          </button>
        </TooltipTrigger>
        <TooltipContent><p>Diminuir fonte</p></TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={reset}
            className="px-1.5 py-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground flex items-center gap-1 text-xs font-medium"
          >
            <Type size={14} />
            <span>{fontSize}px</span>
          </button>
        </TooltipTrigger>
        <TooltipContent><p>Restaurar tamanho padrão ({DEFAULT_SIZE}px)</p></TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={increase}
            disabled={fontSize >= MAX_SIZE}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 text-muted-foreground"
          >
            <Plus size={16} />
          </button>
        </TooltipTrigger>
        <TooltipContent><p>Aumentar fonte</p></TooltipContent>
      </Tooltip>
    </div>
  );
};

export default FontSizeControl;
