import { ApiError, request, usersApi } from './api'
import { mockFriendsApi } from './mockFriends'

/*
  Friends (issue #59). The shapes follow the agreement with Kimia:
    GET    /friends                      my friends (with online)
    GET    /friends/requests             { incoming, outgoing }
    POST   /friends/requests             { userId }  send a request
    POST   /friends/requests/:id/accept  and /decline  (:id is the request id)
    DELETE /friends/:userId              remove a friend or cancel my own request
    GET    /users/:id                    also returns `friendship`
  If the other player already sent me a request, sending one back makes us friends.
*/
export type Friendship = 'none' | 'requested' | 'incoming' | 'friends' | 'self'

export type Person = {
  id: string
  displayName: string
  avatarUrl: string | null
}

export type Friend = Person & { online: boolean }
export type FriendRequest = { id: string; user: Person; createdAt: string }
export type FriendRequests = { incoming: FriendRequest[]; outgoing: FriendRequest[] }

export type FriendsApiBase = {
  list(): Promise<Friend[]>
  requests(): Promise<FriendRequests>
  send(userId: string): Promise<void>
  accept(requestId: string): Promise<void>
  decline(requestId: string): Promise<void>
  remove(userId: string): Promise<void>
  statusWith(userId: string): Promise<Friendship>
}

const realFriendsApi: FriendsApiBase = {
  list() {
    return request<Friend[]>('/friends')
  },
  requests() {
    return request<FriendRequests>('/friends/requests')
  },
  send(userId) {
    return request<void>('/friends/requests', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  },
  accept(requestId) {
    return request<void>(`/friends/requests/${encodeURIComponent(requestId)}/accept`, {
      method: 'POST',
    })
  },
  decline(requestId) {
    return request<void>(`/friends/requests/${encodeURIComponent(requestId)}/decline`, {
      method: 'POST',
    })
  },
  remove(userId) {
    return request<void>(`/friends/${encodeURIComponent(userId)}`, { method: 'DELETE' })
  },
  async statusWith(userId) {
    const profile = await usersApi.get(userId)
    return profile.friendship ?? 'none'
  },
}

// TEMPORARY: true uses the fake data in mockFriends.ts.
// Set to false when Kimia's endpoints are ready, then delete mockFriends.ts.
const USE_MOCK_FRIENDS = true

const baseFriendsApi: FriendsApiBase = USE_MOCK_FRIENDS ? mockFriendsApi : realFriendsApi

// Accepting needs the request id, and a profile only tells us "incoming".
// So we look the id up in the list of requests first.
async function incomingRequestId(userId: string) {
  const { incoming } = await baseFriendsApi.requests()
  const found = incoming.find((item) => item.user.id === userId)
  if (!found) throw new ApiError(404, 'There is no request from this player.')
  return found.id
}

export const friendsApi = {
  ...baseFriendsApi,
  async acceptFrom(userId: string) {
    return baseFriendsApi.accept(await incomingRequestId(userId))
  },
  async declineFrom(userId: string) {
    return baseFriendsApi.decline(await incomingRequestId(userId))
  },
}