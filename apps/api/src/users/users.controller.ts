import {
	Controller,
	Get,
	Param,
	ParseUUIDPipe,
	UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth';
import { UsersService } from './users.service';
import type { PublicProfile } from './users.types';

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
}
