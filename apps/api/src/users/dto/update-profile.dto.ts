import { IsDisplayName } from '../display-name';

/**
 * The body of PATCH /users/me. Only the name for now; the avatar has its own
 * upload route. The global pipe forbids unknown fields, so nobody can slip an
 * email or an avatarPath in through here.
 */
export class UpdateProfileDto {
	@IsDisplayName()
	displayName!: string;
}
