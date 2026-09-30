'use client'
export function PrintButton({ label }: { label: string }) {
  return (
    <button onClick={() => window.print()} className="mt-4 rounded-card bg-primary-600 px-4 py-2 text-sm font-bold text-white print:hidden">
      {label}
    </button>
  )
}
