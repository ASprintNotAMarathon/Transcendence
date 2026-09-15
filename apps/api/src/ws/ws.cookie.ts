/** Reading a cookie off the Websocket handshake.*/

/** The value of one cookie from a raw Cookie header, or null if it's not there. */
export function readCookie(
	header: string | undefined,
	name: string,
): string | null {
	if (header === undefined) {
		return null;
	}

	for (const part of header.split(';')) {
		const separator = part.indexOf('=');
		if (separator === -1) {
			continue;
		}

		const key = part.slice(0, separator).trim();
		if (key !== name) {
			continue;
		}

		const value = part.slice(separator + 1).trim();
		return value.length > 0 ? value : null;
	}

	return null;
}
