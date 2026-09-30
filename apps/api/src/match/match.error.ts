import type { MatchErrorCode } from '@transcendence/shared';

export class MatchError extends Error {
	constructor(
		readonly code: MatchErrorCode,
		message?: string,
	) {
		super(message ?? code);
		this.name = 'MatchError';
	}
}
