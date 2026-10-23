import type { ChatErrorCode } from '@transcendence/shared';

// Custom error class for chat-related errors.
// extends inherits from JavaScript's built-in Error class.
export class ChatError extends Error {
	constructor(
		readonly code: ChatErrorCode,
		message?: string,
	) {
		// Use the custom message if provided; otherwise, use the error code.
		// super calls the parent constructor which sets up the error object
		super(message ?? code);
		// Give this error a distinct name so it can be identified when caught.
		this.name = 'ChatError';
	}
}
