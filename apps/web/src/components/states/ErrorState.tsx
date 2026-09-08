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
      <p className="text-(--color-primary)">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-sm tracking-wide border-2 btn-outline-accent"
        >
          Try again
        </button>
      )}
    </div>
  )
}

export default ErrorState
