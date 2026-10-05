/**
 * What the auth module offers the rest of the API. Import from '../auth'
 * rather than reaching into individual files, so this folder can be
 * rearranged without touching anyone else's code:
 *
 *   import { CurrentUser, JwtAuthGuard, type AuthUser } from '../auth';
 *
 * Nothing inside this folder may import from here. A file importing its own
 * folder's index is how a circular import happens, and it fails at runtime
 * with an undefined class rather than at compile time.
 */
export { AuthModule } from './auth.module';
// Exported for the socket handshake, which cannot use the guard: it has no
// HTTP context, cookieParser never runs on an upgrade request, and refusing
// means closing the connection rather than answering 401.
export { AuthService } from './auth.service';
export { AUTH_COOKIE } from './auth-cookie';
export { JwtAuthGuard } from './jwt-auth.guard';
export { CurrentUser } from './current-user.decorator';
export { PasswordService } from './password.service';
export type { AuthUser, JwtPayload, PublicUser } from './auth.types';
