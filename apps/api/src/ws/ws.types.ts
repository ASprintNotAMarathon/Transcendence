import type { DefaultEventsMap, Server, Socket } from "socket.io";

/**
 * What the handshake middleware hangs on every socket it lets through.
 * A socket that reached the gateway has been past that middleware, so
 * userId is always present.
 */
export interface WsData {
	userId: string;
}

export type WsSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, WsData>;
export type WsServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, WsData>;