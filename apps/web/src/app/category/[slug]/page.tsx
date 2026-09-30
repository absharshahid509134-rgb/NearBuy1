import { SearchView } from '@/app/search/search-view'
import { s } from '@nearbuy/ui'

export const dynamic = 'force-dynamic'

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const title = params.slug.replaceAll('-', ' ')
  return (
    <div className="nb-container py-6">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight capitalize">{title}</h1>
      <p className="mb-4 text-sm text-ink-muted">{s('search.categoryHint', 'Live nearby availability for this category.')}</p>
      <SearchView initialQuery={title} initialSort="recommended" />
    </div>
  )
}
