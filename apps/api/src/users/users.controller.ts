import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Patch,
	Post,
	UploadedFile,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
	CurrentUser,
	JwtAuthGuard,
	type AuthUser,
	type PublicUser,
} from '../auth';
import { AVATAR_FIELD, AVATAR_MAX_BYTES } from './avatar';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
import type { PublicProfile } from './users.types';

/**
 * The part of multer's file object this route reads. Declared here rather
 * than pulling in @types/multer for one field.
 */
type UploadedAvatar = { buffer: Buffer };

/**
 * Guarded as a whole: profiles are for logged-in players. The web app only
 * asks from behind its ProtectedRoute, and a public endpoint would let anyone
 * list the players without an account.
 */
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
	constructor(private readonly users: UsersService) {}

	/**
	 * ParseUUIDPipe turns `/users/abc` into a 400. Without it the string
	 * reaches a uuid column, Postgres refuses it, and the client gets a 500
	 * for what is really its own mistake.
	 */
	@Get(':id')
	findOne(@Param('id', ParseUUIDPipe) id: string): Promise<PublicProfile> {
		return this.users.findProfile(id);
	}

	/**
	 * The id comes from the cookie, never the URL, so the only user anyone
	 * can rename is themselves.
	 */
	@Patch('me')
	updateMe(
		@CurrentUser() user: AuthUser,
		@Body() dto: UpdateProfileDto,
	): Promise<PublicUser> {
		return this.users.updateDisplayName(user.id, dto.displayName);
	}

	/**
	 * A multipart upload with the image in the `avatar` field.
	 *
	 * No `dest` or `storage`, so multer keeps the file in memory: nothing
	 * touches the disk until the service has checked the bytes. The size
	 * limit makes multer stop reading at 5 MB and answer 413, and `files: 1`
	 * refuses a second file instead of buffering it.
	 *
	 * 200 rather than Nest's default 201 for a POST: it replaces the caller's
	 * avatar, it does not create something at a new address.
	 */
	@HttpCode(HttpStatus.OK)
	@Post('me/avatar')
	@UseInterceptors(
		FileInterceptor(AVATAR_FIELD, {
			limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
		}),
	)
	uploadAvatar(
		@CurrentUser() user: AuthUser,
		@UploadedFile() file: UploadedAvatar | undefined,
	): Promise<PublicUser> {
		return this.users.updateAvatar(user.id, file?.buffer);
	}
}
