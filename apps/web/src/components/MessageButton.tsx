import { useState } from 'react'
import { chatClient } from '../chat/chat'
import { openChatWith } from '../chat/openChat'

/*
 * Message button on someone else's profile: starts (or reopens) the
 * conversation with them, then opens the chat popup on it.
 */

const buttonClass = 'btn btn-sm tracking-wide border-2 btn-outline-accent'

function MessageButton({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    setBusy(true)
    try {
      const conversationId = await chatClient.startConversation(userId)
      openChatWith(conversationId)
    } catch {
      // Refused or timed out - nothing to open. The server only refuses
      // ghosts and yourself, and this button exists on neither.
    } finally {
      setBusy(false)
    }
  }

  return (
    <button type="button" className={buttonClass} disabled={busy} onClick={() => void handleClick()}>
      {busy ? 'Opening…' : 'Message'}
    </button>
  )
}

export default MessageButton