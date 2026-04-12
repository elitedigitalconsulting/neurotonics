'use client';

import { useState, useRef, useEffect, useId } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  hasError?: boolean;
  ariaLabel?: string;
  id?: string;
}

export default function CustomSelect({
  name,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  hasError = false,
  ariaLabel,
  id: externalId,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const autoId = useId();
  const id = externalId ?? autoId;
  const listId = `${id}-list`;

  // Prepend a placeholder entry for keyboard navigation
  const allOptions: SelectOption[] = [{ value: '', label: placeholder }, ...options];
  const selectedLabel = allOptions.find((o) => o.value === value)?.label ?? placeholder;

  // Close on outside click / focus-out
  useEffect(() => {
    if (!open) return;

    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocusedIndex(-1);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // Scroll focused option into view
  useEffect(() => {
    if (open && focusedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[focusedIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, open]);

  function openList() {
    setOpen(true);
    const idx = allOptions.findIndex((o) => o.value === value);
    setFocusedIndex(idx >= 0 ? idx : 0);
  }

  function closeList() {
    setOpen(false);
    setFocusedIndex(-1);
  }

  function selectOption(optValue: string) {
    onChange(name, optValue);
    closeList();
    buttonRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (
        e.key === 'Enter' ||
        e.key === ' ' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowUp'
      ) {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, allOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0) selectOption(allOptions[focusedIndex].value);
        break;
      case 'Escape':
        e.preventDefault();
        closeList();
        break;
      case 'Tab':
        closeList();
        break;
    }
  }

  const borderClosed = hasError
    ? 'border-red-400/60'
    : 'border-white/15 hover:border-white/30';
  const borderOpen = hasError ? 'border-red-400' : 'border-brand-warm';
  const ringOpen = hasError ? 'ring-1 ring-red-400' : 'ring-1 ring-brand-warm';

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        ref={buttonRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        aria-activedescendant={
          open && focusedIndex >= 0 ? `${id}-opt-${focusedIndex}` : undefined
        }
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleKeyDown}
        className={[
          'w-full px-4 py-3 rounded-xl bg-white/8 border text-sm transition-colors',
          'flex items-center justify-between gap-2 cursor-pointer',
          'focus:outline-none',
          open ? `${borderOpen} ${ringOpen}` : borderClosed,
        ].join(' ')}
      >
        <span className={value ? 'text-white' : 'text-white/50'}>
          {selectedLabel}
        </span>
        <svg
          className={`w-4 h-4 text-white/40 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={[
            'absolute z-50 mt-1.5 w-full rounded-xl overflow-hidden overflow-y-auto',
            'border border-white/15 bg-[#0d1832] shadow-2xl shadow-black/40',
            'max-h-56',
            'animate-scale-up origin-top',
          ].join(' ')}
        >
          {allOptions.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isFocused = idx === focusedIndex;
            const isPlaceholder = opt.value === '';

            return (
              <li
                key={opt.value !== '' ? opt.value : '__placeholder__'}
                id={`${id}-opt-${idx}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={isPlaceholder ? 'true' : 'false'}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!isPlaceholder) selectOption(opt.value);
                }}
                onMouseEnter={() => !isPlaceholder && setFocusedIndex(idx)}
                className={[
                  'px-4 py-2.5 text-sm select-none transition-colors',
                  isPlaceholder
                    ? 'text-white/45 cursor-default'
                    : 'cursor-pointer',
                  !isPlaceholder && isFocused
                    ? 'bg-brand-warm/25 text-white'
                    : '',
                  !isPlaceholder && isSelected && !isFocused
                    ? 'text-white bg-white/8'
                    : '',
                  !isPlaceholder && !isFocused && !isSelected
                    ? 'text-white/70 hover:text-white'
                    : '',
                  idx > 0 ? 'border-t border-white/5' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="flex items-center gap-2">
                  {/* Checkmark for selected option */}
                  <span className="w-4 flex-shrink-0 flex items-center justify-center">
                    {isSelected && !isPlaceholder && (
                      <svg
                        className="w-3.5 h-3.5 text-brand-warm"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </span>
                  {opt.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
