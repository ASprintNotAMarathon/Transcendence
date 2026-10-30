import { applyDecorators } from '@nestjs/common';
import { IsString, Length, Matches } from 'class-validator';

/**
 * Everything the API says about a display name, in one file. Register and
 * rename both use it, so a name one of them accepts the other cannot refuse.
 */

export const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

/** The validation rules, as one decorator for any DTO that takes a name. */
export const IsDisplayName = () =>
	applyDecorators(IsString(), Length(3, 20), Matches(DISPLAY_NAME_PATTERN));

/** Prisma names its unique indexes <Model>_<field>_key. */
export const DISPLAY_NAME_INDEX = 'User_displayName_key';

/** One sentence for the 409, so register and rename answer alike. */
export const DISPLAY_NAME_TAKEN = 'That display name is taken';
