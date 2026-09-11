import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

/**
 * The only file that imports argon2. Cost parameters, or the library itself,
 * change here and nowhere else — including for the seed script, which must
 * produce hashes this same helper can verify.
 *
 * No options are passed, so the library's argon2id defaults apply. Every hash
 * records the parameters it was made with, so raising them later still leaves
 * older passwords verifiable.
 */
@Injectable()
export class PasswordService {
	hash(plain: string): Promise<string> {
		return hash(plain);
	}

	/**
	 * Order matters: the stored digest first, the password the user typed
	 * second. Swapped, this throws rather than returning false. It also throws
	 * on a malformed digest, so callers that verify against a placeholder hash
	 * have to treat a rejection as a failed login, not a server error.
	 */
	verify(digest: string, plain: string): Promise<boolean> {
		return verify(digest, plain);
	}
}
