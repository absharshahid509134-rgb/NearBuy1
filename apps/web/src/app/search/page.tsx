import { SearchView } from './search-view'
import { s } from '@nearbuy/ui'

export const metadata = { title: 'Search' }
export const dynamic = 'force-dynamic'

export default function SearchPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  return (
    <div className="nb-container py-6">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">
        {searchParams.q ? s('search.resultsFor', 'Results for') + ` “${searchParams.q}”` : s('search.browse', 'Browse nearby')}
      </h1>
      <SearchView initialQuery={searchParams.q ?? ''} initialSort={searchParams.sort ?? 'recommended'} />
    </div>
  )
}
