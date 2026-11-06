import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	ParseUUIDPipe,
	Post,
	UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../auth';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { FriendsService } from './friends.service';
import type { Friend, FriendRequests, FriendshipState } from './friends.types';

/**
 * Every route is about the caller's own friends, so the caller's id always
 * comes from the cookie and never from the URL or the body.
 */
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
	constructor(private readonly friends: FriendsService) {}

	@Get()
	list(@CurrentUser() user: AuthUser): Promise<Friend[]> {
		return this.friends.listFriends(user.id);
	}

	@Get('requests')
	requests(@CurrentUser() user: AuthUser): Promise<FriendRequests> {
		return this.friends.listRequests(user.id);
	}

	/**
	 * Answers with the new state, the same word the profile shows, so the
	 * button can change without asking again. 'friends' when they had
	 * already asked you.
	 */
	@Post('requests')
	async send(
		@CurrentUser() user: AuthUser,
		@Body() dto: SendFriendRequestDto,
	): Promise<{ friendship: FriendshipState }> {
		const friendship = await this.friends.sendRequest(user.id, dto.userId);
		return { friendship };
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Post('requests/:id/accept')
	accept(
		@CurrentUser() user: AuthUser,
		@Param('id', ParseUUIDPipe) id: string,
	): Promise<void> {
		return this.friends.accept(user.id, id);
	}

	@HttpCode(HttpStatus.NO_CONTENT)
	@Post('requests/:id/decline')
	decline(
		@CurrentUser() user: AuthUser,
		@Param('id', ParseUUIDPipe) id: string,
	): Promise<void> {
		return this.friends.decline(user.id, id);
	}

	/** Removes a friend, or cancels a request you sent. */
	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(':userId')
	remove(
		@CurrentUser() user: AuthUser,
		@Param('userId', ParseUUIDPipe) userId: string,
	): Promise<void> {
		return this.friends.remove(user.id, userId);
	}
}
