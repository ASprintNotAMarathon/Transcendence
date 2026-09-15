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
export { JwtAuthGuard } from './jwt-auth.guard';
export { CurrentUser } from './current-user.decorator';
export { PasswordService } from './password.service';
export type { AuthUser, JwtPayload, PublicUser } from './auth.types';
