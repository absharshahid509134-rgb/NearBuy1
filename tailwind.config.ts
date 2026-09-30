/** NearBuy Design Tokens — see docs/DESIGN-SYSTEM.md */
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // NearBlue — primary brand
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#2563EB',
          600: '#1D4ED8',
          700: '#1E40AF',
          800: '#1E3A8A',
          900: '#172554',
        },
        // Sky / discovery (Nearby Blue #0284C7)
        sky: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
        },
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#16A34A',
          600: '#15803D',
          700: '#166534',
          800: '#166534',
          900: '#14532D',
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FBBF24',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
          900: '#78350F',
        },
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#DC2626',
          600: '#B91C1C',
          700: '#991B1B',
        },
        info: {
          50: '#F0F9FF',
          500: '#0284C7',
          600: '#0369A1',
        },
        // Blue-tinted neutrals
        neutral: {
          0: '#FFFFFF',
          25: '#FCFDFF',
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // NearBuy special signals
        nearby: '#0284C7',
        available: '#16A34A',
        fast: '#EA580C',
        reserve: '#7C3AED',
        deal: '#E11D48',
        // Reservation surfaces
        reservebg: '#F5F3FF',
        reserveborder: '#DDD6FE',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', '"Noto Sans Devanagari"', 'ui-sans-serif', 'sans-serif'],
        data: ['Inter', '"Plus Jakarta Sans"', 'ui-sans-serif', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '10px', // buttons / inputs
        sm: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px', // primary cards / search
        '2xl': '20px', // modals
        '3xl': '24px', // bottom sheets / hero
      },
      boxShadow: {
        soft: '0 1px 3px rgba(15,23,42,0.06)',
        DEFAULT: '0 4px 12px rgba(15,23,42,0.08)',
        medium: '0 4px 12px rgba(15,23,42,0.08)',
        large: '0 12px 32px rgba(15,23,42,0.10)',
        search: '0 4px 20px rgba(15,23,42,0.06)',
      },
      fontSize: {
        // Desktop scale
        'display-xl': ['64px', { lineHeight: '72px', letterSpacing: '-2px', fontWeight: '700' }],
        'display-lg': ['56px', { lineHeight: '64px', letterSpacing: '-1.5px', fontWeight: '700' }],
        'display-md': ['48px', { lineHeight: '56px', letterSpacing: '-1px', fontWeight: '700' }],
        h1: ['40px', { lineHeight: '48px', fontWeight: '700' }],
        h2: ['32px', { lineHeight: '40px', fontWeight: '700' }],
        h3: ['24px', { lineHeight: '32px', fontWeight: '700' }],
        h4: ['20px', { lineHeight: '28px', fontWeight: '700' }],
        h5: ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '28px' }],
        body: ['16px', { lineHeight: '24px' }],
        'body-sm': ['14px', { lineHeight: '20px' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '500' }],
        // Mobile scale
        'm-hero': ['32px', { lineHeight: '38px', fontWeight: '700' }],
        'm-h1': ['28px', { lineHeight: '36px', fontWeight: '700' }],
        'm-h2': ['24px', { lineHeight: '32px', fontWeight: '700' }],
        'm-h3': ['20px', { lineHeight: '28px', fontWeight: '700' }],
        'm-body': ['15px', { lineHeight: '23px' }],
        'm-sm': ['13px', { lineHeight: '19px' }],
      },
      maxWidth: {
        content: '1440px',
        ideal: '1280px',
      },
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        pop: {
          '0%': { transform: 'scale(0.92)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        slideup: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.4s linear infinite',
        pop: 'pop 0.3s ease-out both',
        slideup: 'slideup 0.25s ease-out both',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        modal: '250ms',
      },
    },
  },
  plugins: [],
} satisfies Config
