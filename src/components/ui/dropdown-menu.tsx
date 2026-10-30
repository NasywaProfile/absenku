import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DropdownMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'success';
  disabled?: boolean;
}

export interface DropdownMenuProps {
  triggerLabel: string;
  triggerIcon?: React.ReactNode;
  items: DropdownMenuItem[];
  className?: string;
  buttonClassName?: string;
  align?: 'left' | 'right';
}

export function DropdownMenu({
  triggerLabel,
  triggerIcon,
  items,
  className = '',
  buttonClassName = '',
  align = 'right',
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center justify-between gap-2 px-4 py-2.5 bg-[#1E3A8A] hover:bg-[#172554] active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer ${buttonClassName}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 min-w-0">
          {triggerIcon}
          <span className="truncate">{triggerLabel}</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-white/80 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            align === 'left' ? 'left-0' : 'right-0'
          } mt-2 w-56 rounded-2xl bg-white shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150`}
          role="menu"
        >
          {items.map((item) => {
            const isDanger = item.variant === 'danger';
            const isSuccess = item.variant === 'success';

            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false);
                  item.onClick();
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer text-left ${
                  item.disabled
                    ? 'opacity-50 cursor-not-allowed text-slate-400'
                    : isDanger
                    ? 'text-rose-600 hover:bg-rose-50'
                    : isSuccess
                    ? 'text-emerald-700 hover:bg-emerald-50'
                    : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
                role="menuitem"
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
