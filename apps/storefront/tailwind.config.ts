import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// MOOL storefront design tokens — customer-facing variant.
// - Same palette as admin (ink scale, clay, moss, semantic tints) so brand stays consistent.
// - Adds 'paper' / 'bone' surfaces, MOOL radii (xs..3xl), soft shadow scale.
// - shadcn-style CSS vars live in globals.css for downstream primitives.

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
        // Serif italic display face is used for the wordmark + a few hero accents on the
        // storefront (admin doesn't use it). Falls back to the same Jakarta stack so the
        // app still renders if the font isn't loaded.
        display: ['var(--font-fraunces)', 'Georgia', 'serif'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        bone: '#F9FAFB',
        paper: '#FFFFFF',
        snow: '#FFFFFF',
        sand: '#F5F6F8',
        ink: {
          50: '#F4F4F5',
          100: '#E4E4E7',
          200: '#D4D4D8',
          300: '#A1A1AA',
          400: '#71717A',
          500: '#52525B',
          600: '#27272A',
          700: '#1A1A1A',
          800: '#111111',
          900: '#0A0A0A',
        },
        clay: {
          DEFAULT: '#FF5B00',
          700: '#E54F00',
          200: '#FFE0CC',
        },
        moss: {
          DEFAULT: '#2D5A43',
          100: '#E3EDE6',
        },
        // WhatsApp green — used by the talk-to-stylist card + in-store-only CTA.
        whatsapp: '#1F8A4D',
        info: { DEFAULT: '#1D4ED8', 100: '#DBEAFE' },
        success: { DEFAULT: '#15803D', 100: '#DCFCE7' },
        warning: { DEFAULT: '#B45309', 100: '#FEF3C7' },
        danger: { DEFAULT: '#DC2626', 100: '#FEE2E2' },
      },
      borderRadius: {
        xs: '6px',
        sm: '10px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '28px',
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.04)',
        'soft-md':
          '0 4px 6px -1px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04), 0 0 0 1px rgb(0 0 0 / 0.04)',
        'soft-lg':
          '0 12px 24px -8px rgb(0 0 0 / 0.10), 0 4px 8px -4px rgb(0 0 0 / 0.06), 0 0 0 1px rgb(0 0 0 / 0.04)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-600px 0' },
          '100%': { backgroundPosition: '600px 0' },
        },
        // The `Marquee` component duplicates its inner strip so a -50% translate
        // lands the second copy in the position the first one started at — the
        // wrap is invisible. Keep the translate at exactly -50%; anything else
        // and you see the seam jump.
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        // Default-speed marquee — Marquee component overrides via inline style
        // when callers want to tune it.
        marquee: 'marquee 40s linear infinite',
      },
      letterSpacing: {
        tight: '-0.025em',
        display: '-0.02em',
        caps: '0.18em',
      },
    },
  },
  plugins: [animate],
};

export default config;
