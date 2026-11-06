/*
  TEMPORARY fake friends data, so the frontend can be built before Kimia's
  endpoints exist. Delete this file when USE_MOCK_FRIENDS is switched off.
  The state lives in memory, so a page reload resets it.
*/
import type { Friend, FriendRequests, FriendsApiBase, Friendship, Person } from './friends'

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`

const PEOPLE: Person[] = ['alice', 'bob', 'charlie', 'dana'].map((displayName, index) => ({
  id: id(index + 1),
  displayName,
  avatarUrl: null,
}))

function person(userId: string): Person {
  return PEOPLE.find((item) => item.id === userId) ?? { id: userId, displayName: 'player', avatarUrl: null }
}

type Entry = { status: Friendship; requestId?: string }

// alice: I sent a request. bob: nothing. charlie: friends. dana: she sent me one.
const state = new Map<string, Entry>([
  [id(1), { status: 'requested', requestId: 'request-alice' }],
  [id(3), { status: 'friends' }],
  [id(4), { status: 'incoming', requestId: 'request-dana' }],
])
const online = new Set([id(3)])

const wait = () => new Promise<void>((resolve) => setTimeout(resolve, 300))

export const mockFriendsApi: FriendsApiBase = {
  async list() {
    await wait()
    const friends: Friend[] = []
    for (const [userId, entry] of state) {
      if (entry.status === 'friends') friends.push({ ...person(userId), online: online.has(userId) })
    }
    return friends
  },

  async requests() {
    await wait()
    const result: FriendRequests = { incoming: [], outgoing: [] }
    for (const [userId, entry] of state) {
      if (!entry.requestId) continue
      const item = { id: entry.requestId, user: person(userId), createdAt: new Date().toISOString() }
      if (entry.status === 'incoming') result.incoming.push(item)
      if (entry.status === 'requested') result.outgoing.push(item)
    }
    return result
  },

  async send(userId) {
    await wait()
    // Like the real server: if they already asked me, we become friends.
    if (state.get(userId)?.status === 'incoming') {
      state.set(userId, { status: 'friends' })
      return
    }
    state.set(userId, { status: 'requested', requestId: `request-${userId}` })
  },

  async accept(requestId) {
    await wait()
    for (const [userId, entry] of state) {
      if (entry.requestId === requestId) state.set(userId, { status: 'friends' })
    }
  },

  async decline(requestId) {
    await wait()
    for (const [userId, entry] of state) {
      if (entry.requestId === requestId) state.delete(userId)
    }
  },

  async remove(userId) {
    await wait()
    state.delete(userId)
  },

  async statusWith(userId) {
    await wait()
    return state.get(userId)?.status ?? 'none'
  },
}