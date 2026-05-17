'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  PROMOTION_ACTION_TYPE,
  PROMOTION_CONDITION_TYPE,
  type CreatePromotionRequest,
  type PromotionAction,
  type PromotionCondition,
  type PromotionDetail,
} from '@repo/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pill } from '@/components/ui/pill';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { createPromotionAction, updatePromotionAction } from './actions';
import { CouponsPanel } from './coupons-panel';

type Mode = 'create' | 'edit';

interface Props {
  mode: Mode;
  initial?: PromotionDetail;
}

interface FormState {
  name: string;
  description: string;
  isAutomatic: boolean;
  isActive: boolean;
  stackable: boolean;
  stackPriority: number;
  validFrom: string;
  validTo: string;
  conditions: PromotionCondition[];
  actions: PromotionAction[];
}

function formFromInitial(p?: PromotionDetail): FormState {
  return {
    name: p?.name ?? '',
    description: p?.description ?? '',
    isAutomatic: p?.isAutomatic ?? false,
    isActive: p?.isActive ?? true,
    stackable: p?.stackable ?? false,
    stackPriority: p?.stackPriority ?? 100,
    validFrom: p?.validFrom ? toLocalDatetime(p.validFrom) : '',
    validTo: p?.validTo ? toLocalDatetime(p.validTo) : '',
    conditions: p?.conditions ?? [],
    actions: p?.actions ?? [],
  };
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PromotionEditor({ mode, initial }: Props) {
  const router = useRouter();
  const [form, setForm] = React.useState<FormState>(() => formFromInitial(initial));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    const payload: CreatePromotionRequest = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      isAutomatic: form.isAutomatic,
      isActive: form.isActive,
      stackable: form.stackable,
      stackPriority: form.stackPriority,
      validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : null,
      validTo: form.validTo ? new Date(form.validTo).toISOString() : null,
      conditions: form.conditions,
      actions: form.actions,
    };
    try {
      if (mode === 'create') {
        const res = await createPromotionAction(payload);
        if (!res.ok || !res.data) {
          setError(res.error ?? 'Failed to create');
          return;
        }
        toast.success('Promotion created');
        router.push(`/promotions/${res.data.id}`);
      } else if (initial) {
        const res = await updatePromotionAction(initial.id, payload);
        if (!res.ok) {
          setError(res.error ?? 'Failed to save');
          return;
        }
        toast.success('Promotion saved');
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Tabs defaultValue="basics">
      <TabsList>
        <TabsTrigger value="basics">Basics</TabsTrigger>
        <TabsTrigger value="conditions">Conditions {form.conditions.length > 0 ? `(${form.conditions.length})` : ''}</TabsTrigger>
        <TabsTrigger value="actions">Actions {form.actions.length > 0 ? `(${form.actions.length})` : ''}</TabsTrigger>
        {mode === 'edit' && initial && !form.isAutomatic ? (
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
        ) : null}
      </TabsList>

      <TabsContent value="basics">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Weekend 15% off"
              maxLength={120}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Description (internal)</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Short note for the team — never shown to customers."
              rows={2}
              maxLength={2000}
            />
          </div>

          <ToggleRow
            label="Automatic"
            help="Applies silently when conditions match. No coupon code needed."
            checked={form.isAutomatic}
            onChange={(v) => set('isAutomatic', v)}
          />
          <ToggleRow
            label="Active"
            help="Promotion runs only while this is on."
            checked={form.isActive}
            onChange={(v) => set('isActive', v)}
          />
          <ToggleRow
            label="Stackable"
            help="When on, combines with other stackable promotions. When off, applies alone."
            checked={form.stackable}
            onChange={(v) => set('stackable', v)}
          />
          <div>
            <Label htmlFor="priority">Stack priority</Label>
            <Input
              id="priority"
              type="number"
              min={0}
              max={999}
              value={form.stackPriority}
              onChange={(e) => set('stackPriority', Number(e.target.value) || 0)}
            />
            <p className="mt-1 text-[11px] text-ink-500">Lower applies first.</p>
          </div>

          <div>
            <Label htmlFor="validFrom">Valid from</Label>
            <Input
              id="validFrom"
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => set('validFrom', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="validTo">Valid to</Label>
            <Input
              id="validTo"
              type="datetime-local"
              value={form.validTo}
              onChange={(e) => set('validTo', e.target.value)}
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="conditions">
        <ConditionsBuilder
          conditions={form.conditions}
          onChange={(next) => set('conditions', next)}
        />
      </TabsContent>

      <TabsContent value="actions">
        <ActionsBuilder actions={form.actions} onChange={(next) => set('actions', next)} />
      </TabsContent>

      {mode === 'edit' && initial && !form.isAutomatic ? (
        <TabsContent value="coupons">
          <CouponsPanel promotion={initial} />
        </TabsContent>
      ) : null}

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-6 flex items-center justify-end gap-3 border-t border-ink-100 bg-snow px-5 py-3 md:-mx-8 md:-mb-6 md:px-8">
        {error ? <p className="mr-auto text-[12px] text-danger">{error}</p> : null}
        <Button variant="outline" size="sm" onClick={() => router.push('/promotions')} disabled={submitting}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={submitting || form.name.trim().length === 0 || form.actions.length === 0}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Create promotion' : 'Save changes'}
        </Button>
      </div>
    </Tabs>
  );
}

function ToggleRow({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-ink-100 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-ink-300 text-ink-900 focus:ring-ink-500"
      />
      <span>
        <span className="block text-[13px] font-medium text-ink-900">{label}</span>
        <span className="block text-[11px] text-ink-500">{help}</span>
      </span>
    </label>
  );
}

// =====================================================
// Conditions builder
// =====================================================

const CONDITION_TYPES: { value: PromotionCondition['type']; label: string }[] = [
  { value: PROMOTION_CONDITION_TYPE.CART_SUBTOTAL_MIN, label: 'Cart subtotal at least' },
  { value: PROMOTION_CONDITION_TYPE.CART_CONTAINS_PRODUCT, label: 'Cart contains specific products' },
  { value: PROMOTION_CONDITION_TYPE.CART_CONTAINS_CATEGORY, label: 'Cart contains specific categories' },
  { value: PROMOTION_CONDITION_TYPE.CUSTOMER_FIRST_TIME, label: 'Customer is first-time' },
  { value: PROMOTION_CONDITION_TYPE.PINCODE_IN, label: 'Shipping pincode in list' },
];

function blankCondition(type: PromotionCondition['type']): PromotionCondition {
  switch (type) {
    case PROMOTION_CONDITION_TYPE.CART_SUBTOTAL_MIN:
      return { type, amountPaisa: 0 };
    case PROMOTION_CONDITION_TYPE.CART_CONTAINS_PRODUCT:
      return { type, productIds: [] };
    case PROMOTION_CONDITION_TYPE.CART_CONTAINS_CATEGORY:
      return { type, categoryIds: [] };
    case PROMOTION_CONDITION_TYPE.CUSTOMER_FIRST_TIME:
      return { type };
    case PROMOTION_CONDITION_TYPE.PINCODE_IN:
      return { type, pincodes: [] };
  }
}

function ConditionsBuilder({
  conditions,
  onChange,
}: {
  conditions: PromotionCondition[];
  onChange: (next: PromotionCondition[]) => void;
}) {
  const [addType, setAddType] = React.useState<PromotionCondition['type']>(
    PROMOTION_CONDITION_TYPES_FALLBACK,
  );

  function add() {
    onChange([...conditions, blankCondition(addType)]);
  }
  function update(idx: number, next: PromotionCondition) {
    const copy = [...conditions];
    copy[idx] = next;
    onChange(copy);
  }
  function remove(idx: number) {
    onChange(conditions.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {conditions.length === 0 ? (
        <p className="text-[12.5px] text-ink-500">
          No conditions — promotion applies to every cart that hits the actions tab&apos;s rules.
        </p>
      ) : null}

      {conditions.map((c, idx) => (
        <div key={idx} className="rounded-md border border-ink-100 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Pill tone="neutral">{labelForConditionType(c.type)}</Pill>
            <Button size="sm" variant="ghost" onClick={() => remove(idx)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ConditionEditor condition={c} onChange={(next) => update(idx, next)} />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={addType} onValueChange={(v) => setAddType(v as PromotionCondition['type'])}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add condition
        </Button>
      </div>
    </div>
  );
}

const PROMOTION_CONDITION_TYPES_FALLBACK = PROMOTION_CONDITION_TYPE.CART_SUBTOTAL_MIN;

function labelForConditionType(t: PromotionCondition['type']): string {
  return CONDITION_TYPES.find((x) => x.value === t)?.label ?? t;
}

function ConditionEditor({
  condition,
  onChange,
}: {
  condition: PromotionCondition;
  onChange: (next: PromotionCondition) => void;
}) {
  switch (condition.type) {
    case PROMOTION_CONDITION_TYPE.CART_SUBTOTAL_MIN:
      return (
        <div>
          <Label>Minimum subtotal (₹)</Label>
          <Input
            type="number"
            min={0}
            value={Math.floor(condition.amountPaisa / 100)}
            onChange={(e) =>
              onChange({ ...condition, amountPaisa: Math.max(0, Math.floor(Number(e.target.value) || 0) * 100) })
            }
          />
        </div>
      );
    case PROMOTION_CONDITION_TYPE.CART_CONTAINS_PRODUCT:
      return (
        <CommaListInput
          label="Product IDs (one per line / comma-separated)"
          value={condition.productIds}
          onChange={(productIds) => onChange({ ...condition, productIds })}
          placeholder="prod_abc123, prod_def456"
        />
      );
    case PROMOTION_CONDITION_TYPE.CART_CONTAINS_CATEGORY:
      return (
        <CommaListInput
          label="Category IDs"
          value={condition.categoryIds}
          onChange={(categoryIds) => onChange({ ...condition, categoryIds })}
          placeholder="cat_jackets, cat_shirts"
        />
      );
    case PROMOTION_CONDITION_TYPE.CUSTOMER_FIRST_TIME:
      return (
        <p className="text-[12.5px] text-ink-500">
          Matches when the customer&apos;s phone has no prior orders. Verified at order placement.
        </p>
      );
    case PROMOTION_CONDITION_TYPE.PINCODE_IN:
      return (
        <CommaListInput
          label="Pincodes"
          value={condition.pincodes}
          onChange={(pincodes) => onChange({ ...condition, pincodes })}
          placeholder="110001, 400001"
        />
      );
  }
}

function CommaListInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [raw, setRaw] = React.useState(value.join(', '));
  React.useEffect(() => {
    setRaw(value.join(', '));
  }, [value]);
  function commit() {
    const parts = raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    onChange(parts);
  }
  return (
    <div>
      <Label>{label}</Label>
      <Textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        rows={2}
      />
    </div>
  );
}

// =====================================================
// Actions builder
// =====================================================

const ACTION_TYPES: { value: PromotionAction['type']; label: string }[] = [
  { value: PROMOTION_ACTION_TYPE.PERCENT_OFF_ORDER, label: '% off whole order' },
  { value: PROMOTION_ACTION_TYPE.FLAT_OFF_ORDER, label: '₹ off whole order' },
  { value: PROMOTION_ACTION_TYPE.PERCENT_OFF_PRODUCTS, label: '% off specific products' },
  { value: PROMOTION_ACTION_TYPE.FLAT_OFF_PRODUCTS, label: '₹ off specific products' },
  { value: PROMOTION_ACTION_TYPE.FREE_SHIPPING, label: 'Free shipping' },
];

function blankAction(type: PromotionAction['type']): PromotionAction {
  switch (type) {
    case PROMOTION_ACTION_TYPE.PERCENT_OFF_ORDER:
      return { type, percent: 10 };
    case PROMOTION_ACTION_TYPE.FLAT_OFF_ORDER:
      return { type, amountPaisa: 10000 };
    case PROMOTION_ACTION_TYPE.PERCENT_OFF_PRODUCTS:
      return { type, percent: 10, productIds: [] };
    case PROMOTION_ACTION_TYPE.FLAT_OFF_PRODUCTS:
      return { type, amountPaisa: 10000, productIds: [] };
    case PROMOTION_ACTION_TYPE.FREE_SHIPPING:
      return { type };
  }
}

function ActionsBuilder({
  actions,
  onChange,
}: {
  actions: PromotionAction[];
  onChange: (next: PromotionAction[]) => void;
}) {
  const [addType, setAddType] = React.useState<PromotionAction['type']>(
    PROMOTION_ACTION_TYPE.PERCENT_OFF_ORDER,
  );

  function add() {
    onChange([...actions, blankAction(addType)]);
  }
  function update(idx: number, next: PromotionAction) {
    const copy = [...actions];
    copy[idx] = next;
    onChange(copy);
  }
  function remove(idx: number) {
    onChange(actions.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      {actions.length === 0 ? (
        <p className="text-[12.5px] text-warning">
          At least one action is required — the promotion has nothing to do otherwise.
        </p>
      ) : null}

      {actions.map((a, idx) => (
        <div key={idx} className="rounded-md border border-ink-100 p-3">
          <div className="mb-2 flex items-center justify-between">
            <Pill tone="info">{labelForActionType(a.type)}</Pill>
            <Button size="sm" variant="ghost" onClick={() => remove(idx)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ActionEditor action={a} onChange={(next) => update(idx, next)} />
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={addType} onValueChange={(v) => setAddType(v as PromotionAction['type'])}>
          <SelectTrigger className="w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={add}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Add action
        </Button>
      </div>
    </div>
  );
}

function labelForActionType(t: PromotionAction['type']): string {
  return ACTION_TYPES.find((x) => x.value === t)?.label ?? t;
}

function ActionEditor({
  action,
  onChange,
}: {
  action: PromotionAction;
  onChange: (next: PromotionAction) => void;
}) {
  switch (action.type) {
    case PROMOTION_ACTION_TYPE.PERCENT_OFF_ORDER:
      return (
        <div>
          <Label>Percent off</Label>
          <Input
            type="number"
            min={1}
            max={100}
            value={action.percent}
            onChange={(e) => onChange({ ...action, percent: clampPct(Number(e.target.value)) })}
          />
        </div>
      );
    case PROMOTION_ACTION_TYPE.FLAT_OFF_ORDER:
      return (
        <div>
          <Label>Amount off (₹)</Label>
          <Input
            type="number"
            min={1}
            value={Math.floor(action.amountPaisa / 100)}
            onChange={(e) =>
              onChange({ ...action, amountPaisa: Math.max(1, Math.floor(Number(e.target.value) || 0)) * 100 })
            }
          />
        </div>
      );
    case PROMOTION_ACTION_TYPE.PERCENT_OFF_PRODUCTS:
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Percent off</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={action.percent}
              onChange={(e) => onChange({ ...action, percent: clampPct(Number(e.target.value)) })}
            />
          </div>
          <CommaListInput
            label="Product IDs"
            value={action.productIds}
            onChange={(productIds) => onChange({ ...action, productIds })}
            placeholder="prod_abc123, prod_def456"
          />
        </div>
      );
    case PROMOTION_ACTION_TYPE.FLAT_OFF_PRODUCTS:
      return (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Amount off (₹)</Label>
            <Input
              type="number"
              min={1}
              value={Math.floor(action.amountPaisa / 100)}
              onChange={(e) =>
                onChange({ ...action, amountPaisa: Math.max(1, Math.floor(Number(e.target.value) || 0)) * 100 })
              }
            />
          </div>
          <CommaListInput
            label="Product IDs"
            value={action.productIds}
            onChange={(productIds) => onChange({ ...action, productIds })}
            placeholder="prod_abc123, prod_def456"
          />
        </div>
      );
    case PROMOTION_ACTION_TYPE.FREE_SHIPPING:
      return (
        <p className="text-[12.5px] text-ink-500">Waives the shipping fee on this cart.</p>
      );
  }
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(100, Math.floor(n)));
}
