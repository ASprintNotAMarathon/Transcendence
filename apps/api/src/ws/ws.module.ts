import { Module } from '@nestjs/common';
import { WsGateway } from './ws.gateway';
import { WsRegistry } from './ws.registry';

@Module({
	providers: [WsGateway, WsRegistry], // providers make it constructible
	exports: [WsRegistry], // exports is what lets other modules inject it
})
export class WsModule {}
