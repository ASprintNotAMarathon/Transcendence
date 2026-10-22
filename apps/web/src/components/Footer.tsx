import { Link } from 'react-router'

function Footer() {
  return (
    <footer className="px-6 py-4 text-sm text-(--color-base-content)/70">
      <nav className="flex gap-4" aria-label="Legal">
        <Link to="/privacy" className="link">
          Privacy Policy
        </Link>
        <Link to="/terms" className="link">
          Terms of Service
        </Link>
      </nav>
    </footer>
  )
}

export default Footer