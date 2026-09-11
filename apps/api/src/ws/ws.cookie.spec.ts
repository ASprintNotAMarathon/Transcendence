// claude written test to test the cookie read
import { readCookie } from './ws.cookie';

describe('readCookie', () => {
	it('finds a cookie among others', () => {
		expect(
			readCookie('theme=dark; access_token=abc; lang=en', 'access_token'),
		).toBe('abc');
	});

	it('finds a cookie that is alone', () => {
		expect(readCookie('access_token=abc', 'access_token')).toBe('abc');
	});

	it('keeps everything after the first equals sign', () => {
		expect(readCookie('access_token=a.b.c==', 'access_token')).toBe(
			'a.b.c==',
		);
	});

	it('returns null when there is no header at all', () => {
		expect(readCookie(undefined, 'access_token')).toBeNull();
	});

	it('returns null when the cookie is absent', () => {
		expect(readCookie('theme=dark', 'access_token')).toBeNull();
	});

	it('returns null for an empty value', () => {
		expect(readCookie('access_token=', 'access_token')).toBeNull();
	});

	it('does not match a cookie whose name merely ends with the name', () => {
		expect(readCookie('not_access_token=abc', 'access_token')).toBeNull();
	});
});
