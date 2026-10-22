import type { ReactNode } from 'react'
import { Link } from 'react-router'

type LegalPageProps = {
  title: string
  updated: string
  children: ReactNode
}

// Shared frame for the privacy policy and the terms.
function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link to="/" className="link text-sm">
        Back to start
      </Link>
      <h1 className="mt-4 font-barrio text-4xl text-(--color-primary-content)">{title}</h1>
      <p className="mt-1 text-sm text-(--color-base-content)/70">Last updated: {updated}</p>
      <div className="mt-8 flex flex-col gap-8">{children}</div>
    </main>
  )
}

type LegalSectionProps = {
  title: string
  children: ReactNode
}

// One titled block of text inside a legal page.
export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold text-(--color-primary-content)">{title}</h2>
      {children}
    </section>
  )
}

export default LegalPage