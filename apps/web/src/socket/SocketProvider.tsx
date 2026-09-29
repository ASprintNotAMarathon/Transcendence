import { useEffect, useState, type ReactNode } from "react";
import { clientSocket, type ConnectionStatus } from "../lib/socket";
import { SocketContext, type SocketContextValue } from "./context";

/**
 * Ties the tab's one socket to whether someone is logged in, and makes it available
 * to every component through useSocket().
 * 
 * Sits above Routes so it never unmounts while navigating. The connection itself lives in
 * lib/socket.ts, this file only decides when it is open.
 * 
 * 
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

	const value: SocketContextValue = {
		status,
		send: (event) => clientSocket.send(event),
		join: (key, event) => clientSocket.join(key, event),
		leave: (key, event) => clientSocket.leave(key, event),
		subscribe: (listener) => clientSocket.subscribe(listener),
	};

	return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}