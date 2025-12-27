import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../constants/config';
import { storage } from '../services/storage';

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

    const connectSocket = async () => {
      // Solo conectar si no hay socket o está desconectado
      if (socketRef.current?.connected) {
        console.log('useSocket: Socket ya conectado, enviando registro...');
        // Si ya está conectado pero cambió el userId, volvemos a registrar
        await registerSocket(socketRef.current);
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

      socket.on('connect', async () => {
        console.log('Socket conectado:', socket.id);
        await registerSocket(socket);
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
    };

    const registerSocket = async (socket: Socket) => {
      try {
        const userDataStr = await storage.getItem('user_data');
        if (!userDataStr) {
          socket.emit('register', userId);
          return;
        }

        const userData = JSON.parse(userDataStr);
        const token = await storage.getItem('auth_token');
        let rol = userData.rol || 'unknown';

        // Si no tenemos el rol, intentamos sacarlo del token
        if (rol === 'unknown' && token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            rol = payload.rol;
          } catch (e) { }
        }

        // Obtener IDs de cursos si es docente o estudiante
        let cursos: number[] = [];
        if (rol === 'docente' || rol === 'estudiante') {
          // Intentar obtener cursos de la data guardada o esperar que se actualice después
          cursos = userData.cursos_ids || [];
        }

        socket.emit('register', {
          userId: userId,
          id_usuario: userId,
          rol: rol,
          cursos: cursos
        });
        console.log(`useSocket: Usuario ${userId} (${rol}) registrado con ${cursos.length} cursos`);
      } catch (error) {
        console.error('Error registrando socket:', error);
        socket.emit('register', userId);
      }
    };

    connectSocket();

    return () => {
      // NO desconectar el socket inmediatamente para mantenerlo entre transiciones
      // Pero sí limpiar los listeners si el componente se desmonta definitivamente
      // En Expo Router, a veces es mejor mantenerlo conectado globalmente.
      // Por ahora mantenemos la lógica de desconexión si el userId desaparece.
    };
  }, [userId]);

  return socketRef.current;
};
