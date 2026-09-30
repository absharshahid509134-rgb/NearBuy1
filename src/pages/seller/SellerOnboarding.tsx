import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, MapPin, Store } from 'lucide-react'
import { api } from '../../auth/api'
import { CUSTOMER_LOCATION } from '../../data/catalog'
import { useSeller } from '../../seller/SellerContext'
import { HubLoading } from '../../seller/components'

export default function SellerOnboarding() {
  const { profile, loading, refresh } = useSeller()
  const navigate = useNavigate()
  const [legalName, setLegalName] = useState('')
  const [storeName, setStoreName] = useState('')
  const [category, setCategory] = useState('Grocery')
  const [blurb, setBlurb] = useState('')
  const [hours, setHours] = useState('9:00 AM – 9:00 PM')
  const [area, setArea] = useState('Dwarka Sector 22')
  const [address, setAddress] = useState('')
  const [pincode, setPincode] = useState('110077')
  const [lat, setLat] = useState(String(CUSTOMER_LOCATION.lat))
  const [lng, setLng] = useState(String(CUSTOMER_LOCATION.lng))
  const [pinStatus, setPinStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (loading && !profile) return <HubLoading />
  if (profile) return <Navigate to="/seller" replace />
  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setPinStatus('Location is unavailable. Enter the coordinates manually.')
      return
    }
    setPinStatus('Finding your store location…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLat(coords.latitude.toFixed(6))
        setLng(coords.longitude.toFixed(6))
        setPinStatus('Map pin updated. Please confirm you are at your store.')
      },
      () => setPinStatus('Could not find your location. Enter the coordinates manually.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/sellers/register', {
        legalName: legalName.trim(),
        store: {
          name: storeName.trim(),
          category,
          blurb: blurb.trim() || 'Neighbourhood store on NearBuy.',
          hours: hours.trim() || '9:00 AM – 9:00 PM',
          area: area.trim(),
          address: address.trim(),
          pincode,
          lat: Number(lat),
          lng: Number(lng),
          opensAt: '9:00 AM',
          emoji: '🏪',
        },
      })
      await refresh()
      navigate('/seller', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not set up your store. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="hub-onboarding">
      <div className="hub-onboard-heading">
        <span className="hub-onboard-icon">
          <Store size={27} />
        </span>
        <p className="hub-overline dark">WELCOME TO SELLER HUB</p>
        <h1>Let’s get your store ready.</h1>
        <p>A few details now, then your own space to manage orders, stock and local customers.</p>
      </div>
      <div className="hub-onboard-grid">
        <form onSubmit={(e) => void submit(e)} className="hub-panel hub-onboard-form">
          <div className="hub-panel-heading">
            <div>
              <p className="hub-panel-eyebrow">STEP 1 OF 1</p>
              <h2>Tell us about your store</h2>
            </div>
          </div>
          <label>
            Registered business name
            <input
              required
              minLength={2}
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Your business or trading name"
            />
          </label>
          <label>
            Store name
            <input
              required
              minLength={2}
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="What neighbours call your store"
            />
          </label>
          <div className="hub-form-row">
            <label>
              Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option>Grocery</option>
                <option>Sports</option>
                <option>Electronics</option>
                <option>Stationery</option>
                <option>School Supplies</option>
                <option>Fashion</option>
                <option>Home & Kitchen</option>
                <option>Books</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              PIN code
              <input
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
              />
            </label>
          </div>
          <label>
            Street address
            <input
              required
              minLength={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Shop number, street, landmark"
            />
          </label>
          <label>
            Neighbourhood / area
            <input
              required
              minLength={2}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g. Dwarka Sector 22"
            />
          </label>
          <label>
            One-line description
            <input
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="What shoppers will find at your store"
              maxLength={400}
            />
          </label>
          <label>
            Opening hours
            <input
              required
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="9:00 AM – 9:00 PM"
            />
          </label>
          <div className="hub-pin-heading">
            <div>
              <MapPin size={16} />
              <strong>Place your store on the map</strong>
            </div>
            <button type="button" onClick={useCurrentLocation}>
              Use my current location
            </button>
          </div>
          <div className="hub-form-row">
            <label>
              Latitude
              <input
                required
                type="number"
                step="any"
                min={-90}
                max={90}
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </label>
            <label>
              Longitude
              <input
                required
                type="number"
                step="any"
                min={-180}
                max={180}
                value={lng}
                onChange={(e) => setLng(e.target.value)}
              />
            </label>
          </div>
          <p className="hub-form-note" role="status" aria-live="polite">
            <MapPin size={15} />{' '}
            {pinStatus ||
              'The pin starts in Dwarka. Confirm it matches your store before creating your listing.'}
          </p>
          {error && (
            <div className="hub-inline-error" role="alert">
              {error}
            </div>
          )}
          <button className="hub-primary-button" disabled={busy} type="submit">
            {busy ? 'Creating your store…' : 'Create my store'} <ArrowRight size={18} />
          </button>
        </form>
        <div className="hub-onboard-aside">
          <span className="hub-onboard-aside-icon">✦</span>
          <h3>Good things start here.</h3>
          <p>
            Once your store is set up, you’ll have a place to manage every step of the local shopping
            experience.
          </p>
          <div>
            <span>
              <Check size={17} /> Keep your inventory up to date
            </span>
            <span>
              <Check size={17} /> Confirm orders & reservations
            </span>
            <span>
              <Check size={17} /> See how your shop is growing
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
