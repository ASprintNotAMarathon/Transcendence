import { createContext, useContext } from "react";
import { clientSocket, type ConnectionStatus } from "../lib/socket";

export type SocketContextValue = {
	status: ConnectionStatus;
	send: typeof clientSocket.send;
	join: typeof clientSocket.join;
	leave: typeof clientSocket.leave;
	subscribe: typeof clientSocket.subscribe;
};

export const SocketContext = createContext<SocketContextValue | null>(null);

export function useSocket(): SocketContextValue {
	const ctx = useContext(SocketContext);
	if (ctx === null) {
		throw new Error('useSocket must be used inside a SocketProvider');
	}
	return ctx;
}