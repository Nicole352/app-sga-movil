import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { getToken, storage } from '../services/storage';
import { API_URL } from '../constants/config';

export interface Notificacion {
  id: string;
  tipo: 'modulo' | 'tarea' | 'pago' | 'calificacion' | 'matricula' | 'general';
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha: Date;
  fechaLeida?: Date;
  link?: string;
  data?: any;
}

type RolUsuario = 'admin' | 'docente' | 'estudiante';

export const useNotifications = (rol: RolUsuario) => {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);

  const obtenerLinkPorTipo = (tipo: string, rol: RolUsuario): string | undefined => {
    if (rol === 'estudiante') {
      if (tipo === 'modulo') return '/roles/estudiante-movil/miaula';
      if (tipo === 'tarea' || tipo === 'calificacion') return '/roles/estudiante-movil/miaula';
      if (tipo === 'pago') return '/roles/estudiante-movil/pagosmensuales';
      if (tipo === 'matricula') return '/roles/estudiante-movil/miaula';
      if (tipo === 'general') return '/roles/estudiante-movil/perfil';
    }
    if (rol === 'docente') {
      if (tipo === 'modulo' || tipo === 'tarea') return '/roles/docente-movil/cursos';
      if (tipo === 'calificacion') return '/roles/docente-movil/calificaciones';
      if (tipo === 'matricula') return '/roles/docente-movil/estudiantes';
      if (tipo === 'general') return '/roles/docente-movil/perfil';
    }
    return undefined;
  };

  const fetchNotifications = useCallback(async (retryCount = 0) => {
    try {
      const token = await getToken();

      if (!token) {
        if (retryCount < 3) {
          console.log(`useNotifications: Token no encontrado, reintentando (${retryCount + 1}/3)...`);
          setTimeout(() => fetchNotifications(retryCount + 1), 1000);
        }
        return;
      }

      console.log('useNotifications: Obteniendo notificaciones del servidor...');
      const response = await fetch(`${API_URL}/notificaciones/mis-notificaciones`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`useNotifications: ${data.notificaciones?.length || 0} notificaciones obtenidas`);

        if (data.success && Array.isArray(data.notificaciones)) {
          const mappedNotifications: Notificacion[] = data.notificaciones.map((n: any) => ({
            id: n.id_notificacion.toString(),
            tipo: n.tipo || 'general',
            titulo: n.titulo,
            mensaje: n.mensaje,
            leida: Boolean(n.leida),
            fecha: new Date(n.fecha_creacion),
            fechaLeida: n.fecha_lectura ? new Date(n.fecha_lectura) : undefined,
            link: obtenerLinkPorTipo(n.tipo, rol),
            data: n
          }));
          setNotificaciones(mappedNotifications);
        }
      } else {
        console.error('useNotifications: Error en respuesta del servidor', response.status);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [rol]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const agregarNotificacion = useCallback(
    (notif: Omit<Notificacion, 'id' | 'leida' | 'fecha'>) => {
      const nueva: Notificacion = {
        ...notif,
        id: `${Date.now()}-${Math.random()}`,
        leida: false,
        fecha: new Date()
      };
      setNotificaciones((prev) => [nueva, ...prev].slice(0, 50));
    },
    []
  );

  const marcarTodasLeidas = useCallback(async () => {
    const ahora = new Date();
    setNotificaciones((prev) =>
      prev.map((n) => ({
        ...n,
        leida: true,
        fechaLeida: ahora
      }))
    );

    try {
      const token = await getToken();
      if (token) {
        await fetch(`${API_URL}/notificaciones/marcar-todas-leidas`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, []);

  const events: { [key: string]: (data: any) => void } = {};

  if (rol === 'estudiante') {
    events.nuevo_modulo = (data: any) => {
      const docente = data.docente_nombre ? ` (${data.docente_nombre})` : '';
      agregarNotificacion({
        tipo: 'modulo',
        titulo: '📚 Nuevo módulo disponible',
        mensaje: `${data.nombre_modulo} - ${data.curso_nombre}${docente}`,
        link: '/roles/estudiante-movil/miaula',
        data
      });
    };

    events.nueva_tarea = (data: any) => {
      const fechaEntrega = new Date(data.fecha_entrega);
      const fechaFormateada = fechaEntrega.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const horaFormateada = fechaEntrega.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      const curso = data.curso_nombre || 'tu curso';
      const docente = data.docente_nombre ? ` (${data.docente_nombre})` : '';

      agregarNotificacion({
        tipo: 'tarea',
        titulo: '📝 Nueva tarea asignada',
        mensaje: `${data.titulo_tarea} - ${curso}${docente} - Fecha límite: ${fechaFormateada} a las ${horaFormateada}`,
        link: '/roles/estudiante-movil/miaula',
        data
      });
    };

    events.tarea_calificada = (data: any) => {
      const curso = data.curso_nombre ? ` - ${data.curso_nombre}` : '';
      const docente = data.docente_nombre ? ` (${data.docente_nombre})` : '';
      agregarNotificacion({
        tipo: 'calificacion',
        titulo: '⭐ Tarea calificada',
        mensaje: `${data.tarea_titulo}${curso}${docente} - Nota: ${data.nota}`,
        link: '/roles/estudiante-movil/miaula',
        data
      });
    };

    events.pago_verificado_estudiante = (data: any) => {
      const curso = data.curso_nombre ? ` - ${data.curso_nombre}` : '';
      const admin = data.admin_nombre ? ` (verificado por ${data.admin_nombre})` : '';
      agregarNotificacion({
        tipo: 'pago',
        titulo: '✅ Pago verificado',
        mensaje: `Cuota #${data.numero_cuota}${curso} - Monto: S/${data.monto}${admin}`,
        link: '/roles/estudiante-movil/pagosmensuales',
        data
      });
    };

    events.pago_rechazado = (data: any) => {
      const curso = data.curso_nombre ? ` - ${data.curso_nombre}` : '';
      const motivo = data.observaciones?.trim() ? data.observaciones : 'Revisa el comprobante y vuelve a subirlo.';
      agregarNotificacion({
        tipo: 'pago',
        titulo: '❌ Pago rechazado',
        mensaje: `Cuota #${data.numero_cuota}${curso} - Motivo: ${motivo}`,
        link: '/roles/estudiante-movil/pagosmensuales',
        data
      });
    };

    events.matricula_aprobada = (data: any) =>
      agregarNotificacion({
        tipo: 'matricula',
        titulo: '🎉 Matrícula aprobada',
        mensaje: `¡Bienvenido a ${data.curso_nombre}!`,
        link: '/roles/estudiante-movil/miaula',
        data
      });

    events.recordatorio_pago = (data: any) => {
      const curso = data.curso_nombre ? ` - ${data.curso_nombre}` : '';
      const fechaVencimiento = new Date(data.fecha_vencimiento).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      agregarNotificacion({
        tipo: 'pago',
        titulo: '⚠️ Recordatorio de Pago',
        mensaje: `Tu cuota #${data.numero_cuota}${curso} vence el ${fechaVencimiento}. Evita el bloqueo de tu cuenta.`,
        link: '/roles/estudiante-movil/pagosmensuales',
        data
      });
    };

    events.cuenta_bloqueada = (data: any) => {
      agregarNotificacion({
        tipo: 'general',
        titulo: '🚫 Cuenta Bloqueada',
        mensaje: `Tu cuenta ha sido bloqueada. Motivo: ${data.motivo}. Por favor contacta a administración.`,
        link: '/roles/estudiante-movil/perfil',
        data
      });
    };

    events.cuenta_desbloqueada = (data: any) => {
      agregarNotificacion({
        tipo: 'general',
        titulo: '✅ Cuenta Desbloqueada',
        mensaje: `Tu cuenta ha sido desbloqueada. Ya puedes acceder a todos los servicios.`,
        link: '/roles/estudiante-movil/perfil',
        data
      });
    };

    events.desbloqueo_temporal = (data: any) => {
      const horas = data.horas_restantes || 24;
      agregarNotificacion({
        tipo: 'pago',
        titulo: '⏰ Desbloqueo Temporal Concedido',
        mensaje: `Tienes ${horas} horas para subir la evidencia de pago. Si no lo haces, tu cuenta se bloqueará automáticamente.`,
        link: '/roles/estudiante-movil/pagosmensuales',
        data
      });
    };
  }

  // Eventos para docentes
  if (rol === 'docente') {
    const handlerEntrega = (data: any) => {
      const estudiante = data.estudiante_nombre ? `${data.estudiante_nombre}` : 'Un estudiante';
      const curso = data.curso_nombre ? ` - ${data.curso_nombre}` : '';
      agregarNotificacion({
        tipo: 'tarea',
        titulo: '📤 Nueva entrega recibida',
        mensaje: `${estudiante} ha entregado: ${data.tarea_titulo || data.titulo_tarea}${curso}`,
        link: '/roles/docente-movil/cursos',
        data
      });
    };

    events.nueva_entrega = handlerEntrega;
    events.tarea_entregada_docente = handlerEntrega;
    events.tarea_entregada = handlerEntrega;
    events.entrega_actualizada = handlerEntrega;

    const handlerMatricula = (data: any) => {
      const estudiante = data.estudiante_nombre ? `${data.estudiante_nombre}` : 'Un estudiante';
      const curso = data.curso_nombre ? ` - ${data.curso_nombre}` : '';
      agregarNotificacion({
        tipo: 'matricula',
        titulo: '🎓 Nueva matrícula',
        mensaje: `${estudiante} se ha matriculado${curso}`,
        link: '/roles/docente-movil/estudiantes',
        data
      });
    };

    events.nueva_matricula = handlerMatricula;
    events.nueva_matricula_curso = handlerMatricula;

    events.curso_asignado = (data: any) => {
      agregarNotificacion({
        tipo: 'general',
        titulo: '📚 Nuevo curso asignado',
        mensaje: `Se te ha asignado el curso: ${data.curso_nombre}`,
        link: '/roles/docente-movil/cursos',
        data
      });
    };

    const handlerRecordatorio = (data: any) => {
      const pendientes = data.entregas_pendientes || data.cantidad_entregas || 0;
      const curso = data.curso_nombre ? ` - ${data.curso_nombre}` : '';
      agregarNotificacion({
        tipo: 'calificacion',
        titulo: '⏰ Recordatorio de calificación',
        mensaje: `Tienes ${pendientes} entregas pendientes de calificar${curso}`,
        link: '/roles/docente-movil/calificaciones',
        data
      });
    };

    events.recordatorio_calificacion = handlerRecordatorio;
    events.tareas_por_calificar = handlerRecordatorio;

    events.modulo_creado = (data: any) => {
      agregarNotificacion({
        tipo: 'modulo',
        titulo: '📚 Módulo creado',
        mensaje: `Se ha creado un nuevo módulo: ${data.nombre_modulo}`,
        link: '/roles/docente-movil/cursos',
        data
      });
    };

    events.nueva_tarea = (data: any) => {
      agregarNotificacion({
        tipo: 'tarea',
        titulo: '📝 Tarea creada',
        mensaje: `Se ha creado una nueva tarea: ${data.titulo_tarea}`,
        link: '/roles/docente-movil/cursos',
        data
      });
    };
  }

  const getUserId = async () => {
    try {
      const userDataStr = await storage.getItem('user_data');
      if (userDataStr) {
        const userData = JSON.parse(userDataStr);
        return userData.id_usuario;
      }
    } catch (error) {
      console.error('Error obteniendo userId:', error);
    }
    return undefined;
  };

  const [userId, setUserId] = useState<number | undefined>();

  useEffect(() => {
    getUserId().then(setUserId);
  }, []);

  useSocket(events, userId);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return {
    notificaciones,
    noLeidas,
    marcarTodasLeidas,
    loading
  };
};
