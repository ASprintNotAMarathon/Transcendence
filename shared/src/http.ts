/**
 * What the API sends, with status 200, when a request fails in a way that is
 * part of normal use: a wrong password, a taken name. A real 4xx would be
 * logged by the browser as a console error even though the app handles it,
 * so these travel as 200 and carry the real status inside.
 */
export type ExpectedError = {
	ok: false;
	status: number;
	message?: string;
	errors?: Record<string, string>;
};

export function isExpectedError(body: unknown): body is ExpectedError {
	return (
		typeof body === "object" &&
		body !== null &&
		(body as { ok?: unknown }).ok === false
	);
}
