# Panel Super Admin - Móvil

Migración del panel de superadmin de React a React Native.

## Estructura

```
superadmin-movil/
├── _layout.tsx          # Layout principal con tabs y drawer
├── index.tsx            # Dashboard con métricas del sistema
├── administradores.tsx  # Gestión de administradores
├── auditoria.tsx        # Historial de auditoría
└── configuracion.tsx    # Configuración del sistema
```

## Navegación

### Bottom Tabs (Navegación inferior)
- **Dashboard**: Métricas del sistema y base de datos
- **Administradores**: Gestión de usuarios admin
- **Auditoría**: Historial de cambios
- **Configuración**: Ajustes del sistema

### Drawer Lateral Derecho
Accesible desde el icono de engranaje en el header:
- Perfil del usuario
- Modo oscuro/claro
- Cambiar contraseña
- Cerrar sesión

## Características

- ✅ Navegación con tabs en la parte inferior
- ✅ Drawer lateral derecho para perfil y configuración
- ✅ Modo oscuro/claro
- ✅ Dashboard con métricas del sistema
- ✅ Pull to refresh
- ✅ Diseño responsive
- ⏳ Gestión de administradores (próximamente)
- ⏳ Historial de auditoría (próximamente)
- ⏳ Configuración del sistema (próximamente)

## Diferencias con la versión web

1. **Navegación**: Tabs inferiores en lugar de sidebar lateral
2. **Perfil**: Drawer desde la derecha en lugar de menú desplegable
3. **Diseño**: Optimizado para pantallas táctiles
4. **Interacciones**: Pull to refresh en lugar de botones de recarga
