export type Portal = 'customer' | 'seller' | 'rider' | 'admin'

export type AccountRole =
  | 'CUSTOMER'
  | 'SELLER'
  | 'SELLER_EMPLOYEE'
  | 'STORE_STAFF'
  | 'DELIVERY_PARTNER'
  | 'ADMIN'
  | 'SUPER_ADMIN'
  | 'SUPPORT_AGENT'
  | 'WAREHOUSE_STAFF'
  | 'CONTENT_MANAGER'
  | 'FINANCE_ADMIN'
  | 'LOGISTICS_ADMIN'
  | 'PRODUCT_ADMIN'

export interface AuthUser {
  id: string
  name: string
  role: AccountRole
}

export const PORTALS = {
  customer: {
    name: 'Customer',
    title: 'Your neighbourhood, on your terms.',
    description: 'Discover what is close, compare your options, and get it your way.',
    home: '/customer',
    role: 'CUSTOMER',
  },
  seller: {
    name: 'Seller Hub',
    title: 'Your shop has a bigger neighbourhood.',
    description: 'Keep your shelves in sync and your next customer close.',
    home: '/seller',
    role: 'SELLER',
  },
  rider: {
    name: 'Rider Hub',
    title: 'Make every trip count.',
    description: 'Find nearby deliveries, stay on route, and track what you earn.',
    home: '/rider',
    role: 'DELIVERY_PARTNER',
  },
  admin: {
    name: 'Operations',
    title: 'Keep the neighbourhood moving.',
    description: 'A private workspace for the NearBuy operations team.',
    home: '/admin',
    role: 'ADMIN',
  },
} as const

const allowed: Record<Portal, AccountRole[]> = {
  customer: ['CUSTOMER'],
  seller: ['SELLER'],
  rider: ['DELIVERY_PARTNER'],
  admin: ['ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT'],
}

export function isPortal(value: string | undefined): value is Portal {
  return value === 'customer' || value === 'seller' || value === 'rider' || value === 'admin'
}

export function canAccess(user: AuthUser, portal: Portal): boolean {
  return allowed[portal].includes(user.role)
}

export function portalForRole(role: AccountRole): Portal | null {
  if (allowed.customer.includes(role)) return 'customer'
  if (allowed.seller.includes(role)) return 'seller'
  if (allowed.rider.includes(role)) return 'rider'
  if (allowed.admin.includes(role)) return 'admin'
  return null
}

export function homeForUser(user: AuthUser): string {
  const portal = portalForRole(user.role)
  return portal ? PORTALS[portal].home : '/unavailable'
}

/** Only return-to paths inside the chosen workspace are accepted after sign-in. */
export function safeReturnTo(value: string | null, portal: Portal): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return PORTALS[portal].home
  const path = value.split(/[?#]/, 1)[0]
  if (portal === 'customer') {
    const customerPaths = [
      '/customer',
      '/search',
      '/explore',
      '/nearby',
      '/nearby-now',
      '/stores',
      '/product',
      '/store',
      '/cart',
      '/checkout',
      '/orders',
      '/reservations',
      '/wishlist',
      '/deals',
      '/local-market',
      '/nearai',
      '/account',
    ]
    return customerPaths.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
      ? value
      : PORTALS.customer.home
  }
  const root = PORTALS[portal].home
  return path === root || path.startsWith(`${root}/`) ? value : root
}
