import { useAuth } from '../auth/AuthContext'
import Avatar from '../components/Avatar'
import LoadingState from '../components/states/LoadingState'

/*
  ProfilePage. Your own profile (later also the profile of other players).

  Profile                                   <- title
  ┌────────────────────────────────────┐
  │ ( A )  Alice                       │
  │        Member since October 2026   │
  │        alice@example.com           │
  │                                    │
  │ [ Change avatar ] [ Edit name ]    │
  └────────────────────────────────────┘
*/

function ProfilePage() {
  const { user } = useAuth()

  // ProtectedRoute makes sure you are logged in, but TypeScript does not know that.
  if (!user) return <LoadingState />

  const memberSince = new Date(user.createdAt).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div>
      <h1 className="font-barrio text-3xl text-(--color-base-content)">Profile</h1>

      <div className="mt-4 max-w-xl rounded-2xl border-2 border-(--color-primary) bg-(--color-base-100) p-6">
        <div className="flex items-center gap-5">
          <Avatar displayName={user.displayName} size="lg" />
          <div>
            <p className="text-2xl font-semibold">{user.displayName}</p>
            <p className="text-muted">Member since {memberSince}</p>
            <p className="text-muted">{user.email} (only you can see this)</p>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <button type="button" className="btn btn-sm tracking-wide border-2 btn-outline-accent">
            Change avatar
          </button>
          <button type="button" className="btn btn-sm tracking-wide border-2 btn-outline-accent">
            Edit name
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage