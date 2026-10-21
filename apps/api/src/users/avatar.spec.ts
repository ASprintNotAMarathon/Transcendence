import { describe, expect, it } from 'vitest';
import { avatarUrl, detectImageType } from './avatar';

/** The first bytes of each format, plus some filler so lengths are realistic. */
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d,
]);
const WEBP = Buffer.concat([
	Buffer.from('RIFF', 'latin1'),
	Buffer.from([0x24, 0, 0, 0]),
	Buffer.from('WEBPVP8 ', 'latin1'),
]);

describe('detectImageType', () => {
	it.each([
		['jpg', JPEG],
		['png', PNG],
		['webp', WEBP],
	])('recognises %s from its first bytes', (type, bytes) => {
		expect(detectImageType(bytes)).toBe(type);
	});

	it('refuses a GIF', () => {
		expect(detectImageType(Buffer.from('GIF89a\x01\x00', 'latin1'))).toBe(
			null,
		);
	});

	it('refuses an SVG, which can carry a script', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>';
		expect(detectImageType(Buffer.from(svg))).toBe(null);
	});

	it('refuses text whatever it claims to be', () => {
		expect(detectImageType(Buffer.from('not really a png'))).toBe(null);
	});

	it('refuses a RIFF file that is not WebP, such as a WAV', () => {
		const wav = Buffer.concat([
			Buffer.from('RIFF', 'latin1'),
			Buffer.from([0x24, 0, 0, 0]),
			Buffer.from('WAVEfmt ', 'latin1'),
		]);
		expect(detectImageType(wav)).toBe(null);
	});

	it('refuses a file too short to hold any signature', () => {
		expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBe(null);
		expect(detectImageType(Buffer.alloc(0))).toBe(null);
	});
});

describe('avatarUrl', () => {
	it('puts the file name under the public prefix', () => {
		expect(avatarUrl('a1b2c3.webp')).toBe('/api/avatars/a1b2c3.webp');
	});

	it('keeps null as null, for a user without an avatar', () => {
		expect(avatarUrl(null)).toBe(null);
	});
});
