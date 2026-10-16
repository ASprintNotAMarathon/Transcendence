import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import Avatar from './Avatar'

/*
  UserMenu. Your avatar in the header. Click it to open a small menu.

    ( N )            <- button, closed
    ( N )
    ┌──────────────┐
    │ NoorH        │ <-- profile name
    │ Profile      │ <- link to /profile
    │ Log out      │ <- calls onLogout
    └──────────────┘

  Closes with Escape, with a click outside it, or after choosing an item.
*/

type UserMenuProps = {
  onLogout: () => void
}

function UserMenu({ onLogout }: UserMenuProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  // Refs point to a real element, so we can ask "was the click inside it?"
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Only listen while the menu is open. The cleanup function removes the
  // listeners again when it closes (or when the component disappears).
  useEffect(() => {
    if (!open) return

    function handleMouseDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus() // give the focus back, for keyboard users
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!user) return null

  const itemClass =
    'block w-full rounded-xl px-3 py-2 text-left hover:bg-(--color-primary)/25 focus-visible:bg-(--color-primary)/25 focus-visible:outline-none'

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-primary-content)"
      >
        <Avatar displayName={user.displayName} size="md" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-2xl border-2 border-(--color-primary) bg-(--color-base-100) p-2">
          <p className="truncate px-3 pb-2 text-sm text-muted">{user.displayName}</p>
          <Link to="/profile" onClick={() => setOpen(false)} className={itemClass}>
            Profile
          </Link>
          <button type="button" onClick={onLogout} className={itemClass}>
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

export default UserMenu