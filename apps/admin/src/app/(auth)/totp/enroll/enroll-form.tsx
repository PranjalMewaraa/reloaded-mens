'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { totpEnrollAction, totpSetupAction } from './actions';

export function EnrollForm({ next }: { next?: string }) {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    startTransition(async () => {
      const res = await totpSetupAction();
      if (!res.ok) {
        setSetupError(res.error);
        return;
      }
      setQrDataUrl(res.qrDataUrl);
      setSecret(res.secretBase32);
    });
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setVerifyError(null);
    startTransition(async () => {
      const res = await totpEnrollAction({ code });
      if (!res.ok) {
        setVerifyError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success('Two-factor enabled');
      router.replace(next && next.startsWith('/') ? next : '/dashboard');
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up two-factor</CardTitle>
        <CardDescription>
          Scan this QR with Google Authenticator, Authy, or 1Password. Then enter the 6-digit code
          to finish setup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {setupError ? (
          <p className="text-sm text-destructive">{setupError}</p>
        ) : qrDataUrl ? (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded border bg-white p-2">
              {/* QR is a data URL; <img> is correct here — next/image's optimizer can't serve data URLs. */}
              <img src={qrDataUrl} alt="TOTP QR code" width={224} height={224} />
            </div>
            {secret ? (
              <p className="break-all text-center font-mono text-xs text-muted-foreground">
                Manual entry: {secret}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Generating QR…</p>
        )}

        <form className="space-y-4" onSubmit={onSubmit}>
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
          {verifyError ? <p className="text-sm text-destructive">{verifyError}</p> : null}
          <Button
            type="submit"
            className="w-full"
            disabled={pending || code.length !== 6 || !qrDataUrl}
          >
            {pending ? 'Verifying…' : 'Verify and enable'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
