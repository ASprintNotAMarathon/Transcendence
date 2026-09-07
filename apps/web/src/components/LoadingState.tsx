type LoadingStateProps = {
  message?: string
}

function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex items-center gap-1.5" role="status" aria-label={message}>
        {Array.from({ length: 5 }, (_, i) => (
          <span
            key={i}
            className="stone-loading-dot inline-block h-2.5 w-2.5 rounded-full bg-(--color-primary)"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-muted">{message}</p>
    </div>
  )
}

export default LoadingState
