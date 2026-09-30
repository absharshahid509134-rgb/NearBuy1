import type { Config } from 'tailwindcss'
/**
 * NearBuy design tokens — shared Tailwind preset.
 * Storefront look (blueprint §77, original identity): deep blue primary,
 * warm bright-yellow accent, #F5F7FA canvas, Inter.
 */

export const nearbuyPreset: Partial<Config> = {
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
        primary: {
          50: '#E8EDF9', 100: '#D3DCF0', 200: '#A9BBE0', 300: '#7F99CF', 400: '#4D6DB4',
          500: '#2B509A', 600: '#1E3A8A', 700: '#1A3278', 800: '#14275C', 900: '#0E1B42',
          DEFAULT: '#1E3A8A',
        },
        accent: {
          50: '#FEF3DC', 100: '#FDE9BC', 200: '#FBD98A', 300: '#F8C45B', 400: '#F5A623',
          500: '#E09410', 600: '#B8770A', 700: '#8C5A07',
          DEFAULT: '#F5A623',
        },
        success: {
          50: '#E7F6EC', 100: '#DCFCE7', 200: '#BBF7D0', 300: '#86EFAC', 400: '#4ADE80',
          500: '#16A34A', 600: '#15803D', 700: '#166534',
          DEFAULT: '#16A34A',
        },
        warning: {
          50: '#FDF0DC', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D', 400: '#FBBF24',
          500: '#D97706', 600: '#B45309', 700: '#92400E',
          DEFAULT: '#D97706',
        },
        error: {
          50: '#FCE9E9', 100: '#FEE2E2', 200: '#FECACA', 300: '#FCA5A5', 400: '#F87171',
          500: '#DC2626', 600: '#B91C1C', 700: '#991B1B',
          DEFAULT: '#DC2626',
        },
        info: {
          50: '#E5F3FA', 100: '#E0F2FE', 500: '#0284C7', 600: '#0369A1', 700: '#0C4A6E',
          DEFAULT: '#0284C7',
        },
        ink: {
          DEFAULT: '#0F172A', secondary: '#475569', muted: '#64748B', fg: '#FFFFFF',
        },
        canvas: '#F5F7FA',
        card: '#FFFFFF',
        border: '#E2E8F0',
        nearby: '#0284C7',
        available: '#16A34A',
        fast: '#EA580C',
        reserve: '#7C3AED',
        reservebg: '#F5F3FF',
        reserveborder: '#DDD6FE',
        deal: '#E11D48',
      },
      fontFamily: {
        sans: ["'Inter'", 'ui-sans-serif', 'system-ui', '-apple-system', "'Segoe UI'", 'sans-serif'],
      },
      fontSize: {
        price: ['1.375rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.01em' }],
        'price-lg': ['1.875rem', { lineHeight: '1.15', fontWeight: '700', letterSpacing: '-0.01em' }],
      },
      borderRadius: {
        card: '8px',
        lg: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
        pop: '0 8px 24px rgba(15, 23, 42, 0.12)',
      },
    },
  },
}
