// apps/api/src/auth/dto/transforms.ts
import { Transform } from 'class-transformer';

/**
 * Postgres @unique compares exactly, so the API stores and looks up one form only.
 * Guarded on the type: a non-string would otherwise crash with a 500 instead of a 400.
 */
export const NormalizeEmail = () =>
	Transform(({ value }: { value: unknown }) =>
		typeof value === 'string' ? value.trim().toLowerCase() : value,
	);
