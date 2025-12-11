import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../constants/config';

export const useSocket = (
  events: { [key: string]: (data: any) => void },
  userId?: number
) => {
  const socketRef = useRef<Socket | null>(null);
  const eventsRef = useRef(events);

  // Actualizar la referencia de eventos sin causar reconexión
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    if (!userId) {
      console.log('useSocket: No hay userId, esperando...');
      return;
    }

    // Solo conectar si no hay socket o está desconectado
    if (socketRef.current?.connected) {
      console.log('useSocket: Socket ya conectado, reutilizando...');
      return;
    }

    console.log('useSocket: Conectando al servidor WebSocket...');
    const socket = io(API_URL.replace('/api', ''), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket conectado:', socket.id);
      socket.emit('register', userId);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket desconectado:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Error de conexión socket:', error.message);
    });

    // Registrar todos los eventos usando la referencia
    Object.keys(eventsRef.current).forEach((eventName) => {
      socket.on(eventName, (data) => {
        console.log(`Evento recibido: ${eventName}`, data);
        // Usar la referencia actual de eventos
        const handler = eventsRef.current[eventName];
        if (handler) {
          handler(data);
        }
      });
    });

    return () => {
      console.log('useSocket: Desconectando socket...');
      socket.off(); // Remover todos los listeners
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]); // Solo depende de userId

  return socketRef.current;
};
