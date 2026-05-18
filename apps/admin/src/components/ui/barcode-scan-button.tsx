'use client';

// Sprint 9 Phase 3b — progressive-enhancement barcode scan. Uses the browser
// BarcodeDetector API where available (Chrome on Android, recent Chromium
// desktops). Falls back to a "Type SKU" hint when unsupported; we render
// nothing rather than confusing the operator with a button that does nothing.
//
// On scan, fires onDetected(decodedText). Caller decides what to do with it
// (typically populate a search input).

import * as React from 'react';
import { ScanLine, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

// Bare-bones type for window.BarcodeDetector — present on Chrome/Android,
// Chromium desktops. Other browsers fall through to the not-supported path.
declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}
interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
}
interface BarcodeDetectorInstance {
  detect(image: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

interface BarcodeScanButtonProps {
  onDetected: (value: string) => void;
  className?: string;
}

export function BarcodeScanButton({ onDetected, className }: BarcodeScanButtonProps) {
  const [supported, setSupported] = React.useState<boolean | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setSupported(typeof window !== 'undefined' && Boolean(window.BarcodeDetector));
  }, []);

  // Hide the button entirely on unsupported browsers so we don't pretend to
  // offer a feature that doesn't work.
  if (supported === false) return null;
  if (supported === null) return null; // SSR / pre-check phase

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={className}
        onClick={() => setOpen(true)}
        aria-label="Scan barcode"
      >
        <ScanLine className="h-4 w-4" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex max-h-[92vh] flex-col rounded-t-2xl p-0 [&>button]:hidden"
        >
          <SheetHeader className="border-b border-ink-100 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <SheetTitle>Scan barcode</SheetTitle>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-ink-50"
                aria-label="Close scanner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </SheetHeader>
          <div className="flex-1 p-5 pb-[max(theme(spacing.5),env(safe-area-inset-bottom))]">
            <ScannerCanvas
              onDetected={(value) => {
                onDetected(value);
                setOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function ScannerCanvas({ onDetected }: { onDetected: (value: string) => void }) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const stopRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera not available');
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        if (!v) return;
        v.srcObject = stream;
        await v.play();

        const Detector = window.BarcodeDetector!;
        const detector = new Detector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'qr_code'],
        });

        intervalId = setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0].rawValue) {
              onDetected(codes[0].rawValue);
            }
          } catch {
            // Detection blips happen on some frames; swallow and try the next.
          }
        }, 350);
      } catch (err) {
        setError((err as Error).message || 'Could not start camera');
      }
    }
    void start();

    stopRef.current = () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      stream?.getTracks().forEach((t) => t.stop());
    };
    return () => {
      stopRef.current();
    };
  }, [onDetected]);

  if (error) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-[13px] text-danger">
        {error}. Type the SKU into the search box instead.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-900">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-px -translate-y-1/2 bg-clay" />
      </div>
      <p className="text-center text-[12.5px] text-ink-500">
        Hold the barcode in the centre of the frame. Detection is automatic.
      </p>
    </div>
  );
}
