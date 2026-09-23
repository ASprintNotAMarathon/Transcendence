import {
	UnauthorizedException,
	createParamDecorator,
	type ExecutionContext,
} from '@nestjs/common';
import type { AuthUser, AuthedRequest } from './auth.types';

/**
 * Hands a controller the user the guard identified:
 *
 *   @UseGuards(JwtAuthGuard)
 *   @Get('profile')
 *   profile(@CurrentUser() user: AuthUser) { ... }
 *
 * The check only fires when this is used without the guard in front of it,
 * and it turns that mistake into an honest 401 rather than a crash deeper in
 * somebody's controller.
 */
export const CurrentUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): AuthUser => {
		const { user } = ctx.switchToHttp().getRequest<AuthedRequest>();

		if (!user) {
			throw new UnauthorizedException();
		}

		return user;
	},
);
