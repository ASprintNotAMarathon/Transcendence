import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { clientSocket, type ConnectionStatus } from "../lib/socket";
import { SocketContext, type SocketContextValue } from "./context";

// TODO Noor: the connection indicator.

type Props = {
	enabled: boolean;
	devUserId?: string;
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