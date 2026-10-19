'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { savePosUpiAction, type UpiSlot } from './actions';

interface Props {
  initialSlots: UpiSlot[];
  initialActiveIndex: number;
}

export function UpiSettingsForm({ initialSlots, initialActiveIndex }: Props) {
  const [slots, setSlots] = useState<UpiSlot[]>(
    initialSlots.length > 0 ? initialSlots : [{ upiId: '', label: '' }],
  );
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const [pending, startTransition] = useTransition();

  function updateSlot(i: number, field: keyof UpiSlot, value: string) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)));
  }

  function addSlot() {
    if (slots.length >= 3) return;
    setSlots((prev) => [...prev, { upiId: '', label: '' }]);
  }

  function removeSlot(i: number) {
    if (slots.length <= 1) return;
    const next = slots.filter((_, idx) => idx !== i);
    setSlots(next);
    if (activeIndex >= next.length) setActiveIndex(next.length - 1);
    else if (activeIndex === i) setActiveIndex(0);
  }

  function handleSave() {
    const filled = slots.filter((s) => s.upiId.trim() && s.label.trim());
    if (filled.length === 0) {
      toast.error('Add at least one UPI ID with a label.');
      return;
    }
    const safeActive = activeIndex >= filled.length ? 0 : activeIndex;
    startTransition(async () => {
      const result = await savePosUpiAction(filled, safeActive);
      if (result.ok) toast.success('UPI settings saved');
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {slots.map((slot, i) => (
        <Card key={i} className={activeIndex === i ? 'border-amber-400 ring-1 ring-amber-400' : ''}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              {/* Active radio */}
              <button
                type="button"
                onClick={() => setActiveIndex(i)}
                className="mt-6 shrink-0"
                title="Set as active"
              >
                <CheckCircle2
                  className={`h-5 w-5 transition-colors ${
                    activeIndex === i ? 'text-amber-500' : 'text-ink-300 hover:text-ink-500'
                  }`}
                />
              </button>

              <div className="flex-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[12px]">
                    UPI ID {i + 1}
                    {activeIndex === i && (
                      <span className="ml-2 text-[11px] font-medium text-amber-600">Active</span>
                    )}
                  </Label>
                  <Input
                    placeholder="merchant@okaxis"
                    value={slot.upiId}
                    onChange={(e) => updateSlot(i, 'upiId', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Label</Label>
                  <Input
                    placeholder="e.g. Main, Personal, Store 2"
                    value={slot.label}
                    onChange={(e) => updateSlot(i, 'label', e.target.value)}
                  />
                </div>
              </div>

              {slots.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSlot(i)}
                  className="mt-6 shrink-0 text-ink-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex items-center justify-between gap-3">
        {slots.length < 3 ? (
          <Button type="button" variant="outline" size="sm" onClick={addSlot} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add UPI ID
          </Button>
        ) : (
          <p className="text-[12px] text-ink-400">Maximum 3 UPI IDs</p>
        )}

        <Button onClick={handleSave} disabled={pending} size="sm">
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
