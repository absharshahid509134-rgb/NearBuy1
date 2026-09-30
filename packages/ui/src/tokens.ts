/**
 * NearBuy design tokens — Storefront look (blueprint §77), original identity.
 * Deep blue primary · warm bright-yellow accent · neutral #F5F7FA canvas.
 */
export const tokens = {
  colors: {
    primary: {
      DEFAULT: '#1E3A8A', // deep blue — headers, primary CTAs, links
      hover: '#1A3278',
      soft: '#E8EDF9',
      fg: '#FFFFFF',
    },
    accent: {
      DEFAULT: '#F5A623', // warm bright yellow — highlights, badges, secondary CTA
      hover: '#E09410',
      soft: '#FEF3DC',
      fg: '#0F172A', // ink on yellow — contrast AA
    },
    success: { DEFAULT: '#16A34A', soft: '#E7F6EC' }, // discounts, delivered
    warning: { DEFAULT: '#D97706', soft: '#FDF0DC' },
    error: { DEFAULT: '#DC2626', soft: '#FCE9E9' },
    info: { DEFAULT: '#0284C7', soft: '#E5F3FA' },
    ink: {
      DEFAULT: '#0F172A', // prices, headings
      secondary: '#475569',
      muted: '#64748B',
      fg: '#FFFFFF',
    },
    canvas: '#F5F7FA', // page background
    card: '#FFFFFF',
    border: '#E2E8F0',
  },
  typography: {
    family: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
    price: { weight: 700, tracking: '-0.01em' }, // prices: large, bold, high contrast
  },
  radius: { sm: '6px', md: '8px', lg: '12px' }, // cards 6–12px
  shadow: {
    card: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
    pop: '0 8px 24px rgba(15, 23, 42, 0.12)',
  },
  breakpoints: { xs: 480, sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 },
} as const

export type Tokens = typeof tokens

/** Status → semantic color, shared by orders, payments, fulfillment, returns. */
export const statusColors = {
  success: ['COMPLETED', 'DELIVERED', 'COLLECTED', 'APPROVED', 'REFUNDED', 'PAID'],
  warning: ['PENDING', 'REQUESTED', 'PACKING', 'PROCESSING', 'INSPECTION'],
  info: ['CONFIRMED', 'ASSIGNED', 'SHIPPED', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'],
  error: ['CANCELLED', 'REJECTED', 'FAILED', 'EXPIRED', 'NO_SHOW', 'BLOCKED'],
} as const

