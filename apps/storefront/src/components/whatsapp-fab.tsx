'use client';

import { env } from '@/lib/env';

// Prefill so the store sees that the message came from the website (not
// from a friend's chat thread or a Google search). Keeps the conversation
// scoped from the first reply.
const PREFILL_MESSAGE = "Hi Reloaded! I'm on your website and have a question.";

// Floating chat button. Opens WhatsApp Web / app to the brand's primary
// number with a website-context prefill. Rendered globally by the store
// shell, hidden on checkout (the checkout shell strips it for focus).
//
// Position:
//   - Mobile: bottom-20 right-4 — clears the 16-unit BottomNav with a
//     small gap so the chat icon doesn't collide with the cart icon.
//   - Desktop: bottom-6 right-6 — standard corner offset.
export function WhatsAppFab() {
  // env.NEXT_PUBLIC_WHATSAPP_NUMBER is e.g. "+919958247377". wa.me only
  // accepts digits, so strip every other character.
  const digits = env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^0-9]/g, '');
  if (digits.length === 0) return null;

  const href = `https://wa.me/${digits}?text=${encodeURIComponent(PREFILL_MESSAGE)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="
        fixed bottom-20 right-4 z-40
        flex h-14 w-14 items-center justify-center
        rounded-full bg-whatsapp text-snow
        shadow-[0_8px_24px_-6px_rgba(31,138,77,0.55)]
        transition-transform duration-200
        hover:scale-[1.06] active:scale-95
        md:bottom-6 md:right-6
      "
    >
      <WhatsAppGlyph className="h-7 w-7" />
      {/* Subtle pulse halo on the side — draws the eye on first paint without
          being a vibrating gif-tier annoyance. Pointer-events:none so it
          doesn't intercept the click. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-whatsapp opacity-60 motion-safe:animate-ping"
        style={{ animationDuration: '2.4s' }}
      />
    </a>
  );
}

// WhatsApp's wordmark glyph as inline SVG — lucide doesn't ship a WhatsApp
// icon, and a recognizable mark matters more than a generic chat bubble for
// a CTA this prominent.
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.498 14.382c-.301-.15-1.767-.867-2.04-.966-.273-.099-.473-.15-.673.15-.198.297-.768.967-.94 1.164-.173.199-.347.225-.644.075-.297-.15-1.255-.463-2.39-1.475-.882-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.077 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}
