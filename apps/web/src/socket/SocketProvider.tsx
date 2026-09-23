import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { clientSocket, type ConnectionStatus } from "../lib/socket";
import { SocketContext, type SocketContextValue } from "./context";

/**
 * Ties the tab's one socket to whether someone is logged in, and makes it available
 * to every component through useSocket().
 * 
 * Sits above Routes so it never unmounts while navigating. The connection itself lives in
 * lib/socket.ts, this file only decides when it is open.
 * 
 * TODO Noor: the connection indicator. A component that reads useSocket().status and shows it
 * in the header. 'reconnecting' is the one that matters to a player mid-game.
 */

type Props = {
	enabled: boolean; //open the socket while true, close it the moment it turns false
	devUserId?: string; //temp dev identity that will be deleted together with WS_DEV_AUTH
	children: ReactNode;
};

export function SocketProvider({ enabled, devUserId, children}: Props) {
	const [status, setStatus] = useState<ConnectionStatus>('disconnected');

	useEffect(() => clientSocket.onStatus(setStatus), []);

	useEffect(() => {
		if (!enabled) {
			return;
		}
		clientSocket.connect(devUserId);
		return () => clientSocket.disconnect();
	}, [enabled, devUserId]);

	/*
	 * These four never change.
	 * A page that joins a room in a useEffect has to list them in its dependencies;
	 * rebuilt on every render,
	 * that effect would leave and rejoin the room each time the status changed.
	 * The leave is the dangerous half - Socket.IO buffers an emit made while the
	 * socket is down, so a match.leave sent during a reconnect can be delivered
	 * after the match.join that follows it.
	 *
	 * Nothing to close over: the socket is one module-level object.
	 */
	const send = useCallback<SocketContextValue['send']>(
		(event) => clientSocket.send(event), []);
	const join = useCallback<SocketContextValue['join']>(
		(key, event) => clientSocket.join(key, event), []);
	const leave = useCallback<SocketContextValue['leave']>(
		(key, event) => clientSocket.leave(key, event), []);
	const subscribe = useCallback<SocketContextValue['subscribe']>(
		(listener) => clientSocket.subscribe(listener), []);

	const value = useMemo<SocketContextValue>(
		() => ({ status, send, join, leave, subscribe }),
		[status, send, join, leave, subscribe],
	);

	return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}