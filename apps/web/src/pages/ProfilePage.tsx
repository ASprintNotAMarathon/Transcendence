import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { ApiError, usersApi, type AuthUser, type Profile } from '../lib/api'
import ProfileCard from '../components/ProfileCard'
import EditNameForm from '../components/EditNameForm'
import ChangeAvatarForm from '../components/ChangeAvatarForm'
import ErrorState from '../components/states/ErrorState'
import LoadingState from '../components/states/LoadingState'

/*
  ProfilePage. /profile is your own profile, /profile/:id is someone else's.

  Your own:   avatar, name, member since, email, [ Change avatar ] [ Edit name ]
  Someone else: avatar, name, member since (no email, no buttons)
*/

const buttonClass = 'btn btn-sm tracking-wide border-2 btn-outline-accent'

type OpenForm = 'none' | 'name' | 'avatar'

function OwnProfile({ user }: { user: AuthUser }) {
  const [openForm, setOpenForm] = useState<OpenForm>('none')

  return (
    <ProfileCard
      displayName={user.displayName}
      avatarUrl={user.avatarUrl ?? undefined}
      createdAt={user.createdAt}
      email={user.email}
    >
      {openForm === 'name' && <EditNameForm user={user} onDone={() => setOpenForm('none')} />}
      {openForm === 'avatar' && <ChangeAvatarForm user={user} onDone={() => setOpenForm('none')} />}
      {openForm === 'none' && (
        <>
          <button type="button" className={buttonClass} onClick={() => setOpenForm('avatar')}>
            Change avatar
          </button>
          <button type="button" className={buttonClass} onClick={() => setOpenForm('name')}>
            Edit name
          </button>
        </>
      )}
    </ProfileCard>
  )
}

// The four things that can happen while we load someone else's profile.
type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; profile: Profile }
  | { status: 'notFound' }
  | { status: 'error' }

function OtherProfile({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0) // goes up by one on "Try again"

  useEffect(() => {
    // If you leave the page before the answer arrives, ignore the answer.
    let ignore = false
    usersApi
      .get(id)
      .then((profile) => {
        if (!ignore) setState({ status: 'ready', profile })
      })
      .catch((caught) => {
        if (ignore) return
        const missing =
          caught instanceof ApiError && (caught.status === 404 || caught.status === 400)
        setState(missing ? { status: 'notFound' } : { status: 'error' })
      })
    return () => {
      ignore = true
    }
  }, [id, attempt])

  function handleRetry() {
    setState({ status: 'loading' })
    setAttempt((current) => current + 1)
  }

  if (state.status === 'loading') return <LoadingState />
  if (state.status === 'notFound') return <ErrorState message="We could not find this player." />
  if (state.status === 'error') return <ErrorState onRetry={handleRetry} />

  const { profile } = state
  return (
    <ProfileCard
      displayName={profile.displayName}
      avatarUrl={profile.avatarUrl}
      createdAt={profile.createdAt}
    />
  )
}

function ProfilePage() {
  const { id } = useParams()
  const { user } = useAuth()

  // ProtectedRoute makes sure you are logged in, but TypeScript does not know that.
  if (!user) return <LoadingState />

  const viewingSomeoneElse = id !== undefined && id !== user.id

  return (
    <div>
      <h1 className="font-barrio text-3xl text-(--color-base-content)">Profile</h1>
      {viewingSomeoneElse ? <OtherProfile key={id} id={id} /> : <OwnProfile user={user} />}
    </div>
  )
}

export default ProfilePage