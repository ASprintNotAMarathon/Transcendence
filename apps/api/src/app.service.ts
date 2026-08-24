import { Injectable } from '@nestjs/common';
import type { GameEngine } from '@transcendence/shared';

/**
 * Game engines register here as they are implemented in @transcendence/shared,
 * keyed by the engine's `name` (e.g. "gomoku", "reversi").
 */
const engines = new Map<string, GameEngine<unknown, unknown>>();

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  availableGames(): string[] {
    return [...engines.keys()];
  }
}
