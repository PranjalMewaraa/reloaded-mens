import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// MOOL admin design tokens.
// - Colors: full ink scale + brand (clay, moss) + semantic (info/success/warning/danger) with light tints.
// - shadcn CSS vars are still defined in globals.css (mapped to MOOL values) so shadcn primitives Just Work.
// - Additional MOOL tokens (ink-50…900, clay-700, moss, info-100…) are declared directly here for new components.
// - Radii: MOOL's xs..3xl scale (6→28px) replaces Tailwind's defaults.
// - Mono font for caps labels, dates, SKUs.

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
        // Alias for places the design system calls "display" (same family, used with tighter tracking).
        display: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // shadcn semantic tokens — populated by CSS vars in globals.css.
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

        // MOOL brand tokens — direct hex, not behind CSS vars (no dark mode at launch).
        bone: '#F4F4F5',
        paper: '#FFFFFF',
        snow: '#FFFFFF',
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
        info: {
          DEFAULT: '#1D4ED8',
          100: '#DBEAFE',
        },
        success: {
          DEFAULT: '#15803D',
          100: '#DCFCE7',
        },
        warning: {
          DEFAULT: '#B45309',
          100: '#FEF3C7',
        },
        danger: {
          DEFAULT: '#DC2626',
          100: '#FEE2E2',
        },
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
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
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
