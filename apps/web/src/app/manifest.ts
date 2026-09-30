import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NearBuy — What You Need, Already Nearby',
    short_name: 'NearBuy',
    description: 'Search Online. Find Nearby. Reserve. Pickup. Deliver.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F7FA',
    theme_color: '#1E3A8A',
    icons: [{ src: '/images/hero.jpg', sizes: 'any', type: 'image/jpeg' }],
  }
}
