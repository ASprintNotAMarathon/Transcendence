import Card from './Card'

type Props = {
  searching: boolean
  onFind: () => void
  onCancel: () => void
}

function PlayCard({ searching, onFind, onCancel }: Props) {
  return (
    <section aria-labelledby="play-heading" className="flex flex-col gap-3">
      <h2 id="play-heading" className="text-xs font-semibold uppercase tracking-widest text-muted">
        Play
      </h2>
      <Card className="flex flex-col gap-3">
        {searching ? (
          <>
            <p role="status" className="text-muted">
              Looking for an opponent…
            </p>
            <button type="button" onClick={onCancel} className="btn btn-sm tracking-wide border-2 btn-outline-accent">
              Cancel
            </button>
          </>
        ) : (
            <button type="button" onClick={onFind} className="btn btn-primary w-full tracking-wide border-2 border-(--color-primary)">
            Find a match
          </button>
        )}
      </Card>
    </section>
  )
}

export default PlayCard