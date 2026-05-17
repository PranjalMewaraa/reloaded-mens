'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCustomer } from '@/lib/customer-context';
import { CustomerApiError, requestOtp, verifyOtp } from '@/lib/customer-api';

interface Props {
  nextHref: string;
}

type Step = 'phone' | 'code';

function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('919')) return `+${digits.slice(1)}`;
  return input.trim();
}

export function LoginFlow({ nextHref }: Props) {
  const router = useRouter();
  const { refresh } = useCustomer();
  const [step, setStep] = React.useState<Step>('phone');
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [deliveredTo, setDeliveredTo] = React.useState<string>('');
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setTimeout(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [resendCooldown]);

  async function submitPhone(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const normalized = normalizePhone(phone);
    if (!/^\+91[6-9]\d{9}$/.test(normalized)) {
      setError('Enter a valid Indian mobile (10 digits, starting 6–9).');
      return;
    }
    setBusy(true);
    try {
      const res = await requestOtp({ phone: normalized });
      setPhone(normalized);
      setDeliveredTo(res.deliveredTo);
      setResendCooldown(30);
      setStep('code');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    try {
      await verifyOtp({ phone, code });
      await refresh();
      toast.success('Signed in');
      router.push(nextHref);
    } catch (err) {
      if (err instanceof CustomerApiError) {
        setError(err.body.message?.toString() ?? err.message);
      } else {
        setError((err as Error).message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (resendCooldown > 0) return;
    setError(null);
    setBusy(true);
    try {
      const res = await requestOtp({ phone });
      setDeliveredTo(res.deliveredTo);
      setResendCooldown(30);
      toast.success('New code sent');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      {step === 'phone' ? (
        <form onSubmit={submitPhone} className="space-y-3">
          <div>
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="98765 43210"
              inputMode="numeric"
              autoFocus
              autoComplete="tel-national"
            />
          </div>
          {error ? <p className="text-[12px] text-danger">{error}</p> : null}
          <Button type="submit" size="lg" variant="clay" className="w-full" disabled={busy}>
            {busy ? 'Sending code…' : 'Email me a code'}
          </Button>
          <p className="text-[11.5px] text-ink-500">
            The code is delivered to the email saved on your most recent order. Need help?{' '}
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^0-9]/g, '') ?? ''}`}
              target="_blank"
              rel="noreferrer"
              className="underline-offset-2 hover:underline"
            >
              WhatsApp us
            </a>
            .
          </p>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-3">
          <div>
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              className="font-mono text-center text-[20px] tracking-[0.4em]"
            />
            <p className="mt-1 text-[11.5px] text-ink-500">
              {deliveredTo ? `Sent to ${deliveredTo}.` : 'Sent — check your inbox.'} Code expires in
              10 minutes.
            </p>
          </div>
          {error ? <p className="text-[12px] text-danger">{error}</p> : null}
          <Button type="submit" size="lg" variant="clay" className="w-full" disabled={busy}>
            {busy ? 'Verifying…' : 'Sign in'}
          </Button>
          <div className="flex items-center justify-between text-[12px]">
            <button
              type="button"
              onClick={() => {
                setStep('phone');
                setCode('');
                setError(null);
              }}
              className="text-ink-500 underline-offset-2 hover:underline"
            >
              Use a different number
            </button>
            <button
              type="button"
              onClick={resend}
              disabled={resendCooldown > 0 || busy}
              className="text-ink-500 underline-offset-2 hover:underline disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
