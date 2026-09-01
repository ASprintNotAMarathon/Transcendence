type ErrorStateProps = {
    message?: string
    onRetry?: () => void
  }
  
  function ErrorState({ message = 'Something went wrong.', onRetry }: ErrorStateProps) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-[#B23A2E]">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer rounded-full border-2 border-[#B23A2E] bg-transparent px-4 py-1.5 text-sm font-medium tracking-wide text-[#ECE7DE] transition-colors duration-300 hover:bg-[#B23A2E]"
          >
            Try again
          </button>
        )}
      </div>
    )
  }
  
  export default ErrorState