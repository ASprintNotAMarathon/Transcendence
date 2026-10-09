import { Module } from '@nestjs/common';
import { AuthModule } from '../auth';
import { WsGateway } from './ws.gateway';
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
		{ provide: TokenVerifier, useClass: JwtTokenVerifier },
	],
	exports: [WsRegistry, WsDispatcher, WsSender], // exports is what lets other modules inject it
})
export class WsModule {}
