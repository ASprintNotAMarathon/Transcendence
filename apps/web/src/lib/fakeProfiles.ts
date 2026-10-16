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