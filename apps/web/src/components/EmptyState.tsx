type EmptyStateProps = {
    title: string
    message: string
  }
  
  function EmptyState({ title, message }: EmptyStateProps) {
    return (
      <div>
        <h1 className="font-barrio text-3xl text-(--color-base-content)">{title}</h1>
        <p className="mt-2 text-muted">{message}</p>
      </div>
    )
  }
  
  export default EmptyState
