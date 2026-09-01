type LoadingStateProps = {
    message?: string
  }
  
  function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#B23A2E] border-t-transparent" />
        <p className="text-muted">{message}</p>
      </div>
    )
  }
  
  export default LoadingState