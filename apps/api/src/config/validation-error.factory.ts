import { BadRequestException, HttpStatus } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * Reshapes what class-validator produces into the one error format the whole
 * API uses.
 *
 * By default a failed body arrives as an array of English sentences, which
 * leaves a form no way to attach an error to an input except by matching on
 * prose — and that breaks the day somebody rewords a message. Keyed by field
 * name, the client reads which field failed and never reads the sentence.
 *
 * The rule this completes, for every response in the API: if the body carries
 * `errors`, it is per-field and the form marks those inputs. If it carries only
 * `message`, it is form-level. A failed login is deliberately the second kind.
 */
export function validationErrorFactory(
	errors: ValidationError[],
): BadRequestException {
	return new BadRequestException({
		statusCode: HttpStatus.BAD_REQUEST,
		error: 'Bad Request',
		errors: byField(errors),
	});
}

/**
 * Nested objects are flattened to a dotted path, so a future DTO holding
 * another DTO still produces one flat map the form can index into.
 */
function byField(
	errors: ValidationError[],
	prefix = '',
): Record<string, string> {
	const result: Record<string, string> = {};

	for (const error of errors) {
		const path = prefix ? `${prefix}.${error.property}` : error.property;

		// One message per field: a form shows a single line under an input.
		// A field can break several rules at once, and which one surfaces is
		// whichever class-validator reports first.
		const [first] = Object.values(error.constraints ?? {});
		if (first) {
			result[path] = first;
		}

		if (error.children && error.children.length > 0) {
			Object.assign(result, byField(error.children, path));
		}
	}

	return result;
}
