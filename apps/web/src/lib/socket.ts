// this is the plain part of code that the React wrapper SocketProvider will call

/*
connection has two ends - one is the server (backend/api part) and the other is the browser
(user/client/frontend) part. this is the frontend part. both parts need the code that
speaks the protocol(ws.ts).
they match together like this:

   BROWSER TAB                                            API CONTAINER
   ───────────                                            ─────────────

   page calls                                             Lisandro's MatchHandlers
   send(joinMatch('m1'))                                      ▲ dispatch(client, event)
        │                                                     │
        ▼                                                     │
   lib/socket.ts ──── emit('msg', {type, cid, payload}) ───► WsGateway → parseEnvelope → WsDispatcher
        ▲                                                     
        │                                                     
   subscribe(listener) ◄── on('msg', ServerEvent) ◄──────── WsSender ◄── handlers reply / broadcast
        │
   page reacts

   ════════════════ one Socket.IO connection, through the Vite proxy at /ws ════════════════
                        both ends import shared/src/ws.ts and agree on 'msg'
*/

import { io, type Socket } from 'socket.io-client';
import type { ClientEvent, ServerEvent, WsMessageEvent } from '@transcendence/shared';

/** One Socket.IO event every envelope travels on */
const EVENT: WsMessageEvent = 'msg';

/**
 * What the UI can show about the connection.
 * connected		live
 * reconnecting		dropped; Socket.IO is retrying
 * disconnected		not trying - never opened, closed on purpose, or refused
 */
export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

type EventListener = (event: ServerEvent) => void;
type StatusListener = (status: ConnectionStatus) => void;

/**
 * One socket for the whole tab.
 * 
 * Pages call send() with envelopes from lib/protocol.ts
 */
class ClientSocket {
	private socket: Socket | null = null;
	private status: ConnectionStatus = 'disconnected';
	
	// two sets of functions - whoever wants to hear about incoming events or status changes,
	// can drop a function in here
	private readonly listeners = new Set<EventListener>();
	private readonly statusListeners = new Set<StatusListener>();
	
	/**
	 * Standing requests: envelopes to send again after every reconnect.
	 * 
	 * Reconnect is a brand-new socket opened on the server, so its rooms start empty.
	 * Anything this tab was subscribed to must be asked for again.
	 */
	private readonly standing = new Map<string, ClientEvent>();

	/** Open the connection.
	 * 
	 * @param devUserId TEMP - the dev identity from #21, recognised by api only while
	 * WS_DEV_AUTH is on. With real cookie auth the browser attaches the cookie itself and this
	 * parameter will be deleted.
	 */
	connect(devUserId?: string): void {
		if (this.socket !== null) {
			return;
		}
		// No URL: connects to wherever the page comes from, which is the Vite dev server,
		// which proxies /ws to the api.
		const socket = io({
			path: '/ws',
			query: devUserId === undefined ? undefined : { userId : devUserId },
		});
		this.socket = socket;

		socket.on('connect', () => {
			this.setStatus('connected');
			this.replayStanding();
		});

		// socket.active is true when Socket.IO will retry by itself (network drop, api restart)
		// and false when it will not (server closed us, we called disconnect(), or the handshake
		// refused us)
		socket.on('disconnect', () => {
			this.setStatus(socket.active ? 'reconnecting' : 'disconnected');
		});

		socket.on('connect_error', () => {
			this.setStatus(socket.active ? 'reconnecting' : 'disconnected');
		});

		//a message arrived
		socket.on(EVENT, (event: ServerEvent) => {
			for (const listener of this.listeners) {
				listener(event);
			}
		});
	}

	/** Close on purpose (logging out does it, network drop does not) */
	disconnect(): void {
		this.socket?.disconnect();
		this.socket = null;
		this.standing.clear();
		this.setStatus('disconnected');
	}

	send(event: ClientEvent): void {
		this.socket?.emit(EVENT, event);
	}

	join(key: string, event: ClientEvent): void {
		this.standing.set(key, event);
		if (this.status === 'connected')
			this.send(event);
	}

	leave(key: string, event?: ClientEvent): void {
		this.standing.delete(key);
		if (event !== undefined) {
			this.send(event);
		}
	}

	subscribe(listener: EventListener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	onStatus(listener: StatusListener): () => void {
		this.statusListeners.add(listener);
		listener(this.status);
		return () => this.statusListeners.delete(listener);
	}

	private setStatus(status: ConnectionStatus): void {
		if (status === this.status) {
			return;
		}
		this.status = status;
		for (const listener of this.statusListeners) {
			listener(status);
		}
	}

	private replayStanding(): void {
		for (const event of this.standing.values()) {
			this.send(event);
		}
	}
}

export const clientSocket = new ClientSocket();
