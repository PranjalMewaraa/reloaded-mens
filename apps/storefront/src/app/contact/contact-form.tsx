'use client';

import * as React from 'react';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { env } from '@/lib/env';

interface Props {
  whatsappHref: string;
}

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return input.trim();
}

export function ContactForm({ whatsappHref }: Props) {
  const [name, setName] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phone.trim() && !email.trim()) {
      setError('We need either a phone or email to reply.');
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, string> = {};
      if (name.trim()) body.name = name.trim();
      if (phone.trim()) body.phone = normalizePhone(phone);
      if (email.trim()) body.email = email.trim();
      if (message.trim()) body.message = message.trim();
      const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/v1/public/leads`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(errBody.message ?? 'Failed to send');
      }
      setSent(true);
      toast.success('Got it — we will be in touch.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-5">
        <p className="text-[14px] font-medium text-success">Thanks — we&apos;ve got your message.</p>
        <p className="mt-1 text-[12.5px] text-ink-700">
          We&apos;ll reply on email or WhatsApp within one business day. Need an answer faster?
        </p>
        <Button asChild variant="whatsapp" size="sm" className="mt-3">
          <a href={whatsappHref} target="_blank" rel="noopener">
            <MessageCircle className="mr-2 h-3.5 w-3.5" />
            Chat now
          </a>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-ink-100 bg-snow p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={120}
          />
        </div>
        <div>
          <Label htmlFor="phone">Phone (preferred)</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="98765 43210"
            inputMode="tel"
          />
        </div>
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
      </div>
      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Sizing question, wholesale enquiry, custom order…"
          rows={4}
          maxLength={2000}
        />
      </div>
      {error ? <p className="text-[12px] text-danger">{error}</p> : null}
      <Button type="submit" size="lg" variant="clay" className="w-full" disabled={busy}>
        {busy ? 'Sending…' : 'Send message'}
      </Button>
      <p className="text-[11.5px] text-ink-500">
        We never share your details. Reply lands by email or WhatsApp.
      </p>
    </form>
  );
}
