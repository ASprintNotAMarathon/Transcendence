/*
 * MessageComposer is the text box at the bottom of the message pane.
 *
 * It owns two things: the text being typed and the status of the last send attempt (idle, sending, or failed)
 * Enter sends the message, Shift+Enter creates a new line
 * blank text is refused
 * It collects the user's text and passes it to `onSend`.
 * It does NOT add the message to the chat itself.
 *
 * Flow:
 * type message → press Enter/Send → onSend(text)
 *                         ↓wait for Promise
 *                  success → clear box
 *                  failure → keep text + show Retry
 */

import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

// Drafts keyed by conversation id. Lives outside the component so it
// survives when the composer unmounts (switching conversations).
const drafts = new Map<string, string>()

// Props that MessageComposer receives from its parent(MessagePane).
type MessageComposerProps = {
	// key for drafts map
	conversationId: string
	// onSend function receives the message text.
	// It returns a Promise: success = resolves(returns void, clear text), failure = rejects (keeps the text in the box).
	// Promise is a built-in type that represents an asynchronous operation that may complete in the future.
	onSend: (body: string) => Promise<void>
}

// The three possible states of the message composer.
/** idle = ready to type, sending = waiting for the client, failed = last send was refused */
type Status = 'idle' | 'sending' | 'failed'

/**
 * Input: onSend (MessageComposerProps) a function from MessagePane.
 * useState: text (what is typed), status (idle | sending | failed).
 * send(): trims text, refuses blank, calls onSend; ok → clear box, error → 'failed'.
 * handleKeyDown(): Enter → send(), Shift+Enter → newline.
 * Returns JSX: textarea + Send button, plus a Retry row when status is 'failed'.
 */
function MessageComposer({ conversationId, onSend }: MessageComposerProps) {
	// Start from the saved draft for this conversation, if there is one, if not, start with an empty string.
	const [text, setText] = useState(() => drafts.get(conversationId) ?? '')
	// Stores whether the message is ready, being sent, or failed.
	const [status, setStatus] = useState<Status>('idle')
	// Direct handle on the textarea element, so we can call .focus() on it
	const inputRef = useRef<HTMLTextAreaElement>(null)

	// Put the cursor in the box on mount, and again when a send finishes.
	// (While sending the box is disabled, and a disabled box drops focus.)
	useEffect(() => {
		if (status !== 'sending') {
			inputRef.current?.focus()
		}
	}, [status])

	//async function means that the function will return a Promise, and allows 
	//the use of await inside it to wait for asynchronous operations to complete.
	async function send() {
		// Refuse empty or whitespace-only text (spaces, tabs, blank lines)
		const body = text.trim()
		// Do nothing if the message is empty or a message is already being sent.
		if (body === '' || status === 'sending') return
		// Change the state so the UI knows the message is being sent.
		setStatus('sending')
		try {
			//Pass the message to the parent through the onSend callback.
			//await means that the function will pause here until the Promise returned by onSend resolves or rejects.
			await onSend(body)
			// Sending succeeded, so clear the text box.
			setText('')
			// Sent, so the draft is no longer needed
			drafts.delete(conversationId)
			// Return the composer to its normal state.
			setStatus('idle')
		} catch {
			// Failure: keep the text so the user can retry without retyping
			setStatus('failed')
		}
	}

	function handleChange(value: string) {
		setText(value)
		// Remember what's typed so it survives leaving this conversation
		drafts.set(conversationId, value)
	}

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		// Enter sends the message instead of creating a new line.
		// Shift+Enter is allowed to create a new line.
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault()
			void send()
		}
	}

	return (
		/* The outer div contains the message composer and any error messages. */
		// The flex-col class makes the children stack vertically, 
		// gap-2 adds space between them, border-t adds a top border, and pt-2 adds padding to the top.
		//color-(--color-base-100) is a CSS variable that defines the color of the border.
		<div className="flex flex-col gap-2 border-t border-(--color-base-100) pt-2">
			{status === 'failed' && (
				<div className="flex items-center justify-between gap-2 text-sm">
					<span className="text-(--color-primary)">
						Message not sent.
					</span>
					{/* Try sending the same message again. */}
					<button
						type="button"
						onClick={() => void send()}
						className="btn btn-xs tracking-wide border-2 btn-outline-accent"
					>
						Retry
					</button>
				</div>
			)}
			<div className="flex items-end gap-2">
				{/* Textarea allows Shift+Enter to create multiple lines. */}
				<textarea
					// ref gives a direct handle on the textarea element, so we can call .focus() on it
					ref={inputRef}
					// The displayed text always comes from the `text` state.
					value={text}

					// Update `text` whenever the user types.
					onChange={(event) => handleChange(event.target.value)}

					// Check for Enter/Shift+Enter whenever a key is pressed.
					onKeyDown={handleKeyDown}

					// Prevent typing while the message is being sent.
					disabled={status === 'sending'}

					rows={2}
					placeholder="Write a message — Enter to send, Shift+Enter for a new line"
					aria-label="Message"

					// extra lines scroll inside the box instead of growing it
					className="textarea rounded-md flex-1 resize-none overflow-y-auto"
				/>

				<button
					type="button"

					// Send the message when the button is clicked.
					onClick={() => void send()}

					// Disable the button while sending or when there is no text.
					disabled={
						status === 'sending' || text.trim() === ''
					}
					className="btn btn-sm tracking-wide border-2 btn-outline-accent"
				>
					{/* Show different text depending on the current status. */}
					{status === 'sending' ? 'Sending…' : 'Send'}
				</button>
			</div>
		</div>
	)
}

export default MessageComposer
