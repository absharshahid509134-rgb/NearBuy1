import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Clock3, MapPin, ShieldCheck, Store, UserRound } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import { SignOutButton } from '../../components/SignOutButton'
import { useSeller } from '../../seller/SellerContext'
import { HubEmpty, HubError, HubLoading } from '../../seller/components'

export default function SellerAccount() {
  const { user } = useAuth()
  const { profile, loading, error, refresh, setStoreOpen } = useSeller()
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  if (loading && !profile) return <HubLoading />
  if (error) return <HubError message={error} retry={() => void refresh()} />
  const store = profile?.stores[0]
  if (!store) return <HubEmpty title="Your store isn't ready yet" body="Finish onboarding to manage your store." />

  async function toggleOpen() {
    if (!store) return
    setBusy(true)
    setActionError('')
    try { await setStoreOpen(store.id, !store.open) }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not update the store right now.') }
    finally { setBusy(false) }
  }

  return <div className="hub-page">
    <div className="hub-page-header"><div><p className="hub-overline dark">SELLER HUB / YOUR SPACE</p><h1>Store & account</h1><p>Your neighbourhood storefront, with everything in the right place.</p></div></div>
    <div className="seller-account-banner"><span className="seller-account-banner-icon"><Store size={27} /></span><div><p>YOUR STOREFRONT</p><h2>{store.name}</h2><span><MapPin size={15} /> {store.area}</span></div><span className={`seller-account-status ${store.open ? 'open' : ''}`}><span />{store.open ? 'Open for neighbours' : 'Temporarily closed'}</span></div>
    <div className="hub-columns seller-account-columns">
      <section className="hub-panel seller-account-panel" aria-labelledby="seller-store-heading">
        <div className="hub-panel-heading"><div><p className="hub-panel-eyebrow">KEEP YOUR DETAILS CURRENT</p><h2 id="seller-store-heading">Your store</h2></div></div>
        <div className="seller-account-detail"><span><Store size={17} /> Registered business</span><strong>{profile?.legalName}</strong></div>
        <div className="seller-account-detail"><span><MapPin size={17} /> Neighbourhood</span><strong>{store.area}</strong></div>
        {store.address && <div className="seller-account-detail"><span><MapPin size={17} /> Store address</span><strong>{store.address}</strong></div>}
        {store.hours && <div className="seller-account-detail"><span><Clock3 size={17} /> Opening hours</span><strong>{store.hours}</strong></div>}
        <div className="seller-account-detail"><span><BadgeCheck size={17} /> Verification</span><strong>{store.verified ? 'Verified store' : 'Verification in progress'}</strong></div>
        <div className="seller-account-availability"><div><strong>Accepting customers</strong><p>{store.open ? 'Your storefront is shown as open.' : 'Your storefront is shown as closed.'}</p></div><button type="button" role="switch" aria-label="Store open for customers" aria-checked={store.open} disabled={busy} className={`rider-switch ${store.open ? 'on' : ''}`} onClick={() => void toggleOpen()}><span /></button></div>
        {actionError && <div className="hub-inline-error" role="alert">{actionError}</div>}
      </section>
      <div className="hub-aside-stack">
        <section className="hub-panel seller-account-panel" aria-labelledby="seller-you-heading"><span className="seller-account-profile-icon"><UserRound size={23} /></span><p className="hub-panel-eyebrow">YOUR ACCOUNT</p><h2 id="seller-you-heading">{user?.name}</h2><p className="seller-account-caption"><ShieldCheck size={16} /> Seller Hub access only</p><p className="seller-account-helper">This account manages its own store. Shopping and delivery workspaces use their own sign-ins.</p><div className="seller-account-signout"><SignOutButton className="hub-secondary-button" /></div></section>
        <section className="hub-panel seller-account-panel seller-account-switch"><p className="hub-panel-eyebrow">ONE NEARBUY, THREE JOURNEYS</p><h2>See the bigger picture.</h2><p>Explore the customer marketplace and rider experience from the shared NearBuy entrance.</p><Link to="/">Explore all portals <ArrowRight size={16} /></Link></section>
      </div>
    </div>
  </div>
}
