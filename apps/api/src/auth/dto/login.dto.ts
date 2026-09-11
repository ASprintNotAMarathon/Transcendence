import { IsEmail, IsString } from 'class-validator';
import { NormalizeEmail } from './transforms';

export class LoginDto {
	@NormalizeEmail()
	@IsEmail()
	email!: string;

	@IsString()
	password!: string;
}
