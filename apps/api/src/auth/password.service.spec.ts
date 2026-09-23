import { describe, expect, it } from 'vitest';
import { PasswordService } from './password.service';

const PASSWORD = 'correct-horse-battery-staple';

describe('PasswordService', () => {
	// Nothing is injected into it, so there is no testing module to build.
	const passwords = new PasswordService();

	it('produces an argon2id digest', async () => {
		const digest = await passwords.hash(PASSWORD);

		expect(digest.startsWith('$argon2id$')).toBe(true);
		expect(digest).not.toContain(PASSWORD);
	});

	it('accepts the right password', async () => {
		const digest = await passwords.hash(PASSWORD);

		// Also the argument-order test: verify() throws rather than returning
		// false when the digest and the password are the wrong way round, so
		// swapping them turns this red immediately.
		await expect(passwords.verify(digest, PASSWORD)).resolves.toBe(true);
	});

	it('rejects the wrong password', async () => {
		const digest = await passwords.hash(PASSWORD);

		await expect(passwords.verify(digest, 'not-it')).resolves.toBe(false);
	});

	it('salts each hash, so one password hashes two different ways', async () => {
		const [first, second] = await Promise.all([
			passwords.hash(PASSWORD),
			passwords.hash(PASSWORD),
		]);

		// If these ever matched, the salt would be fixed or gone, and every
		// account sharing a password would share a digest.
		expect(first).not.toBe(second);

		// Both still verify: each string carries its own salt.
		await expect(passwords.verify(first, PASSWORD)).resolves.toBe(true);
		await expect(passwords.verify(second, PASSWORD)).resolves.toBe(true);
	});
});
