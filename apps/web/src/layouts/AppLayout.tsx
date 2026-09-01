import { NavLink, Outlet } from 'react-router'

function AppLayout() {
  const navButtonClass =
    'cursor-pointer rounded-full border-2 border-[#B23A2E] bg-transparent px-4 py-1.5 text-sm font-medium tracking-wide text-[#ECE7DE] transition-colors duration-300 hover:bg-[#B23A2E]'
  function handleLogout() {
    console.log('logout clicked')
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <NavLink to="/home" className="font-barrio text-4xl text-[#ECE7DE]">
          <span className="glow-pulse text-[#B23A2E]">GO</span>MOKU FRIENDS
        </NavLink>

        <div className="flex items-center gap-3">
          <NavLink to="/profile" className={navButtonClass}>
            Profile
          </NavLink>
          <button type="button" onClick={handleLogout} className={navButtonClass}>
            Log out
          </button>
        </div>
      </header>

      <main className="px-6 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export default AppLayout