import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  Check,
  ChevronRight,
  MapPin,
  Navigation2,
  PackageCheck,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
} from 'lucide-react'
import { Brand } from '../components/Brand'
import { useAuth } from '../auth/AuthContext'
import { homeForUser } from '../auth/portals'

const portals = [
  {
    id: 'customer',
    number: '01',
    icon: ShoppingBag,
    kicker: 'For the curious',
    title: 'I’m here to shop',
    description:
      'Find things you love from the stores just around the corner. Compare, reserve, pick up or have it delivered.',
    action: 'Enter the marketplace',
    tint: 'shop',
    image: '/images/local-market.jpg',
    imageAlt: 'Local stores connected to a shopper on NearBuy',
  },
  {
    id: 'seller',
    number: '02',
    icon: Store,
    kicker: 'For the makers & merchants',
    title: 'I run a store',
    description:
      'Bring your shelves online, manage orders with less effort and become the neighbourhood’s first choice.',
    action: 'Open Seller Hub',
    tint: 'sell',
    image: '/images/store-sports.jpg',
    imageAlt: 'Neighbourhood sports shop',
  },
  {
    id: 'rider',
    number: '03',
    icon: Bike,
    kicker: 'For the movers',
    title: 'I deliver locally',
    description:
      'Own your route. Pick up nearby delivery jobs, make seamless handoffs and keep track of what you earn.',
    action: 'Open Rider Hub',
    tint: 'ride',
    image: '/images/rider-neighbourhood.jpg',
    imageAlt: 'Local delivery rider outside a neighbourhood shop in Delhi',
  },
] as const

