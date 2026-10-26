import { ConflictException, HttpStatus } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

/**
 * The unique index a write collided with, or undefined when the error is not
 * a unique violation at all. Callers map the indexes they know to a 409 and
 * rethrow everything else.
 *
 * Prisma 7 moved the constraint name out of meta.target, as CONTRIBUTING.md
 * records. This is the only place that knows where it went.
 */
export function uniqueViolationIndex(error: unknown): string | undefined {
	if (
		!(error instanceof Prisma.PrismaClientKnownRequestError) ||
		error.code !== 'P2002'
	) {
		return undefined;
	}
	const meta = error.meta as
		| {
				driverAdapterError?: {
					cause?: { constraint?: { index?: string } };
				};
		  }
		| undefined;
	return meta?.driverAdapterError?.cause?.constraint?.index;
}

/**
 * Same envelope the global validation pipe produces, so every per-field error
 * in the API has one shape: a status, a label, and `errors` keyed by the field
 * that failed.
 */
export function duplicateOf(field: string, message: string): ConflictException {
	return new ConflictException({
		statusCode: HttpStatus.CONFLICT,
		error: 'Conflict',
		errors: { [field]: message },
	});
}
