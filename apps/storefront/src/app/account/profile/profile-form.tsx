'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { CustomerProfile } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCustomer } from '@/lib/customer-context';
import { updateMe } from '@/lib/customer-api';

interface Props {
  initial: CustomerProfile;
}

export function ProfileForm({ initial }: Props) {
  const { setCustomer } = useCustomer();
  const [name, setName] = React.useState(initial.name ?? '');
  const [email, setEmail] = React.useState(initial.email ?? '');
  const [consents, setConsents] = React.useState({
    email: initial.marketingConsentEmail,
    sms: initial.marketingConsentSms,
    whatsapp: initial.marketingConsentWhatsapp,
  });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await updateMe({
        name: name.trim() || undefined,
        email: email.trim() || null,
        marketingConsentEmail: consents.email,
        marketingConsentSms: consents.sms,
        marketingConsentWhatsapp: consents.whatsapp,
      });
      setCustomer(updated);
      toast.success('Profile updated');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-6 space-y-4">
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" value={initial.phone} readOnly className="font-mono" />
      </div>
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
          maxLength={120}
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <p className="mt-1 text-[11.5px] text-ink-500">
          Your sign-in code is delivered to this address until SMS lands.
        </p>
      </div>

      <fieldset className="rounded-2xl border border-ink-100 bg-snow p-4">
        <legend className="px-1 font-mono text-[10.5px] uppercase tracking-caps text-ink-500">
          Marketing
        </legend>
        <div className="mt-2 space-y-2">
          <ConsentRow
            label="Email"
            description="Drops, restock alerts, order updates."
            checked={consents.email}
            onChange={(v) => setConsents((c) => ({ ...c, email: v }))}
          />
          <ConsentRow
            label="SMS"
            description="Only used for shipping/delivery updates today."
            checked={consents.sms}
            onChange={(v) => setConsents((c) => ({ ...c, sms: v }))}
          />
          <ConsentRow
            label="WhatsApp"
            description="Fitting reminders, order updates, store events."
            checked={consents.whatsapp}
            onChange={(v) => setConsents((c) => ({ ...c, whatsapp: v }))}
          />
        </div>
      </fieldset>

      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      <Button type="submit" size="lg" variant="clay" className="w-full" disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

function ConsentRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
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
        <span className="block text-[11.5px] text-ink-500">{description}</span>
      </span>
    </label>
  );
}
