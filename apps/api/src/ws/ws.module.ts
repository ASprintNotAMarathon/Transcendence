import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { WsGateway } from './ws.gateway';
import { WsLifecycle } from './ws.lifecycle';
import { WsRegistry } from './ws.registry';
import { WsDispatcher } from './ws.dispatch';
import { WsSender } from './ws.sender';
import { JwtTokenVerifier, TokenVerifier } from './ws.verifier';

@Module({
	imports: [AuthModule],
	providers: [
		WsGateway,
		WsRegistry,
		WsDispatcher,
		WsSender,
		WsLifecycle,
		{ provide: TokenVerifier, useClass: JwtTokenVerifier },
	],
	exports: [WsRegistry, WsDispatcher, WsSender, WsLifecycle], // exports is what lets other modules inject it
})
export class WsModule {}
