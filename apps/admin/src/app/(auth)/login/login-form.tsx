'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { loginAction, totpVerifyAction } from './actions';

type Step = 'credentials' | 'totp';

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
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
      const result = await loginAction({ email, password });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      if (result.nextStage === 'complete') {
        // TOTP bypassed via ADMIN_TOTP_REQUIRED=false — session already issued, go straight in.
        toast.success('Signed in');
        router.replace(next && next.startsWith('/') ? next : '/dashboard');
        return;
      }
      if (result.nextStage === 'totp_enrollment') {
        router.push(next ? `/totp/enroll?next=${encodeURIComponent(next)}` : '/totp/enroll');
        return;
      }
      setStep('totp');
    });
  }

  function onSubmitTotp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await totpVerifyAction({ code });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success('Signed in');
      router.replace(next && next.startsWith('/') ? next : '/dashboard');
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
