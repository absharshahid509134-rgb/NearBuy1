/**
 * @nearbuy/maps — MapProvider abstraction. Business logic never couples to a
 * single maps vendor: swap HaversineProvider for GoogleMapsProvider via config.
 */
export interface LatLng {
  lat: number
  lng: number
}

export interface PlaceResult {
  label: string
  address: string
  lat: number
  lng: number
}

export interface MapProvider {
  readonly name: string
  distanceKm(a: LatLng, b: LatLng): number
  geocode(query: string): Promise<PlaceResult[]>
  reverseGeocode(p: LatLng): Promise<PlaceResult | null>
  estimateTravelMins(a: LatLng, b: LatLng, mode: 'walk' | 'drive'): number
}

/** Haversine — always available, no external calls. */
export class HaversineProvider implements MapProvider {
  readonly name: string = 'haversine'

  distanceKm(a: LatLng, b: LatLng): number {
    const R = 6371
    const dLat = ((b.lat - a.lat) * Math.PI) / 180
    const dLng = ((b.lng - a.lng) * Math.PI) / 180
    const la1 = (a.lat * Math.PI) / 180
    const la2 = (b.lat * Math.PI) / 180
    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(h))
  }

  async geocode(query: string): Promise<PlaceResult[]> {
    // Coarse local index for dev/demo — provider interface keeps this swappable.
    const known: PlaceResult[] = [
      { label: 'Dwarka Sector 22', address: 'Sector 22, Dwarka, Delhi', lat: 28.5921, lng: 77.046 },
      { label: 'Dwarka Sector 21', address: 'Sector 21, Dwarka, Delhi', lat: 28.5895, lng: 77.0531 },
      { label: 'Dwarka Sector 23', address: 'Sector 23, Dwarka, Delhi', lat: 28.5962, lng: 77.0405 },
      { label: 'Dwarka Sector 19', address: 'Sector 19, Dwarka, Delhi', lat: 28.5878, lng: 77.0473 },
    ]
    const q = query.toLowerCase()
    return known.filter((p) => p.label.toLowerCase().includes(q) || q.includes('dwarka'))
  }

  async reverseGeocode(p: LatLng): Promise<PlaceResult | null> {
    return { label: 'Dwarka Area', address: `Near ${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}, Delhi`, ...p }
  }

  estimateTravelMins(a: LatLng, b: LatLng, mode: 'walk' | 'drive'): number {
    const km = this.distanceKm(a, b)
    const speed = mode === 'walk' ? 4.5 : 18 // km/h average city
    return Math.max(5, Math.round((km / speed) * 60))
  }
}

/** Google Maps adapter — used when MAPS_PROVIDER=google and MAPS_API_KEY is set. */
export class GoogleMapsProvider extends HaversineProvider {
  override readonly name = 'google'
  constructor(private readonly apiKey: string) {
    super()
  }
  override async geocode(query: string): Promise<PlaceResult[]> {
    if (!this.apiKey) return super.geocode(query)
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${this.apiKey}`
      const res = await fetch(url)
      const json = (await res.json()) as { results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[] }
      return (json.results ?? []).map((r) => ({
        label: r.formatted_address.split(',').slice(0, 2).join(','),
        address: r.formatted_address,
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
      }))
    } catch {
      return super.geocode(query)
    }
  }
}

export function createMapProvider(kind: 'haversine' | 'google', apiKey?: string): MapProvider {
  return kind === 'google' && apiKey ? new GoogleMapsProvider(apiKey) : new HaversineProvider()
}
