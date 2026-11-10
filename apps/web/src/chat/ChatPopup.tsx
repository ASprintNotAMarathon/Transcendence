import { useEffect, useState } from 'react'
import { CURRENT_USER_ID, chatClient } from './chat'
import ChatPage from '../pages/ChatPage'

function ChatPopup() {
  // Create a state variable called 'open', initially false (the popup is closed).
  // setOpen is the function used to change the value of 'open'.
  const [open, setOpen] = useState(false)

  // Messages from other people that arrived while the popup was closed.
	const [unread, setUnread] = useState(0)

	// Count incoming messages only while closed. The cleanup unsubscribes
	// when 'open' flips, so the counter never runs while you are looking.
	useEffect(() => {
	if (open) {
		return
}
	return chatClient.subscribe((event) => {
	if (event.type === 'chat.message' &&
		event.payload.senderId !== CURRENT_USER_ID) 
	{
		setUnread((current) => current + 1)
	}
	})
	}, [open])

	// Esc closes the popup, like any overlay. Listener exists only while open.
	useEffect(() => {
	if (!open) {
	return
}
	function onKeyDown(event: KeyboardEvent) {
	if (event.key === 'Escape') {
		setOpen(false)
	}
	}
	window.addEventListener('keydown', onKeyDown)
	return () => window.removeEventListener('keydown', onKeyDown)
	}, [open])

  return (
    // Keep the popup fixed to the bottom-right corner of the browser window by fixed right-4 bottom-4.
    // z-20 places it above lobbypage/homepage, 20 layers above the base layer (z-0).
	// flex makes the children (the chat window and the button) flexible boxes.
    // flex-col stacks the popup and button vertically.
    // items-end aligns them to the right.
    // gap-2 adds space between them.
    <div className="fixed right-4 bottom-4 z-20 flex flex-col items-end gap-2">

	  {/* The chat window itself. */}
      <div
        // These classes style the chat window:
        // w-[min(42rem,calc(100vw-2rem))] limits its width to the smaller of
        // 42rem or the viewport width minus 2rem.
        // rounded-2xl rounds the corners.
        // border-2 adds a 2px border.
        // border-(--color-primary) uses the primary theme color for the border.
        // bg-(--color-base-100) sets the background color.
        // p-3 adds padding inside the container.
        //
        // The template literal lets us combine fixed classes with a condition:
        // if open is true, add no extra class and show the popup.
        // if open is false, add 'hidden' and hide the popup.
        className={`w-[min(42rem,calc(100vw-2rem))] rounded-2xl border-2 border-(--color-primary) bg-(--color-base-100) p-3 max-sm:fixed max-sm:inset-0 max-sm:w-auto max-sm:rounded-none max-sm:border-0 ${open ? '' : 'hidden'}`}
      >
        {/* Render the chat interface inside the popup.
            className="h-96" keeps it at 24 rem inside desktop view 
			on phones, it takes the full viewport height minus 5rem */}
        <ChatPage className="h-96 max-sm:h-[calc(100dvh-5rem)]" />
      </div>

      {/* Button used to open and close the popup. */}
      <button
        // Prevent this button from submitting a form if placed inside one.
        type="button"

        // When clicked, change open to its opposite value:
        // false becomes true (open the chat).
        // true becomes false (close the chat).
        onClick={() => {
			if (!open) {
				setUnread(0) // Reset unread count when opening the chat.
			}
			setOpen(!open)
		}}

        // Style the button using the project's button classes.
        // btn and btn-sm define its button appearance and size.
        // tracking-wide adds letter spacing.
        // btn-outline-accent gives it an outlined accent style.
        className="btn btn-sm tracking-wide border-2 btn-outline-accent relative"
      >
        {/* Display different button text depending on the state.
            When open is true, show 'Close chat'.
            When open is false, show 'Chat'. */}
            {open ? 'Close chat' : unread > 0 ? `Chat (${unread})` : 'Chat'}
      </button>
    </div>
  )
}

// Export the component so other files can import and render it.
export default ChatPopup