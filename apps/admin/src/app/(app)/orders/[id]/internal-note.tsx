'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { updateInternalNoteAction } from './actions';

interface InternalNoteProps {
  orderNumber: string;
  initial: string;
}

export function InternalNote({ orderNumber, initial }: InternalNoteProps) {
  const router = useRouter();
  const [value, setValue] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const dirty = value !== initial;

  function save() {
    startTransition(async () => {
      const result = await updateInternalNoteAction(orderNumber, { note: value });
      if (!result.ok) {
        toast.error(result.error ?? 'Save failed');
        return;
      }
      toast.success('Note saved');
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="Staff-only notes (max 2000 chars)"
      />
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
          {value.length} / 2000
        </span>
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </Button>
      </div>
    </div>
  );
}
