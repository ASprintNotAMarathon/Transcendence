import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { WsRegistry } from './ws.registry';
import { WsDispatcher } from './ws.dispatch';
import { WsSender } from './ws.sender';
import { DenyAllVerifier, TokenVerifier } from './ws.verifier';

@Module({
	providers: [
		WsGateway,
		WsRegistry,
		WsDispatcher,
		WsSender,
		// TO DO - swap for the real implementation when #20 lands
		{ provide: TokenVerifier, useClass: DenyAllVerifier },
	],
	exports: [WsRegistry, WsDispatcher, WsSender], // exports is what lets other modules inject it
})
export class WsModule {}
