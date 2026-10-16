import { Module } from '@nestjs/common';
import { WsModule } from '../ws/ws.module';
import { ChatHandlers } from './chat.handlers';
import { ChatService } from './chat.service';

/**
 * Same shape as MatchModule: the handlers are the service's only caller,
 * and everything reaches the wire through WsModule's dispatcher and sender.
 */
@Module({
	imports: [WsModule],
	providers: [ChatService, ChatHandlers],
})
export class ChatModule {}
