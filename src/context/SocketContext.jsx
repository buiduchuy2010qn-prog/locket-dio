import { createSocket } from "@/socket/socketClient";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/stores";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuthStore();
  const socketRef = useRef(null);
  // Keep socket in state so children re-subscribe when instance is ready
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const idToken = localStorage.getItem("idToken");
    if (!idToken || !user?.uid) return;

    if (!socketRef.current) {
      const client = createSocket(idToken, {
        onConnect: () => setIsConnected(true),
        onDisconnect: () => setIsConnected(false),
        onError: () => setIsConnected(false),
      });
      socketRef.current = client;
      setSocket(client);
    }

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [user?.uid]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
