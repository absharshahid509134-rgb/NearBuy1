/** Seasonal collection templates — product membership is derived from the
 * live catalog by persisted category slug, never from hard-coded ids. */
export const COLLECTION_DEFS = [
  { id: 'c1', name: '🏏 Cricket Season', emoji: '🏏', tint: '#EFF6FF', categories: ['sports'], blurb: 'Bats, balls & team gear' },
  { id: 'c2', name: '🎒 Back to School', emoji: '🎒', tint: '#F5F3FF', categories: ['school-supplies', 'stationery'], blurb: 'Everything for the new term' },
  { id: 'c3', name: '📚 Reading Corner', emoji: '📚', tint: '#FFF7ED', categories: ['books'], blurb: 'Stories for every age' },
  { id: 'c4', name: '🏠 Home Essentials', emoji: '🏠', tint: '#F0FDF4', categories: ['home-kitchen'], blurb: 'Daily life, covered' },
  { id: 'c5', name: '👗 Wardrobe Refresh', emoji: '👗', tint: '#FDF2F8', categories: ['fashion'], blurb: 'Fresh finds, local fits' },
  { id: 'c6', name: '📱 Tech Deals', emoji: '📱', tint: '#ECFEFF', categories: ['electronics'], blurb: 'Audio, charging & more' },
]
