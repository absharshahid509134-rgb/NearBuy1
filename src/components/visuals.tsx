import type { LucideIcon } from 'lucide-react'
import {
  Backpack, BookOpen, Coffee, Dumbbell, Footprints, Gift, Headphones, House,
  Laptop, Lightbulb, NotebookPen, Package, Paintbrush, PenLine, PlugZap,
  ShoppingBasket, Shirt, Smartphone, Trophy,
} from 'lucide-react'
import type { CategoryId, Product } from '../data/types'

const categories: Record<CategoryId, LucideIcon> = {
  sports: Dumbbell,
  electronics: Headphones,
  stationery: NotebookPen,
  fashion: Backpack,
  home: House,
  grocery: ShoppingBasket,
  handmade: Paintbrush,
  gifts: Gift,
}

/** Real vector glyphs keep product and category cards recognisable even when
 * the device has no colour emoji font (common in preview containers). */
export function iconForProduct(product: Product): LucideIcon {
  const name = product.name.toLowerCase()
  if (/headphone|earbud|speaker/.test(name)) return Headphones
  if (/laptop|notebook pack|keyboard|mouse/.test(name)) return Laptop
  if (/charger|cable|power bank|adapter/.test(name)) return PlugZap
  if (/phone|mobile/.test(name)) return Smartphone
  if (/bat|racquet|cricket/.test(name)) return Trophy
  if (/football|volleyball|sports|training/.test(name)) return Dumbbell
  if (/shoe|sneaker/.test(name)) return Footprints
  if (/pen|pencil|marker/.test(name)) return PenLine
  if (/book|journal|diary|paper/.test(name)) return BookOpen
  if (/bag|backpack/.test(name)) return Backpack
  if (/shirt|fashion|jacket/.test(name)) return Shirt
  if (/lamp|light/.test(name)) return Lightbulb
  if (/coffee|tea|mug/.test(name)) return Coffee
  return categories[product.category] ?? Package
}

export function CategoryIcon({ category, size = 25, className = '' }: { category: CategoryId; size?: number; className?: string }) {
  const Icon = categories[category] ?? Package
  return <Icon size={size} strokeWidth={1.8} className={className} aria-hidden="true" />
}
