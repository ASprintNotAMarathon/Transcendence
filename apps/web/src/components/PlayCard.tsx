import { Link } from 'react-router'
import Card from './Card'
import ErrorText from './ErrorText'

type Props = {
  searching: boolean
  error: string | null
  disabled: boolean
  resumeMatchId: string | null
  onFind: () => void
  onCancel: () => void
}

const mainButtonClass = 'btn btn-primary w-full tracking-wide border-2 border-(--color-primary)'

function PlayCard({ searching, error, disabled, resumeMatchId, onFind, onCancel }: Props) {
  return (
    <section aria-labelledby="play-heading" className="flex flex-col gap-3">
      <h2 id="play-heading" className="text-xs font-semibold uppercase tracking-widest text-muted">
        Play
      </h2>
      <Card className="flex flex-col gap-3">
        {resumeMatchId !== null ? (
          <>
            <p role="status" className="text-muted">
              Your match is ready.
            </p>
            <Link to={`/match/${resumeMatchId}`} className={mainButtonClass}>
              Resume your match
            </Link>
          </>
        ) : searching ? (
          <>
            <p role="status" className="text-muted">
              Looking for an opponent…
            </p>
            <button type="button" onClick={onCancel} className="btn btn-sm tracking-wide border-2 btn-outline-accent self-start">
              Cancel
            </button>
          </>
        ) : (
          <button type="button" onClick={onFind} disabled={disabled} className={mainButtonClass}>
            Find a match
          </button>
        )}
        {error !== null && (
          <ErrorText live>{error}</ErrorText>
        )}
      </Card>
    </section>
  )
}

export default PlayCard