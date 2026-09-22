import { Injectable } from '@nestjs/common';
import { implementedGames } from '@transcendence/shared';

@Injectable()
export class AppService {
	getHello(): string {
		return 'Hello World!';
	}

	/**
	 * The games that can actually be played, which is narrower than the games the
	 * schema knows about: GameName lists reversi, but no engine implements it
	 * yet. Derived from the registry in @transcendence/shared, so adding an
	 * engine is the only thing needed to make it appear here.
	 */
	availableGames(): string[] {
		return [...implementedGames];
	}
}
