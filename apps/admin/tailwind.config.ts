import type { Config } from 'tailwindcss'
import { nearbuyPreset } from '../../packages/config/src/tailwind-preset'

export default {
  presets: [nearbuyPreset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
} satisfies Config
