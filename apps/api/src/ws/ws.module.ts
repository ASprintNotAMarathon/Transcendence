import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { WsRegistry } from './ws.registry';
import { WsDispatcher } from './ws.dispatch';
import { WsSender } from './ws.sender';

@Module({
	providers: [WsGateway, WsRegistry, WsDispatcher, WsSender], // providers make it constructible
	exports: [WsRegistry, WsDispatcher, WsSender], // exports is what lets other modules inject it
})
export class WsModule {}
