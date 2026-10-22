import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
	BadRequestException,
	HttpStatus,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException,
	type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PUBLIC_USER_SELECT, toPublicUser, type PublicUser } from '../auth';
import type { EnvConfig } from '../config/env.validation';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { duplicateOf, uniqueViolationIndex } from '../prisma/unique-violation';
import { AVATAR_FIELD, detectImageType } from './avatar';
import { DISPLAY_NAME_INDEX, DISPLAY_NAME_TAKEN } from './display-name';
import {
	PUBLIC_PROFILE_SELECT,
	toPublicProfile,
	type PublicProfile,
} from './users.types';

/** P2025: the row a write targeted does not exist. */
function isRecordNotFound(error: unknown): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === 'P2025'
	);
}

/**
 * A refused upload, in the same per-field envelope as a failed form field, so
 * the profile page marks the file input like any other.
 */
function avatarRejected(message: string): BadRequestException {
	return new BadRequestException({
		statusCode: HttpStatus.BAD_REQUEST,
		error: 'Bad Request',
		errors: { [AVATAR_FIELD]: message },
	});
}

@Injectable()
export class UsersService implements OnModuleInit {
	private readonly logger = new Logger(UsersService.name);
	private readonly avatarDir: string;

	constructor(
		private readonly prisma: PrismaService,
		config: ConfigService<EnvConfig, true>,
	) {
		this.avatarDir = config.get('AVATAR_DIR', { infer: true });
	}

	/**
	 * Created at boot, so a fresh checkout or an empty volume works on the
	 * first upload, and a folder the API cannot write to stops it at start
	 * rather than on somebody's upload.
	 */
	async onModuleInit(): Promise<void> {
		await mkdir(this.avatarDir, { recursive: true });
	}

	/**
	 * Somebody else's profile. A missing user is a 404 here, unlike /auth/me:
	 * the caller is logged in and simply asked for an id that does not exist.
	 */
	async findProfile(id: string): Promise<PublicProfile> {
		const user = await this.prisma.user.findUnique({
			where: { id },
			select: PUBLIC_PROFILE_SELECT,
		});

		if (!user) {
			throw new NotFoundException();
		}

		return toPublicProfile(user);
	}

	/**
	 * Renames the caller and answers with their whole user, the same object
	 * /auth/me returns, so the client can swap it in without asking again.
	 *
	 * No "is it free?" query first: two renames could both read "free" and one
	 * would crash. The unique index decides, and its error becomes the 409.
	 * Renaming to the name you already have collides with nothing.
	 */
	async updateDisplayName(
		userId: string,
		displayName: string,
	): Promise<PublicUser> {
		try {
			const user = await this.prisma.user.update({
				where: { id: userId },
				data: { displayName },
				select: PUBLIC_USER_SELECT,
			});
			return toPublicUser(user);
		} catch (error) {
			if (uniqueViolationIndex(error) === DISPLAY_NAME_INDEX) {
				throw duplicateOf('displayName', DISPLAY_NAME_TAKEN);
			}
			// A valid token whose user is gone: 401, as /auth/me answers.
			if (isRecordNotFound(error)) {
				throw new UnauthorizedException();
			}
			throw error;
		}
	}

	/**
	 * Stores a new avatar and answers with the whole user, like a rename.
	 *
	 * The order is what keeps the database honest: the file is on disk before
	 * any row points at it, and the old file goes only once nothing does. A
	 * failure at any step leaves the previous avatar working.
	 *
	 * The size limit is not checked here. Multer enforces it while reading,
	 * before this runs.
	 */
	async updateAvatar(
		userId: string,
		bytes: Buffer | undefined,
	): Promise<PublicUser> {
		if (!bytes) {
			throw avatarRejected('Choose an image to upload');
		}

		const type = detectImageType(bytes);
		if (!type) {
			throw avatarRejected('Only JPEG, PNG or WebP images are allowed');
		}

		const current = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { avatarPath: true },
		});
		if (!current) {
			throw new UnauthorizedException();
		}

		// Our name, never the uploader's: no path tricks, no collisions, and
		// the extension is what the bytes turned out to be. 'wx' refuses to
		// overwrite, so even a repeated uuid could not replace a file.
		const fileName = `${randomUUID()}.${type}`;
		await writeFile(join(this.avatarDir, fileName), bytes, { flag: 'wx' });

		let user;
		try {
			user = await this.prisma.user.update({
				where: { id: userId },
				data: { avatarPath: fileName },
				select: PUBLIC_USER_SELECT,
			});
		} catch (error) {
			// Nothing points at the new file, so it must not stay behind.
			await this.removeAvatarFile(fileName);
			if (isRecordNotFound(error)) {
				throw new UnauthorizedException();
			}
			throw error;
		}

		if (current.avatarPath) {
			await this.removeAvatarFile(current.avatarPath);
		}

		return toPublicUser(user);
	}

	/**
	 * Best effort. A file that is already gone is fine, and a leftover file
	 * harms nobody, so neither is worth failing a request that already
	 * succeeded. Logged so a pile of leftovers would be noticed.
	 */
	private async removeAvatarFile(fileName: string): Promise<void> {
		try {
			await rm(join(this.avatarDir, fileName), { force: true });
		} catch (error) {
			this.logger.warn(
				`Could not remove avatar ${fileName}: ${String(error)}`,
			);
		}
	}
}
