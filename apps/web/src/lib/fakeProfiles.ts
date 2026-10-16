import { ApiError, type AuthUser } from './api'

/*
  TEMP: fake profiles, until the api from Kimia is ready.
  When it is: I (Noor :) delete this file and make loadProfile call
  GET /api/users/:id instead (same shape, see the proposal in the issue).
*/

export type Profile = {
    id: string
    displayName: string
    avatarUrl: string | null
    createdAt: string
  }
  
  const FAKE_PROFILES: Profile[] = [
    { id: 'bob', displayName: 'Bob', avatarUrl: null, createdAt: '2026-10-02T10:00:00Z' },
    { id: 'carla', displayName: 'Carla', avatarUrl: null, createdAt: '2026-09-21T10:00:00Z' },
  ]
  
  // Returns the profile, or null when there is nobody with that id.
  export async function loadProfile(id: string): Promise<Profile | null> {
    await new Promise((resolve) => setTimeout(resolve, 400)) // pretend it takes time
    if (id === 'broken') throw new Error('fake failure') // to try the error state
    return FAKE_PROFILES.find((profile) => profile.id === id) ?? null
  }

  // TEMP: pretends to save. Names that are in FAKE_PROFILES count as taken (409).
export async function saveDisplayName(user: AuthUser, displayName: string): Promise<AuthUser> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  const taken = FAKE_PROFILES.some(
    (profile) => profile.displayName.toLowerCase() === displayName.toLowerCase(),
  )
  if (taken) {
    throw new ApiError(409, 'Display name taken', { displayName: 'This name is already taken.' })
  }
  return { ...user, displayName }
}

export async function saveAvatar(user: AuthUser, file: File): Promise<AuthUser> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  return { ...user, avatarUrl: URL.createObjectURL(file) }
}