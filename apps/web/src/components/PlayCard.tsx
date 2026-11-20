import Card from './Card'
import ErrorText from './ErrorText'
import SectionHeading from './SectionHeading'
import PrimaryButton from './PrimaryButton'
import PrimaryLink from './PrimaryLink'

type Props = {
  searching: boolean
  error: string | null
  disabled: boolean
  resumeMatchId: string | null
  onFind: () => void
  onCancel: () => void
}

function PlayCard({ searching, error, disabled, resumeMatchId, onFind, onCancel }: Props) {
  return (
    <section aria-labelledby="play-heading" className="flex flex-col gap-3">
      <SectionHeading id="play-heading">Play</SectionHeading>
      <Card className="flex flex-col gap-3">
        {resumeMatchId !== null ? (
          <>
            <p role="status" className="text-muted">
              Your match is ready.
            </p>
            <PrimaryLink variant="solid" block to={`/match/${resumeMatchId}`}>
              Resume your match
            </PrimaryLink>
          </>
        ) : searching ? (
          <>
            <p role="status" className="text-muted">
              Looking for an opponent…
            </p>
            <PrimaryButton size="sm" className="self-start" onClick={onCancel}>
              Cancel
            </PrimaryButton>
          </>
        ) : (
          <PrimaryButton variant="solid" block onClick={onFind} disabled={disabled}>
            Find a match
          </PrimaryButton>
        )}
        {error !== null && (
          <ErrorText live>{error}</ErrorText>
        )}
      </Card>
    </section>
  )
}

export default PlayCard