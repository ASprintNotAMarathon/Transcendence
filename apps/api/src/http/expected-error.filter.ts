import {
	Catch,
	HttpException,
	HttpStatus,
	type ArgumentsHost,
	type ExceptionFilter,
} from '@nestjs/common';
import type { ExpectedError } from '@transcendence/shared';
import type { Response } from 'express';

/**
 * Turns the statuses it is given into 200 + ExpectedError, for routes where
 * those failures are normal use. Any other status goes out unchanged, in
 * Nest's usual shape, so a missing session on a guarded route is still a
 * real 401.
 *
 * Used per route (@UseFilters), never globally: only the route knows which
 * of its failures are expected.
 */
@Catch(HttpException)
export class ExpectedErrorFilter implements ExceptionFilter {
	private readonly expected: ReadonlySet<number>;

	constructor(...statuses: HttpStatus[]) {
		this.expected = new Set(statuses);
	}

	catch(exception: HttpException, host: ArgumentsHost): void {
		const res = host.switchToHttp().getResponse<Response>();
		const status = exception.getStatus();
		const raw = exception.getResponse();
		const body =
			typeof raw === 'string'
				? { statusCode: status, message: raw }
				: raw;

		if (!this.expected.has(status)) {
			// Same shape Nest's own filter would send.
			res.status(status).json(body);
			return;
		}

		const { message, errors } = body as {
			message?: unknown;
			errors?: Record<string, string>;
		};
		const result: ExpectedError = {
			ok: false,
			status,
			...(typeof message === 'string' ? { message } : {}),
			...(errors ? { errors } : {}),
		};
		res.status(HttpStatus.OK).json(result);
	}
}
