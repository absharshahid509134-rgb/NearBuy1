import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export * from './tokens'
export * from './strings'
export * from './primitives'
export * from './commerce'
export * from './signature'
export * from './shell'

/** Canonical className joiner (clsx + tailwind-merge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** Money formatting shared by every surface (server computes amounts). */
export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
}
