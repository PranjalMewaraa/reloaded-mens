'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'credentials' | 'totp';

export function LoginForm({ next }: { next?: string }) {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const heading = step === 'credentials' ? 'Sign in to admin' : 'Two-factor code';
  const description =
    step === 'credentials'
      ? 'Use your admin email and password.'
      : 'Enter the 6-digit code from your authenticator app.';

  function onSubmitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      let result: { ok: boolean; nextStage?: string; error?: string };
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        result = await res.json();
      } catch {
        setError('Network error — please try again.');
        toast.error('Network error — please try again.');
        return;
      }
      if (!result.ok) {
        const msg = result.error ?? 'Login failed';
        setError(msg);
        toast.error(msg);
        return;
      }
      if (result.nextStage === 'complete') {
        toast.success('Signed in');
        window.location.assign(next && next.startsWith('/') ? next : '/dashboard');
        return;
      }
      if (result.nextStage === 'totp_enrollment') {
        window.location.assign(next ? `/totp/enroll?next=${encodeURIComponent(next)}` : '/totp/enroll');
        return;
      }
      setStep('totp');
    });
  }

  function onSubmitTotp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      let result: { ok: boolean; error?: string };
      try {
        const res = await fetch('/api/auth/totp/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        result = await res.json();
      } catch {
        setError('Network error — please try again.');
        toast.error('Network error — please try again.');
        return;
      }
      if (!result.ok) {
        const msg = result.error ?? 'Verification failed';
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success('Signed in');
      window.location.assign(next && next.startsWith('/') ? next : '/dashboard');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'credentials' ? (
          <form className="space-y-4" onSubmit={onSubmitCredentials}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? 'Signing in…' : 'Continue'}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={onSubmitTotp}>
            <div className="space-y-2">
              <Label htmlFor="code">Authenticator code</Label>
              <Input
                id="code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending || code.length !== 6}>
              {pending ? 'Verifying…' : 'Sign in'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setStep('credentials');
                setCode('');
                setError(null);
              }}
            >
              Back
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
