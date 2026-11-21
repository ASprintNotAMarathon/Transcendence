import PrimaryLink from '../components/PrimaryLink'
import Icon from '../components/Icon'

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-barrio text-5xl text-(--color-primary-content) sm:text-7xl">404</h1>
      <p className="text-muted">Oops! This page doesn't exist.</p>
      <PrimaryLink to="/">
        <Icon name="back" />
        Back to start
      </PrimaryLink>
    </div>
  )
}

export default NotFoundPage
