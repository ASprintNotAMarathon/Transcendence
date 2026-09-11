import { IsEmail } from 'class-validator';
import { IsString } from 'class-validator';
import { MinLength } from 'class-validator';
import { MaxLength } from 'class-validator';
import { Matches } from 'class-validator';
import { Length } from 'class-validator';
import { NormalizeEmail } from './transforms';

export const DISPLAY_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

export class RegisterDto {
	@NormalizeEmail()
	@IsEmail()
	email!: string;

	@IsString()
	@Length(3, 20)
	@Matches(DISPLAY_NAME_PATTERN)
	displayName!: string;

	@IsString()
	@MinLength(8)
	@MaxLength(128)
	password!: string;
}
