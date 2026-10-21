import { IsEmail } from 'class-validator';
import { IsString } from 'class-validator';
import { MinLength } from 'class-validator';
import { MaxLength } from 'class-validator';
import { IsDisplayName } from '../../users/display-name';
import { NormalizeEmail } from './transforms';

export class RegisterDto {
	@NormalizeEmail()
	@IsEmail()
	email!: string;

	@IsDisplayName()
	displayName!: string;

	@IsString()
	@MinLength(8)
	@MaxLength(128)
	password!: string;
}
