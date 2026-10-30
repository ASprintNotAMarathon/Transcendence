
/**
 * Layout for the screens without the app header: landing, login, register
 * and the legal pages. Just a content area with the footer at the bottom.
 */
import { Outlet } from 'react-router'
import Footer from '../components/Footer'

function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 flex-col">
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}

export default PublicLayout
