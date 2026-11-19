/*
 * Hand-off between the profile's Message button and the chat popup.
 * Lives in its own file because ChatPopup.tsx may only export components
 * (hot-reload rule): the popup registers its opener here while mounted,
 * the button calls openChatWith(), the popup picks it up.
 */

let requestOpen: ((conversationId: string) => void) | null = null

/** ChatPopup registers its opener here while it is mounted. */
export function setOpenChatHandler(
	handler: ((conversationId: string) => void) | null,
): void {
	requestOpen = handler
}

/** For the Message button: open the chat popup on this conversation. */
export function openChatWith(conversationId: string): void {
	requestOpen?.(conversationId)
}