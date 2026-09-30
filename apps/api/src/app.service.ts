import { Injectable } from '@nestjs/common';
import { implementedGames } from '@transcendence/shared';

@Injectable()
export class AppService {
	getHello(): string {
		return 'Hello World!';
	}

	availableGames(): string[] {
		return [...implementedGames];
	}
}