export default function Landing() {
  const { user, checking } = useAuth()
  return (
    <div className="landing-page min-h-screen overflow-hidden">
      <div className="landing-announce">
        <span className="landing-announce-dot" /> From your street to your doorstep — welcome to a better way
        to buy nearby <ArrowRight size={13} />
      </div>
      <header className="landing-nav">
        <div className="landing-wrap landing-nav-inner">
          <Brand />
          <nav aria-label="Main navigation" className="landing-nav-links">
            <a href="#portals">For everyone</a>
            <a href="#how-it-works">How it works</a>
            <a href="#our-promise">Why NearBuy</a>
          </nav>
          <div className="landing-nav-actions">
            {user ? (
              <Link className="landing-nav-signin" to={homeForUser(user)}>
                My workspace <ArrowUpRight size={16} />
              </Link>
            ) : (
              !checking && (
                <a className="landing-nav-signin" href="#portals">
                  Sign in by role <ArrowUpRight size={16} />
                </a>
              )
            )}
            <a className="landing-nav-cta" href="#portals">
              Find your place <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero landing-wrap" aria-labelledby="hero-title">
          <div className="landing-hero-copy">
            <div className="landing-eyebrow">
              <span className="landing-eyebrow-icon">
                <Sparkles size={15} />
              </span>{' '}
              THE NEIGHBOURHOOD, REIMAGINED
            </div>
            <h1 id="hero-title">
              Everything you need.
              <br />
              <span>Closer than you think.</span>
            </h1>
            <p className="landing-hero-lede">
              Meet the place where local shopping comes together. Discover nearby stores, grow your business
              or deliver something good — all in one connected neighbourhood.
            </p>
            <div className="landing-hero-actions">
              <Link className="landing-button landing-button-primary" to="/login/customer">
                Start shopping <ArrowRight size={19} />
              </Link>
              <a className="landing-button landing-button-outline" href="#portals">
                Explore all portals <ChevronRight size={18} />
              </a>
            </div>
            <nav className="landing-role-quick" aria-label="Choose your NearBuy workspace">
              <p>ONE COMMUNITY. THREE JOURNEYS.</p>
              <div className="landing-role-links">
                {portals.map(({ id, icon: Icon }) => <Link key={id} to={`/login/${id}`} className={`landing-role-link role-${id}`}>
                  <Icon size={18} strokeWidth={1.9} /><span>{id === 'customer' ? 'Shop' : id === 'seller' ? 'Sell' : 'Deliver'}</span><ArrowUpRight size={14} className="landing-role-arrow" />
                </Link>)}
              </div>
            </nav>
          </div>
          <div
            className="landing-hero-art"
            aria-label="Local shops, deliveries and people, all connected by NearBuy"
          >
            <div className="landing-photo-frame">
              <img src="/images/hero.jpg" alt="Handmade products at a neighbourhood market" />
              <div className="landing-photo-shade" />
              <span className="landing-photo-label">
                <span className="landing-live-dot" /> LOCAL GOOD, ALL AROUND YOU
              </span>
              <div className="landing-photo-title">
                Good things happen
                <br />
                close to home<span>.</span>
              </div>
            </div>
            <div className="landing-floating-card landing-float-top">
              <span className="landing-float-icon">
                <MapPin size={19} />
              </span>
              <div>
                <strong>Right around the corner</strong>
                <small>Discover what’s in your area</small>
              </div>
              <Navigation2 size={18} className="text-[#4d72dc]" />
            </div>
            <div className="landing-floating-card landing-float-bottom">
              <span className="landing-float-icon warm">
                <PackageCheck size={20} />
              </span>
              <div>
                <strong>From local shelf to you</strong>
                <small>Shop · prepare · deliver</small>
              </div>
              <span className="landing-float-check">
                <Check size={15} strokeWidth={3} />
              </span>
            </div>
            <div className="landing-art-dots" aria-hidden="true" />
          </div>
        </section>

        <div className="landing-feature-strip">
          <div className="landing-wrap landing-feature-inner">
            <div>
              <span className="landing-feature-icon">
                <Search size={18} />
              </span>
              <span>Discover what’s nearby</span>
            </div>
            <span className="landing-feature-divider" />
            <div>
              <span className="landing-feature-icon">
                <Store size={18} />
              </span>
              <span>Support local stores</span>
            </div>
            <span className="landing-feature-divider" />
            <div>
              <span className="landing-feature-icon">
                <Truck size={18} />
              </span>
              <span>Get it your way</span>
            </div>
          </div>
        </div>

        <section id="portals" className="landing-portals landing-wrap" aria-labelledby="portals-title">
          <div className="landing-section-heading">
            <div>
              <p className="landing-section-kicker">ONE PLACE. YOUR OWN SPACE.</p>
              <h2 id="portals-title">How do you NearBuy?</h2>
              <p>Choose your path. We’ll take you exactly where you belong.</p>
            </div>
            <span className="landing-heading-aside">BUILT FOR EVERY SIDE OF LOCAL.</span>
          </div>
          <div className="landing-portal-grid">
            {portals.map(
              ({ id, number, icon: Icon, kicker, title, description, action, tint, image, imageAlt }) => (
                <article className={`landing-portal-card portal-${tint}`} key={id}>
                  <div className="landing-portal-image">
                    <img src={image} alt={imageAlt} loading="lazy" />
                    <span className="landing-card-number">{number} / 03</span>
                  </div>
                  <div className="landing-portal-body">
                    <div className="landing-portal-overline">
                      <span className="landing-portal-icon">
                        <Icon size={20} />
                      </span>
                      {kicker}
                    </div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                    <div className="landing-portal-links">
                      <Link className="landing-portal-primary" to={`/login/${id}`}>
                        {action} <ArrowUpRight size={18} />
                      </Link>
                      <Link className="landing-portal-secondary" to={`/join/${id}`}>
                        New here? Join us
                      </Link>
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
          <p className="landing-portals-note">
            <span>
              <Check size={13} strokeWidth={3} />
            </span>{' '}
            Each account has its own private workspace. You’ll only see the tools made for your role.
          </p>
        </section>

        <section id="how-it-works" className="landing-how">
          <div className="landing-wrap landing-how-inner">
            <div className="landing-how-copy">
              <p className="landing-section-kicker">A LITTLE CLOSER. A LOT BETTER.</p>
              <h2>
                Local works better
                <br />
                when we work <em>together.</em>
              </h2>
              <p>
                NearBuy connects the people who make a neighbourhood feel like one. Each person has a
                different part to play, with the right tools for their day.
              </p>
              <Link to="/login/customer" className="landing-button landing-button-light">
                Explore the marketplace <ArrowRight size={18} />
              </Link>
            </div>
            <div className="landing-how-steps">
              <div>
                <span>01</span>
                <div>
                  <h3>Find the good stuff</h3>
                  <p>Customers discover real products at real shops close to home.</p>
                </div>
              </div>
              <div>
                <span>02</span>
                <div>
                  <h3>Help local shops thrive</h3>
                  <p>Sellers get a simple place to manage their store and serve more neighbours.</p>
                </div>
              </div>
              <div>
                <span>03</span>
                <div>
                  <h3>Make the last mile feel easy</h3>
                  <p>Riders get clear jobs, smoother handoffs and earnings they can follow.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="our-promise" className="landing-last landing-wrap">
          <span className="landing-last-badge">
            <MapPin size={18} /> MADE FOR YOUR NEIGHBOURHOOD
          </span>
          <h2>
            The future of local is <span>right here.</span>
          </h2>
          <p>Three different journeys. One more connected community.</p>
          <a className="landing-button landing-button-primary" href="#portals">
            Find your place <ArrowRight size={19} />
          </a>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="landing-wrap">
          <div className="landing-footer-top">
            <div>
              <Brand light />
              <p>
                A little closer, a lot more connected.
                <br />
                What you need, already nearby.
              </p>
            </div>
            <nav aria-label="Portal links">
              <div>
                <strong>Explore</strong>
                <Link to="/login/customer">Marketplace</Link>
                <Link to="/login/seller">Seller Hub</Link>
                <Link to="/login/rider">Rider Hub</Link>
              </div>
              <div>
                <strong>Get started</strong>
                <Link to="/join/customer">Join as a customer</Link>
                <Link to="/join/seller">List your store</Link>
                <Link to="/join/rider">Ride with us</Link>
              </div>
            </nav>
          </div>
          <div className="landing-footer-bottom">
            <span>© 2026 NearBuy. Made for the neighbourhood.</span>
            <span>Find nearby · Shop local · Move together</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
