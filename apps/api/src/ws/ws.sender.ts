import { Injectable } from "@nestjs/common";
import type { ServerEvent } from "@transcendence/shared";
import { userRoom } from "./ws.rooms";
import { EVENT } from "./ws.types";
import type { WsServer, WsSocket } from './ws.types';


/**
 * The only way anything leaves the server.
 * 
 * Every slice sends through here, so the envelope is never assembled twice and
 * the event name has one definition. When we add logging or rate limiting, there
 * is one place to put it.
 */
@Injectable()
export class WsSender {
	private server: WsServer | undefined;

	/** Called once, from the gateway's afterInit. Nothing sends before that */
	bind(server: WsServer):void {
		this.server = server;
	}

	/** Everyone in the room, including whoever caused the event */
	broadcast(room: string, event: ServerEvent): void {
		this.requireServer().to(room).emit(EVENT, event);
	}

	/** Every socket one user has open (every tab, every device) */
	sendToUser(userId: string, event: ServerEvent): void {
		this.broadcast(userRoom(userId), event);
	}

	/** This one connection only. For a reply nobody else should see */
	sendToSocket(client: WsSocket, event: ServerEvent): void {
		client.emit(EVENT, event);
	}

	private requireServer(): WsServer {
		if (this.server === undefined) {
			throw new Error('WsSender used before tha gateway bound it');
		}
		return this.server;
	}
}