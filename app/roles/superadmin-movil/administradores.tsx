import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { eventEmitter } from '../../../services/eventEmitter';

interface Admin {
  id: number;
  nombre: string;
  firstName?: string;
  lastName?: string;
  cedula?: string;
  email: string;
  telefono?: string;
  fecha_nacimiento?: string;
  direccion?: string;
  genero?: string;
  estado: 'activo' | 'inactivo';
  permisos: string[];
  rol: string;
  rolId?: number;
}

interface Role {
  id_rol: number;
  nombre_rol: string;
  descripcion?: string;
}

const permisosDisponibles = [
  { id: 'usuarios', nombre: 'Gestión de Usuarios', icon: 'people-outline' },
  { id: 'cursos', nombre: 'Gestión de Cursos', icon: 'school-outline' },
  { id: 'reportes', nombre: 'Reportes y Estadísticas', icon: 'bar-chart-outline' },
  { id: 'configuracion', nombre: 'Configuración del Sistema', icon: 'settings-outline' },
  { id: 'pagos', nombre: 'Gestión de Pagos', icon: 'card-outline' },
  { id: 'inventario', nombre: 'Control de Inventario', icon: 'cube-outline' },
];

export default function AdministradoresScreen() {
  const insets = useSafeAreaInsets();
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [administradores, setAdministradores] = useState<Admin[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  
  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  
  // Formularios
  const [formData, setFormData] = useState({
    cedula: '',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    fecha_nacimiento: '',
    direccion: '',
    genero: '',
    password: '',
    confirmPassword: '',
    rolId: '',
    permisos: [] as string[],
  });
  
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const theme = darkMode
    ? {
        bg: '#0a0a0a',
        cardBg: 'rgba(18, 18, 18, 0.95)',
        text: '#fff',
        textSecondary: 'rgba(255, 255, 255, 0.7)',
        textMuted: 'rgba(255, 255, 255, 0.5)',
        border: 'rgba(239, 68, 68, 0.2)',
        accent: '#ef4444',
        inputBg: 'rgba(255, 255, 255, 0.06)',
        inputBorder: 'rgba(255, 255, 255, 0.12)',
      }
    : {
        bg: '#f8fafc',
        cardBg: 'rgba(255, 255, 255, 0.95)',
        text: '#1e293b',
        textSecondary: 'rgba(30, 41, 59, 0.7)',
        textMuted: 'rgba(30, 41, 59, 0.5)',
        border: 'rgba(239, 68, 68, 0.2)',
        accent: '#ef4444',
        inputBg: 'rgba(0, 0, 0, 0.05)',
        inputBorder: 'rgba(0, 0, 0, 0.15)',
      };

  // Sincronizar modo oscuro
  useEffect(() => {
    const loadDarkMode = async () => {
      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) {
        setDarkMode(savedMode === 'true');
      }
    };
    
    loadDarkMode();
    
    // Escuchar cambios de modo oscuro
    const handleDarkModeChange = (value: boolean) => {
      setDarkMode(value);
    };
    
    eventEmitter.on('darkModeChanged', handleDarkModeChange);
    
    return () => {
      eventEmitter.off('darkModeChanged', handleDarkModeChange);
    };
  }, []);

  const loadData = async () => {
    try {
      const token = await storage.getItem('auth_token');
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };

      // Cargar roles
      const rolesRes = await fetch(`${API_URL}/roles`, { headers });
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(Array.isArray(rolesData) ? rolesData : []);
      }

      // Cargar admins
      const adminsRes = await fetch(`${API_URL}/admins`, { headers });
      if (adminsRes.ok) {
        const data = await adminsRes.json();
        if (Array.isArray(data)) {
          const mapped: Admin[] = data.map((d: any) => ({
            id: d.id || d.id_usuario || 0,
            nombre: d.nombre
              ? `${d.nombre}${d.apellido ? ' ' + d.apellido : ''}`
              : d.nombre_completo || 'Sin nombre',
            firstName: d.nombre || '',
            lastName: d.apellido || '',
            cedula: d.cedula || '',
            email: d.email || '',
            telefono: d.telefono || '',
            fecha_nacimiento: d.fecha_nacimiento || '',
            direccion: d.direccion || '',
            genero: d.genero || '',
            estado:
              d.estado === 'activo' || d.estado === 'inactivo' ? d.estado : 'activo',
            permisos: Array.isArray(d.permisos) ? d.permisos : [],
            rol: d.rol?.nombre || d.nombre_rol || d.rol || 'Administrador',
            rolId: d.rol?.id_rol || d.id_rol || undefined,
          }));
          setAdministradores(mapped);
        }
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    init();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Validación de cédula ecuatoriana
  const validateCedulaEC = (ced: string): { ok: boolean; reason?: string } => {
    if (!/^\d{10}$/.test(ced))
      return { ok: false, reason: 'La cédula debe tener 10 dígitos' };
    const prov = parseInt(ced.slice(0, 2), 10);
    if (prov < 1 || prov > 24)
      return { ok: false, reason: 'Código de provincia inválido' };
    const digits = ced.split('').map((n) => parseInt(n, 10));
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let val = digits[i];
      if ((i + 1) % 2 !== 0) {
        val = val * 2;
        if (val > 9) val -= 9;
      }
      sum += val;
    }
    const nextTen = Math.ceil(sum / 10) * 10;
    const verifier = (nextTen - sum) % 10;
    if (verifier !== digits[9]) return { ok: false, reason: 'Cédula incorrecta' };
    return { ok: true };
  };

  const handleCreate = async () => {
    try {
      // Validaciones
      if (
        !formData.cedula ||
        !formData.nombre ||
        !formData.apellido ||
        !formData.email ||
        !formData.password
      ) {
        Alert.alert('Error', 'Por favor completa los campos obligatorios');
        return;
      }

      const cedRes = validateCedulaEC(formData.cedula);
      if (!cedRes.ok) {
        Alert.alert('Error', cedRes.reason || 'Cédula inválida');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        Alert.alert('Error', 'Las contraseñas no coinciden');
        return;
      }

      if (formData.password.length < 6) {
        Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
        return;
      }

      const token = await storage.getItem('auth_token');
      const fd = new FormData();
      
      Object.entries(formData).forEach(([key, value]) => {
        if (key !== 'confirmPassword' && key !== 'permisos' && value) {
          fd.append(key, value as string);
        }
      });

      formData.permisos.forEach((p) => fd.append('permisos[]', p));

      const roleName =
        roles.find((r) => r.id_rol === Number(formData.rolId))?.nombre_rol ||
        'administrativo';
      fd.append('roleName', roleName);

      const res = await fetch(`${API_URL}/admins`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });

      if (!res.ok) throw new Error(await res.text());

      Alert.alert('Éxito', 'Administrador creado exitosamente');
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al crear administrador');
    }
  };

  const handleUpdate = async () => {
    try {
      if (!selectedAdmin) return;
      const token = await storage.getItem('auth_token');

      const roleName =
        roles.find((r) => r.id_rol === Number(formData.rolId))?.nombre_rol ||
        'administrativo';

      const payload = {
        nombre: formData.nombre,
        apellido: formData.apellido,
        email: formData.email,
        telefono: formData.telefono,
        fecha_nacimiento: formData.fecha_nacimiento,
        direccion: formData.direccion,
        genero: formData.genero,
        rolId: formData.rolId ? Number(formData.rolId) : undefined,
        roleName: roleName,
        permisos: formData.permisos,
      };

      const res = await fetch(`${API_URL}/admins/${selectedAdmin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      Alert.alert('Éxito', 'Administrador actualizado exitosamente');
      setShowEditModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al actualizar');
    }
  };

  const handleChangePassword = async () => {
    try {
      if (!selectedAdmin) return;
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        Alert.alert('Error', 'Las contraseñas no coinciden');
        return;
      }
      if (passwordData.newPassword.length < 6) {
        Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
        return;
      }

      const token = await storage.getItem('auth_token');
      const res = await fetch(`${API_URL}/admins/${selectedAdmin.id}/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: passwordData.newPassword }),
      });

      if (!res.ok) throw new Error(await res.text());

      Alert.alert('Éxito', 'Contraseña actualizada exitosamente');
      setShowPasswordModal(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al cambiar contraseña');
    }
  };

  const toggleStatus = async (admin: Admin) => {
    try {
      const newStatus = admin.estado === 'activo' ? 'inactivo' : 'activo';
      const token = await storage.getItem('auth_token');

      const res = await fetch(`${API_URL}/admins/${admin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ estado: newStatus }),
      });

      if (!res.ok) throw new Error('Error actualizando estado');

      setAdministradores((prev) =>
        prev.map((a) => (a.id === admin.id ? { ...a, estado: newStatus } : a))
      );

      Alert.alert(
        'Éxito',
        `Administrador ${newStatus === 'activo' ? 'activado' : 'desactivado'}`
      );
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar el estado');
    }
  };

  const resetForm = () => {
    setFormData({
      cedula: '',
      nombre: '',
      apellido: '',
      email: '',
      telefono: '',
      fecha_nacimiento: '',
      direccion: '',
      genero: '',
      password: '',
      confirmPassword: '',
      rolId: '',
      permisos: [],
    });
  };

  const filteredAdmins = administradores.filter((admin) => {
    const matchesSearch =
      admin.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.cedula?.includes(searchTerm);
    const matchesFilter = filterStatus === 'todos' || admin.estado === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {/* Búsqueda y filtros */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
            <Ionicons name="search" size={20} color={theme.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Buscar por nombre, email o cédula..."
              placeholderTextColor={theme.textMuted}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          <View style={styles.filterRow}>
            {['todos', 'activo', 'inactivo'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      filterStatus === status ? theme.accent : theme.inputBg,
                    borderColor: filterStatus === status ? theme.accent : theme.inputBorder,
                  },
                ]}
                onPress={() => setFilterStatus(status)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color: filterStatus === status ? '#fff' : theme.text,
                    },
                  ]}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Lista de administradores */}
        <View style={styles.listContainer}>
          {filteredAdmins.map((admin) => (
            <View
              key={admin.id}
              style={[
                styles.adminCard,
                { backgroundColor: theme.cardBg, borderColor: theme.border },
              ]}
            >
              <View style={styles.adminHeader}>
                <View style={styles.adminInfo}>
                  <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
                    <Text style={styles.avatarText}>
                      {admin.firstName && admin.lastName
                        ? `${admin.firstName.charAt(0)}${admin.lastName.charAt(0)}`
                        : admin.nombre.substring(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.adminDetails}>
                    <Text style={[styles.adminName, { color: theme.text }]}>
                      {admin.nombre}
                    </Text>
                    <Text style={[styles.adminEmail, { color: theme.textSecondary }]}>
                      {admin.email}
                    </Text>
                    <Text style={[styles.adminCedula, { color: theme.textMuted }]}>
                      CI: {admin.cedula || 'N/A'}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        admin.estado === 'activo'
                          ? 'rgba(16, 185, 129, 0.1)'
                          : 'rgba(239, 68, 68, 0.1)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: admin.estado === 'activo' ? '#10b981' : '#ef4444' },
                    ]}
                  >
                    {admin.estado.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={[styles.actionButton, { borderColor: theme.border }]}
                  onPress={() => {
                    setSelectedAdmin(admin);
                    setFormData({
                      cedula: admin.cedula || '',
                      nombre: admin.firstName || '',
                      apellido: admin.lastName || '',
                      email: admin.email,
                      telefono: admin.telefono || '',
                      fecha_nacimiento: admin.fecha_nacimiento
                        ? new Date(admin.fecha_nacimiento).toISOString().split('T')[0]
                        : '',
                      direccion: admin.direccion || '',
                      genero: admin.genero || '',
                      password: '',
                      confirmPassword: '',
                      rolId: admin.rolId ? String(admin.rolId) : '',
                      permisos: admin.permisos || [],
                    });
                    setShowEditModal(true);
                  }}
                >
                  <Ionicons name="create-outline" size={20} color={theme.text} />
                  <Text style={[styles.actionButtonText, { color: theme.text }]}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, { borderColor: theme.border }]}
                  onPress={() => {
                    setSelectedAdmin(admin);
                    setShowPasswordModal(true);
                  }}
                >
                  <Ionicons name="key-outline" size={20} color={theme.text} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    {
                      backgroundColor:
                        admin.estado === 'activo'
                          ? 'rgba(239, 68, 68, 0.1)'
                          : 'rgba(16, 185, 129, 0.1)',
                      borderColor: 'transparent',
                    },
                  ]}
                  onPress={() => toggleStatus(admin)}
                >
                  <Ionicons
                    name={admin.estado === 'activo' ? 'ban-outline' : 'checkmark-circle-outline'}
                    size={20}
                    color={admin.estado === 'activo' ? '#ef4444' : '#10b981'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Botón flotante para crear */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.accent }]}
        onPress={() => {
          resetForm();
          setShowCreateModal(true);
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modal Crear Administrador */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons name="person-add" size={24} color={theme.accent} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>Nuevo Administrador</Text>
            </View>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Cédula */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Cédula *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                placeholder="1234567890"
                placeholderTextColor={theme.textMuted}
                value={formData.cedula}
                onChangeText={(text) => setFormData({ ...formData, cedula: text.replace(/\D/g, '').slice(0, 10) })}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            {/* Rol */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Rol *</Text>
              <View style={[styles.pickerContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                <Ionicons name="briefcase-outline" size={20} color={theme.textMuted} style={styles.pickerIcon} />
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => {
                    const roleOptions = roles
                      .filter((r) => r.nombre_rol.toLowerCase() === 'administrativo')
                      .map((r) => ({
                        text: r.nombre_rol,
                        onPress: () => setFormData({ ...formData, rolId: String(r.id_rol) }),
                      }));
                    Alert.alert('Seleccionar Rol', '', [
                      ...roleOptions,
                      { text: 'Cancelar' }
                    ]);
                  }}
                >
                  <Text style={[styles.pickerText, { color: formData.rolId ? theme.text : theme.textMuted }]}>
                    {formData.rolId
                      ? roles.find((r) => r.id_rol === Number(formData.rolId))?.nombre_rol
                      : 'Seleccionar rol'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Nombres */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Nombres *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                placeholder="JUAN CARLOS"
                placeholderTextColor={theme.textMuted}
                value={formData.nombre}
                onChangeText={(text) => setFormData({ ...formData, nombre: text.toUpperCase() })}
                autoCapitalize="characters"
              />
            </View>

            {/* Apellidos */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Apellidos *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                placeholder="PÉREZ GARCÍA"
                placeholderTextColor={theme.textMuted}
                value={formData.apellido}
                onChangeText={(text) => setFormData({ ...formData, apellido: text.toUpperCase() })}
                autoCapitalize="characters"
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Email *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                placeholder="admin@ejemplo.com"
                placeholderTextColor={theme.textMuted}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text.toLowerCase() })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Teléfono */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Teléfono</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                placeholder="0987654321"
                placeholderTextColor={theme.textMuted}
                value={formData.telefono}
                onChangeText={(text) => setFormData({ ...formData, telefono: text.replace(/\D/g, '') })}
                keyboardType="phone-pad"
              />
            </View>

            {/* Fecha de Nacimiento */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Fecha de Nacimiento</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={theme.textMuted}
                value={formData.fecha_nacimiento}
                onChangeText={(text) => setFormData({ ...formData, fecha_nacimiento: text })}
              />
            </View>

            {/* Género */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Género</Text>
              <View style={[styles.pickerContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                <Ionicons name="person-outline" size={20} color={theme.textMuted} style={styles.pickerIcon} />
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => {
                    Alert.alert(
                      'Seleccionar Género',
                      '',
                      [
                        { text: 'Masculino', onPress: () => setFormData({ ...formData, genero: 'masculino' }) },
                        { text: 'Femenino', onPress: () => setFormData({ ...formData, genero: 'femenino' }) },
                        { text: 'Otro', onPress: () => setFormData({ ...formData, genero: 'otro' }) },
                        { text: 'Cancelar', style: 'cancel' },
                      ]
                    );
                  }}
                >
                  <Text style={[styles.pickerText, { color: formData.genero ? theme.text : theme.textMuted }]}>
                    {formData.genero ? formData.genero.charAt(0).toUpperCase() + formData.genero.slice(1) : 'Seleccionar'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Dirección */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Dirección</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                placeholder="AV. PRINCIPAL Y CALLE SECUNDARIA"
                placeholderTextColor={theme.textMuted}
                value={formData.direccion}
                onChangeText={(text) => setFormData({ ...formData, direccion: text.toUpperCase() })}
                autoCapitalize="characters"
                multiline
              />
            </View>

            {/* Contraseña */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Contraseña *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text, flex: 1 }]}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={theme.textMuted}
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirmar Contraseña */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Confirmar Contraseña *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text, flex: 1 }]}
                  placeholder="Repetir contraseña"
                  placeholderTextColor={theme.textMuted}
                  value={formData.confirmPassword}
                  onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Permisos */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Permisos del Sistema</Text>
              <View style={styles.permisosGrid}>
                {permisosDisponibles.map((permiso) => {
                  const isSelected = formData.permisos.includes(permiso.id);
                  return (
                    <TouchableOpacity
                      key={permiso.id}
                      style={[
                        styles.permisoCard,
                        {
                          backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.1)' : theme.inputBg,
                          borderColor: isSelected ? theme.accent : theme.inputBorder,
                        },
                      ]}
                      onPress={() => {
                        const newPermisos = isSelected
                          ? formData.permisos.filter((p) => p !== permiso.id)
                          : [...formData.permisos, permiso.id];
                        setFormData({ ...formData, permisos: newPermisos });
                      }}
                    >
                      <Ionicons
                        name={permiso.icon as any}
                        size={20}
                        color={isSelected ? theme.accent : theme.textMuted}
                      />
                      <Text
                        style={[
                          styles.permisoText,
                          { color: isSelected ? theme.accent : theme.text },
                        ]}
                      >
                        {permiso.nombre}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: theme.border, paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.inputBg }]}
              onPress={() => setShowCreateModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.accent }]}
              onPress={handleCreate}
            >
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Crear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Editar Administrador */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons name="create" size={24} color={theme.accent} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>Editar Administrador</Text>
            </View>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Cédula (solo lectura) */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Cédula</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textMuted }]}
                value={formData.cedula}
                editable={false}
              />
            </View>

            {/* Rol */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Rol</Text>
              <View style={[styles.pickerContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                <Ionicons name="briefcase-outline" size={20} color={theme.textMuted} style={styles.pickerIcon} />
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => {
                    Alert.alert(
                      'Seleccionar Rol',
                      '',
                      roles
                        .filter((r) => r.nombre_rol.toLowerCase() === 'administrativo')
                        .map((r) => ({
                          text: r.nombre_rol,
                          onPress: () => setFormData({ ...formData, rolId: String(r.id_rol) }),
                        }))
                        .concat([{ text: 'Cancelar', style: 'cancel' }])
                    );
                  }}
                >
                  <Text style={[styles.pickerText, { color: formData.rolId ? theme.text : theme.textMuted }]}>
                    {formData.rolId
                      ? roles.find((r) => r.id_rol === Number(formData.rolId))?.nombre_rol
                      : 'Sin cambio'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Nombres */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Nombres</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={formData.nombre}
                onChangeText={(text) => setFormData({ ...formData, nombre: text.toUpperCase() })}
                autoCapitalize="characters"
              />
            </View>

            {/* Apellidos */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Apellidos</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={formData.apellido}
                onChangeText={(text) => setFormData({ ...formData, apellido: text.toUpperCase() })}
                autoCapitalize="characters"
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text.toLowerCase() })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Teléfono */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Teléfono</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={formData.telefono}
                onChangeText={(text) => setFormData({ ...formData, telefono: text.replace(/\D/g, '') })}
                keyboardType="phone-pad"
              />
            </View>

            {/* Fecha de Nacimiento */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Fecha de Nacimiento</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={formData.fecha_nacimiento}
                onChangeText={(text) => setFormData({ ...formData, fecha_nacimiento: text })}
              />
            </View>

            {/* Género */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Género</Text>
              <View style={[styles.pickerContainer, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                <Ionicons name="person-outline" size={20} color={theme.textMuted} style={styles.pickerIcon} />
                <TouchableOpacity
                  style={styles.pickerButton}
                  onPress={() => {
                    Alert.alert(
                      'Seleccionar Género',
                      '',
                      [
                        { text: 'Masculino', onPress: () => setFormData({ ...formData, genero: 'masculino' }) },
                        { text: 'Femenino', onPress: () => setFormData({ ...formData, genero: 'femenino' }) },
                        { text: 'Otro', onPress: () => setFormData({ ...formData, genero: 'otro' }) },
                        { text: 'Cancelar', style: 'cancel' },
                      ]
                    );
                  }}
                >
                  <Text style={[styles.pickerText, { color: formData.genero ? theme.text : theme.textMuted }]}>
                    {formData.genero ? formData.genero.charAt(0).toUpperCase() + formData.genero.slice(1) : 'Seleccionar'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Dirección */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Dirección</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={formData.direccion}
                onChangeText={(text) => setFormData({ ...formData, direccion: text.toUpperCase() })}
                autoCapitalize="characters"
                multiline
              />
            </View>

            {/* Permisos */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Permisos del Sistema</Text>
              <View style={styles.permisosGrid}>
                {permisosDisponibles.map((permiso) => {
                  const isSelected = formData.permisos.includes(permiso.id);
                  return (
                    <TouchableOpacity
                      key={permiso.id}
                      style={[
                        styles.permisoCard,
                        {
                          backgroundColor: isSelected ? 'rgba(239, 68, 68, 0.1)' : theme.inputBg,
                          borderColor: isSelected ? theme.accent : theme.inputBorder,
                        },
                      ]}
                      onPress={() => {
                        const newPermisos = isSelected
                          ? formData.permisos.filter((p) => p !== permiso.id)
                          : [...formData.permisos, permiso.id];
                        setFormData({ ...formData, permisos: newPermisos });
                      }}
                    >
                      <Ionicons
                        name={permiso.icon as any}
                        size={20}
                        color={isSelected ? theme.accent : theme.textMuted}
                      />
                      <Text
                        style={[
                          styles.permisoText,
                          { color: isSelected ? theme.accent : theme.text },
                        ]}
                      >
                        {permiso.nombre}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: theme.border, paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.inputBg }]}
              onPress={() => setShowEditModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.accent }]}
              onPress={handleUpdate}
            >
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Cambiar Contraseña */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View style={styles.modalHeaderLeft}>
              <Ionicons name="key" size={24} color={theme.accent} />
              <Text style={[styles.modalTitle, { color: theme.text }]}>Cambiar Contraseña</Text>
            </View>
            <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Nueva Contraseña</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text, flex: 1 }]}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor={theme.textMuted}
                  value={passwordData.newPassword}
                  onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Confirmar Contraseña</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text, flex: 1 }]}
                  placeholder="Repetir contraseña"
                  placeholderTextColor={theme.textMuted}
                  value={passwordData.confirmPassword}
                  onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color={theme.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: theme.border, paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { backgroundColor: theme.inputBg }]}
              onPress={() => setShowPasswordModal(false)}
            >
              <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton, { backgroundColor: theme.accent }]}
              onPress={handleChangePassword}
            >
              <Ionicons name="save-outline" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Actualizar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    padding: 16,
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  adminCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  adminHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  adminInfo: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  adminDetails: {
    flex: 1,
  },
  adminName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  adminEmail: {
    fontSize: 13,
    marginBottom: 2,
  },
  adminCedula: {
    fontSize: 12,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  adminActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  // Estilos de Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    elevation: 4,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  pickerIcon: {
    marginRight: 8,
  },
  pickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  pickerText: {
    fontSize: 15,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 8,
  },
  permisosGrid: {
    gap: 12,
  },
  permisoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  permisoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
});
