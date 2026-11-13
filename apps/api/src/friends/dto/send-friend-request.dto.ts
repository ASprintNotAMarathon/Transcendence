import { IsUUID } from 'class-validator';

/**
 * The body of POST /friends/requests. Only the other person's id: who is
 * sending comes from the cookie. The global pipe forbids unknown fields.
 */
export class SendFriendRequestDto {
	@IsUUID()
	userId!: string;
}
