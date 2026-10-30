import type { ReactNode } from 'react'
import Avatar from './Avatar'

/*
  ProfileCard. The card on the profile page: avatar, name, member since.
  Only your own profile passes `email` and buttons (children).
*/

type ProfileCardProps = {
  displayName: string
  avatarUrl?: string | null
  createdAt: string
  email?: string
  children?: ReactNode
}

function ProfileCard({ displayName, avatarUrl, createdAt, email, children }: ProfileCardProps) {
  const memberSince = new Date(createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mt-4 max-w-xl rounded-2xl border-2 border-(--color-primary) bg-(--color-base-100) p-6">
      <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
        <Avatar displayName={displayName} avatarUrl={avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="text-2xl font-semibold break-words">{displayName}</p>
          <p className="text-muted">Member since {memberSince}</p>
          {email && <p className="text-muted break-all">{email} (only you can see this)</p>}
        </div>
      </div>

      {children && <div className="mt-5 flex gap-3">{children}</div>}
    </div>
  )
}

export default ProfileCard