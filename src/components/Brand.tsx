import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'

export function Brand({
  to = '/',
  light = false,
  compact = false,
}: {
  to?: string
  light?: boolean
  compact?: boolean
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2.5 group shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500 rounded-md"
      aria-label="NearBuy home"
    >
      <span className="relative grid place-items-center w-10 h-10 rounded-[13px] bg-[#275ce7] text-white shadow-[0_5px_14px_rgba(39,92,231,.20)] group-hover:rotate-[-5deg] transition-transform">
        <MapPin size={22} strokeWidth={2.7} />
        <span className="absolute top-[10px] left-[18px] w-[5px] h-[5px] rounded-full bg-[#ffda83]" />
      </span>
      {!compact && (
        <span
          className={`font-extrabold text-[22px] leading-none tracking-[-1.1px] ${light ? 'text-white' : 'text-[#132440]'}`}
        >
          near<span className={light ? 'text-[#a8c7ff]' : 'text-[#275ce7]'}>buy</span>
          <span className="text-[#ff9c59]">.</span>
        </span>
      )}
    </Link>
  )
}
