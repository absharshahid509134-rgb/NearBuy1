import { Link, useNavigate } from 'react-router-dom'
import { Heart, MapPin, Package, QrCode, ShieldCheck, Sparkles, Store as StoreIcon, User } from 'lucide-react'
import { CUSTOMER_LOCATION } from '../data/catalog'
import { QuickLink } from '../components/layout'
import { SignOutButton } from '../components/SignOutButton'
import { LocationChip, SectionHeading } from '../components/ui'
import { useApp } from '../store/AppContext'
import { useAuth } from '../auth/AuthContext'

export default function Account() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { orders, reservations, wishlist, followed } = useApp()
  const initials =
    user?.name
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'NB'
  return (
    <div className="nb-container py-6 lg:py-10 space-y-8 max-w-3xl">
      <div className="nb-card p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary-500 text-white text-h4 font-extrabold flex items-center justify-center">
          {initials}
        </div>
        <div className="flex-1">
          <p className="text-caption text-primary-600 font-bold uppercase tracking-widest">
            Your customer space
          </p>
          <h1 className="text-h4 font-bold mt-1">{user?.name || 'NearBuy Customer'}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <LocationChip label={CUSTOMER_LOCATION.label} />
            <span className="text-caption text-success-700 bg-success-50 px-2 py-1 rounded-full font-bold inline-flex items-center gap-1">
              <ShieldCheck size={13} /> Customer account
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Orders', orders.length, '/orders'],
          ['Reservations', reservations.length, '/reservations'],
          ['Wishlist', wishlist.length, '/wishlist'],
          ['Stores followed', followed.length, '/stores'],
        ].map(([label, count, to]) => (
          <button
            key={label as string}
            onClick={() => navigate(to as string)}
            className="nb-card p-4 text-center hover:shadow-medium transition-shadow min-h-touch"
          >
            <p className="font-data text-h3 font-extrabold">{count as number}</p>
            <p className="text-caption text-neutral-500 mt-1">{label as string}</p>
          </button>
        ))}
      </div>
      <section className="space-y-3">
        <SectionHeading title="Your shopping" />
        <QuickLink to="/orders" icon={<Package size={20} />} label="Orders & tracking" />
        <QuickLink to="/reservations" icon={<QrCode size={20} />} label="Reservations & pickup codes" />
        <QuickLink to="/wishlist" icon={<Heart size={20} />} label="Saved items" />
        <QuickLink to="/local-market" icon={<StoreIcon size={20} />} label="Explore the Local Market" />
      </section>
      <div className="nb-card p-6 bg-gradient-to-r from-primary-50 to-white border-primary-100">
        <div className="flex items-center gap-2 text-primary-600">
          <Sparkles size={19} />
          <span className="text-caption font-extrabold uppercase tracking-wide">YOUR OWN WORKSPACE</span>
        </div>
        <h2 className="text-h5 font-bold mt-2">Shopping, without the mix-up.</h2>
        <p className="text-body-sm text-neutral-600 mt-2 max-w-xl">
          You’re signed in as a customer. Your shopping information stays in your account. Seller Hub and
          Rider Hub require their own accounts and sign-in pages.
        </p>
        <div className="flex flex-wrap items-center gap-4 mt-5">
          <SignOutButton className="inline-flex items-center gap-2 rounded-md bg-neutral-900 text-white px-4 py-2.5 text-body-sm font-bold hover:bg-neutral-700" />
          <Link to="/" className="text-primary-600 text-body-sm font-semibold hover:underline">
            About NearBuy →
          </Link>
        </div>
      </div>
      {__NEARBUY_PREVIEW__ && (
        <p className="text-caption text-neutral-500 flex items-start gap-2">
          <MapPin size={15} className="shrink-0" /> Marketplace products and local shopping activity in this
          preview are sample data. Your local cart and wishlist are separate from other accounts on this
          device.
        </p>
      )}
    </div>
  )
}
