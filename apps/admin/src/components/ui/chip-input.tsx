'use client';

// Mobile-friendly chip input. Replaces the "comma-separated text" pattern that
// makes phone keyboards painful. Operator types into the text field, presses
// Enter / Tab / comma to commit a chip, taps an existing chip to remove it.
// Presets render as a row above the input — one tap to add.
//
// Used by the MatrixDialog (sizes + colours) and any future tag-style input
// (PromotionsAdmin pincode lists could swap to this in a follow-up).

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChipInputProps {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  // Optional row of preset chips. Tapping a preset toggles it in/out of values.
  presets?: string[];
  // Normalise / clamp tokens before commit (e.g. uppercase, trim).
  normalize?: (token: string) => string;
  // Cap on chip count. Defaults to 32 — plenty for a sizes/colours run.
  maxChips?: number;
  // Inputmode hint for the soft keyboard. 'text' (default), 'numeric', etc.
  inputMode?: 'text' | 'numeric' | 'decimal';
  // Autocapitalize hint — 'characters' for sizes (S/M/L), 'words' for colours.
  autoCapitalize?: 'off' | 'characters' | 'words' | 'sentences';
  ariaLabel?: string;
  className?: string;
}

export function ChipInput({
  values,
  onChange,
  placeholder,
  presets,
  normalize,
  maxChips = 32,
  inputMode = 'text',
  autoCapitalize = 'off',
  ariaLabel,
  className,
}: ChipInputProps) {
  const [draft, setDraft] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  function commit(token: string) {
    const normalized = (normalize ? normalize(token) : token).trim();
    if (!normalized) return;
    if (values.includes(normalized)) return;
    if (values.length >= maxChips) return;
    onChange([...values, normalized]);
  }

  function remove(token: string) {
    onChange(values.filter((v) => v !== token));
  }

  function togglePreset(preset: string) {
    const normalized = normalize ? normalize(preset) : preset;
    if (values.includes(normalized)) {
      remove(normalized);
    } else {
      commit(preset);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
      if (draft.trim()) {
        e.preventDefault();
        commit(draft);
        setDraft('');
      }
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      // Backspace on an empty input removes the last chip — keyboard parity
      // with native multi-select inputs.
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {presets && presets.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const normalized = normalize ? normalize(p) : p;
            const active = values.includes(normalized);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePreset(p)}
                className={cn(
                  'rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-caps transition',
                  active
                    ? 'border-ink-900 bg-ink-900 text-snow'
                    : 'border-ink-200 bg-snow text-ink-700 hover:border-ink-900',
                )}
              >
                {p}
              </button>
            );
          })}
        </div>
      ) : null}

      <div
        className="flex min-h-[3rem] flex-wrap items-center gap-1.5 rounded-xl border border-ink-200 bg-snow p-2"
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-ink-900 px-2.5 py-1 font-mono text-[11px] uppercase tracking-caps text-snow"
          >
            {v}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(v);
              }}
              className="-mr-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-snow/15"
              aria-label={`Remove ${v}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (draft.trim()) {
              commit(draft);
              setDraft('');
            }
          }}
          inputMode={inputMode}
          autoCapitalize={autoCapitalize}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={ariaLabel}
          placeholder={values.length === 0 ? placeholder : ''}
          className="min-w-[6rem] flex-1 bg-transparent text-[13px] text-ink-900 outline-none"
        />
      </div>
    </div>
  );
}
