import ErrorText from '../ErrorText'
import PrimaryButton from '../PrimaryButton'

/*
    ErrorState.
    Shown if something fails. Not used anywhere yet in this project.

    SOMETHING WENT WRONG   <- message, customizable
    [ Try again ]          <- button, only shown if onRetry is passed
*/

type ErrorStateProps = {
  message?: string
  onRetry?: () => void
}

function ErrorState({ message = 'Something went wrong.', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <ErrorText>{message}</ErrorText>
      {onRetry && (
        <PrimaryButton size="sm" onClick={onRetry}>
          Try again
        </PrimaryButton>
      )}
    </div>
  )
}

export default ErrorState