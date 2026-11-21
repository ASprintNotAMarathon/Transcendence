import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Logger,
	Param,
	ParseUUIDPipe,
	Post,
	UseFilters,
	UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, type AuthUser } from '../auth';
import { ExpectedErrorFilter } from '../http/expected-error.filter';
import { WsSender } from '../ws/ws.sender';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { FriendsService } from './friends.service';
import type { Friend, FriendRequests, FriendshipState } from './friends.types';

/**
 * The failures of a friend action that are normal use: a request the other
 * player just withdrew (404), both players asking at once (409), a bad id
 * (400). They answer 200 { ok: false } so the browser logs nothing. The
 * guard's 401 stays a real 401.
 */
const friendActionFailures = new ExpectedErrorFilter(
	HttpStatus.BAD_REQUEST,
	HttpStatus.NOT_FOUND,
	HttpStatus.CONFLICT,
);

/**
 * Every route is about the caller's own friends, so the caller's id always
 * comes from the cookie and never from the URL or the body.
 */
@UseGuards(JwtAuthGuard)
@Controller('friends')
export class FriendsController {
	private readonly logger = new Logger(FriendsController.name);

	constructor(
		private readonly friends: FriendsService,
		private readonly sender: WsSender,
	) {}

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
	@UseFilters(friendActionFailures)
	@Post('requests')
	async send(
		@CurrentUser() user: AuthUser,
		@Body() dto: SendFriendRequestDto,
	): Promise<{ friendship: FriendshipState }> {
		const friendship = await this.friends.sendRequest(user.id, dto.userId);
		this.changed(user.id, dto.userId);
		return { friendship };
	}

	@UseFilters(friendActionFailures)
	@HttpCode(HttpStatus.NO_CONTENT)
	@Post('requests/:id/accept')
	async accept(
		@CurrentUser() user: AuthUser,
		@Param('id', ParseUUIDPipe) id: string,
	): Promise<void> {
		const requesterId = await this.friends.accept(user.id, id);
		this.changed(user.id, requesterId);
	}

	@UseFilters(friendActionFailures)
	@HttpCode(HttpStatus.NO_CONTENT)
	@Post('requests/:id/decline')
	async decline(
		@CurrentUser() user: AuthUser,
		@Param('id', ParseUUIDPipe) id: string,
	): Promise<void> {
		const requesterId = await this.friends.decline(user.id, id);
		this.changed(user.id, requesterId);
	}

	/** Removes a friend, or cancels a request you sent. */
	@UseFilters(friendActionFailures)
	@HttpCode(HttpStatus.NO_CONTENT)
	@Delete(':userId')
	async remove(
		@CurrentUser() user: AuthUser,
		@Param('userId', ParseUUIDPipe) userId: string,
	): Promise<void> {
		await this.friends.remove(user.id, userId);
		this.changed(user.id, userId);
	}

	/** Both sides, every tab: the caller's other tabs are stale too. */
	private changed(me: string, otherId: string): void {
		try {
			for (const userId of [me, otherId]) {
				this.sender.sendToUser(userId, {
					type: 'friends.changed',
					payload: {},
				});
			}
		} catch (error) {
			// The change is saved; a missed nudge only costs a reload.
			this.logger.error(`could not tell ${me} and ${otherId}`, error);
		}
	}
}
