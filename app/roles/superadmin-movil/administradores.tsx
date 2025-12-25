import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import CompactPicker from './components/CompactPicker';
import Pagination from './components/Pagination';
import { API_URL } from '../../../constants/config';
import { getToken, getDarkMode } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

const { width } = Dimensions.get('window');

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
  foto?: string;
  foto_perfil?: string;
  foto_perfil_url?: string;
}

interface Role {
  id_rol: number;
  nombre_rol: string;
  descripcion?: string;
}

const generateSecurePassword = () => {
  const length = 10;
  const charset = "0123456789";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
};

export default function AdministradoresScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Datos
  const [administradores, setAdministradores] = useState<Admin[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');

  // Paginación Cliente
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);

  // Date Picker
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  const theme = darkMode ? {
    bg: '#0f172a',
    cardBg: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    border: '#334155',
    primary: '#ef4444',
    inputBg: '#334155',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
    infoBg: 'rgba(59, 130, 246, 0.1)',
    infoBorder: 'rgba(59, 130, 246, 0.2)',
    infoText: '#bfdbfe',
  } : {
    bg: '#f8fafc',
    cardBg: '#ffffff',
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    border: '#e2e8f0',
    primary: '#ef4444',
    inputBg: '#ffffff',
    success: '#059669',
    danger: '#ef4444',
    warning: '#d97706',
    infoBg: '#eff6ff',
    infoBorder: '#bfdbfe',
    infoText: '#1e40af',
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    const themeHandler = (isDark: boolean) => setDarkMode(isDark);
    eventEmitter.on('themeChanged', themeHandler);
    getDarkMode().then(setDarkMode);
    return () => { eventEmitter.off('themeChanged', themeHandler); };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };

      const rolesRes = await fetch(`${API_URL}/roles`, { headers });
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(Array.isArray(rolesData) ? rolesData : []);
      }

      const adminsRes = await fetch(`${API_URL}/admins`, { headers });
      if (adminsRes.ok) {
        const data = await adminsRes.json();
        if (Array.isArray(data)) {
          const mapped: Admin[] = data.map((d: any) => ({
            id: d.id || d.id_usuario || 0,
            nombre: d.nombre ? `${d.nombre}${d.apellido ? ' ' + d.apellido : ''}` : (d.nombre_completo || 'Sin nombre'),
            firstName: d.nombre || '',
            lastName: d.apellido || '',
            cedula: d.cedula || '',
            email: d.email || '',
            telefono: d.telefono || '',
            fecha_nacimiento: d.fecha_nacimiento || '',
            direccion: d.direccion || '',
            genero: d.genero || '',
            estado: (d.estado === 'activo' || d.estado === 'inactivo') ? d.estado : 'activo',
            permisos: Array.isArray(d.permisos) ? d.permisos : [],
            rol: d.rol?.nombre || d.nombre_rol || d.rol || 'Administrador',
            rolId: d.rol?.id_rol || d.id_rol || undefined,
            foto: d.foto,
            foto_perfil: d.foto_perfil,
            foto_perfil_url: d.foto_perfil_url
          }));
          setAdministradores(mapped);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredAndPaginatedData = useMemo(() => {
    const filtered = administradores.filter(admin => {
      const matchesSearch =
        admin.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (admin.cedula && admin.cedula.includes(searchTerm));

      const matchesStatus = filterStatus === 'todos' || admin.estado === filterStatus;

      return matchesSearch && matchesStatus;
    });

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + itemsPerPage);

    return { items: paginatedItems, totalItems, totalPages };
  }, [administradores, searchTerm, filterStatus, page]);

  const validateCedulaEC = (ced: string): { ok: boolean; reason?: string } => {
    if (!/^\d{10}$/.test(ced)) return { ok: false, reason: 'La cédula debe tener 10 dígitos' };
    const prov = parseInt(ced.slice(0, 2), 10);
    if (prov < 1 || prov > 24) return { ok: false, reason: 'Código de provincia inválido' };
    return { ok: true };
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios'); // Keep open on iOS, close on Android
    if (selectedDate) {
      setFormData({ ...formData, fecha_nacimiento: selectedDate.toISOString().split('T')[0] });
      if (Platform.OS !== 'ios') setShowDatePicker(false);
    } else {
      setShowDatePicker(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.cedula || !formData.nombre || !formData.apellido || !formData.email || !formData.password) {
        Alert.alert('Error', 'Completa los campos obligatorios (*)');
        return;
      }

      const val = validateCedulaEC(formData.cedula);
      if (!val.ok) {
        Alert.alert('Error', val.reason || 'Cédula inválida');
        return;
      }

      const token = await getToken();
      const fd = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key !== 'confirmPassword' && key !== 'permisos' && value) {
          fd.append(key, value as string);
        }
      });
      formData.permisos.forEach(p => fd.append('permisos[]', p));

      const roleName = roles.find(r => r.id_rol === Number(formData.rolId))?.nombre_rol || 'administrativo';
      fd.append('roleName', roleName);

      const res = await fetch(`${API_URL}/admins`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });

      if (!res.ok) throw new Error(await res.text());

      Alert.alert('Éxito', 'Administrador creado. Se ha enviado la contraseña por correo.');
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al crear administrador');
    }
  };

  const handleUpdate = async () => {
    if (!selectedAdmin) return;
    try {
      const token = await getToken();
      const roleName = roles.find(r => r.id_rol === Number(formData.rolId))?.nombre_rol || 'administrativo';

      const payload = {
        nombre: formData.nombre,
        apellido: formData.apellido,
        email: formData.email,
        telefono: formData.telefono,
        fecha_nacimiento: formData.fecha_nacimiento,
        direccion: formData.direccion,
        genero: formData.genero,
        rolId: formData.rolId ? Number(formData.rolId) : undefined,
        roleName,
        permisos: formData.permisos
      };

      const res = await fetch(`${API_URL}/admins/${selectedAdmin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await res.text());

      Alert.alert('Éxito', 'Administrador actualizado');
      setShowEditModal(false);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleChangePassword = async () => {
    try {
      if (!selectedAdmin) return;

      const token = await getToken();
      const res = await fetch(`${API_URL}/admins/${selectedAdmin.id}/password`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          password: passwordData.newPassword,
          reset: true
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      Alert.alert('Éxito', 'Contraseña reseteada y notificada por correo exitosamente.');
      setShowPasswordModal(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al resetear contraseña');
    }
  };

  const toggleStatus = async (admin: Admin) => {
    try {
      const newStatus = admin.estado === 'activo' ? 'inactivo' : 'activo';
      const token = await getToken();
      const res = await fetch(`${API_URL}/admins/${admin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ estado: newStatus })
      });
      if (!res.ok) throw new Error('Error al actualizar estado');

      setAdministradores(prev => prev.map(a => a.id === admin.id ? { ...a, estado: newStatus } : a));
      Alert.alert('Éxito', `Administrador ${newStatus === 'activo' ? 'activado' : 'desactivado'}`);
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar el estado');
    }
  };

  const resetForm = () => {
    setFormData({
      cedula: '', nombre: '', apellido: '', email: '', telefono: '',
      fecha_nacimiento: '', direccion: '', genero: '',
      password: '', confirmPassword: '', rolId: '', permisos: []
    });
  };

  const renderAdminCard = ({ item }: { item: Admin }) => (
    <View style={[styles.adminCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarRow}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            {item.foto || item.foto_perfil || item.foto_perfil_url ? (
              <Image
                source={{ uri: item.foto || item.foto_perfil || item.foto_perfil_url }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
              />
            ) : (
              <Text style={styles.avatarText}>
                {item.firstName && item.lastName
                  ? (item.firstName[0] + item.lastName[0]).toUpperCase()
                  : item.nombre.substring(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.infoContainer}>
            <Text style={[styles.adminName, { color: theme.text }]}>{item.nombre}</Text>
            <Text style={[styles.adminEmail, { color: theme.textMuted }]}>{item.email}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, {
          backgroundColor: item.estado === 'activo' ? theme.success + '20' : theme.danger + '20'
        }]}>
          <Text style={{
            color: item.estado === 'activo' ? theme.success : theme.danger,
            fontSize: 11, fontWeight: '700'
          }}>
            {item.estado.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Cédula:</Text>
          <Text style={[styles.detailValue, { color: theme.text }]}>{item.cedula || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Teléfono:</Text>
          <Text style={[styles.detailValue, { color: theme.text }]}>{item.telefono || 'N/A'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={[styles.detailLabel, { color: theme.textMuted }]}>Rol:</Text>
          <Text style={[styles.detailValue, { color: theme.text }]}>{item.rol}</Text>
        </View>
      </View>

      <View style={[styles.cardActions, { borderColor: theme.border }]}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedAdmin(item);
            setFormData({
              cedula: item.cedula || '',
              nombre: item.firstName || '',
              apellido: item.lastName || '',
              email: item.email,
              telefono: item.telefono || '',
              fecha_nacimiento: item.fecha_nacimiento || '',
              direccion: item.direccion || '',
              genero: item.genero || '',
              password: '', confirmPassword: '',
              rolId: item.rolId ? String(item.rolId) : '',
              permisos: item.permisos || []
            });
            setShowEditModal(true);
          }}
        >
          <Ionicons name="create-outline" size={20} color={theme.text} />
          <Text style={[styles.actionText, { color: theme.text }]}>Editar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedAdmin(item);
            const newPass = generateSecurePassword();
            setPasswordData({ newPassword: newPass, confirmPassword: newPass });
            setShowPasswordModal(true);
          }}
        >
          <Ionicons name="key-outline" size={20} color={theme.warning} />
          <Text style={[styles.actionText, { color: theme.warning }]}>Clave</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleStatus(item)}
        >
          <Ionicons
            name={item.estado === 'activo' ? 'ban-outline' : 'checkmark-circle-outline'}
            size={20}
            color={item.estado === 'activo' ? theme.danger : theme.success}
          />
          <Text style={[styles.actionText, { color: item.estado === 'activo' ? theme.danger : theme.success }]}>
            {item.estado === 'activo' ? 'Desactivar' : 'Activar'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <LinearGradient
        colors={darkMode ? ['#b91c1c', '#991b1b'] : ['#ef4444', '#dc2626']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Gestión de Administradores</Text>
        <Text style={styles.headerSubtitle}>Administra los usuarios con permisos administrativos</Text>
      </LinearGradient>

      <View style={styles.filtersSection}>
        <View style={[styles.searchContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
          <Ionicons name="search" size={20} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Buscar por nombre, cédula..."
            placeholderTextColor={theme.textMuted}
            value={searchTerm}
            onChangeText={(text) => { setSearchTerm(text); setPage(1); }}
          />
        </View>

        <View style={{ marginTop: 12 }}>
          <CompactPicker
            items={[
              { label: 'Todos los estados', value: 'todos' },
              { label: 'Activo', value: 'activo' },
              { label: 'Inactivo', value: 'inactivo' }
            ]}
            selectedValue={filterStatus}
            onValueChange={(val) => { setFilterStatus(val); setPage(1); }}
            theme={theme}
          />
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : filteredAndPaginatedData.totalItems === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>No se encontraron administradores</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={filteredAndPaginatedData.items}
            renderItem={renderAdminCard}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={theme.primary} />
            }
          />
          <Pagination
            currentPage={page}
            totalPages={filteredAndPaginatedData.totalPages}
            totalItems={filteredAndPaginatedData.totalItems}
            onPageChange={setPage}
            theme={theme}
            itemLabel="admins"
          />
        </>
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => {
          resetForm();
          const newPass = generateSecurePassword();
          setFormData(prev => ({ ...prev, password: newPass, confirmPassword: newPass }));
          setShowCreateModal(true);
        }}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showCreateModal || showEditModal} animationType="slide" onRequestClose={() => { setShowCreateModal(false); setShowEditModal(false); }}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {showCreateModal ? 'Nuevo Administrador' : 'Editar Administrador'}
            </Text>
            <TouchableOpacity onPress={() => { setShowCreateModal(false); setShowEditModal(false); }}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">

              {/* Cédula */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Cédula *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: showCreateModal ? theme.inputBg : theme.inputBg + '80', borderColor: theme.border, color: showCreateModal ? theme.text : theme.textMuted }]}
                  value={formData.cedula}
                  onChangeText={t => setFormData({ ...formData, cedula: t })}
                  keyboardType="numeric"
                  editable={showCreateModal}
                  placeholder="10 dígitos"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              {/* Nombres y Apellidos */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Nombres *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={formData.nombre}
                  onChangeText={t => setFormData({ ...formData, nombre: t.toUpperCase() })}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Apellidos *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={formData.apellido}
                  onChangeText={t => setFormData({ ...formData, apellido: t.toUpperCase() })}
                />
              </View>

              {/* Email y Teléfono */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Email *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={formData.email}
                  onChangeText={t => setFormData({ ...formData, email: t.toLowerCase() })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Teléfono</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
                  value={formData.telefono}
                  onChangeText={t => setFormData({ ...formData, telefono: t.replace(/\D/g, '') })}
                  keyboardType="phone-pad"
                />
              </View>

              {/* Fecha Nacimiento */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Fecha de Nacimiento</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={[styles.input, { justifyContent: 'center', backgroundColor: theme.inputBg, borderColor: theme.border }]}
                >
                  <Text style={{ color: formData.fecha_nacimiento ? theme.text : theme.textMuted, fontSize: 16 }}>
                    {formData.fecha_nacimiento || "Seleccionar fecha"}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={theme.textMuted} style={{ position: 'absolute', right: 16 }} />
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={formData.fecha_nacimiento ? new Date(formData.fecha_nacimiento) : new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={onDateChange}
                    themeVariant={darkMode ? 'dark' : 'light'}
                  />
                )}
              </View>

              {/* Género */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Género</Text>
                <CompactPicker
                  items={[
                    { label: 'Seleccionar', value: '' },
                    { label: 'Masculino', value: 'masculino' },
                    { label: 'Femenino', value: 'femenino' },
                    { label: 'Otro', value: 'otro' },
                  ]}
                  selectedValue={formData.genero}
                  onValueChange={(val) => setFormData({ ...formData, genero: val })}
                  theme={theme}
                  placeholder="Seleccionar Género"
                />
              </View>

              {/* Dirección */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Dirección</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text, height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                  value={formData.direccion}
                  onChangeText={t => setFormData({ ...formData, direccion: t.toUpperCase() })}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Password Section - Only for Create */}
              {showCreateModal && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.text }]}>Contraseña (Generada Automáticamente) *</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1, position: 'relative', justifyContent: 'center' }}>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text, paddingRight: 40 }]}
                        value={formData.password}
                        onChangeText={() => { }}
                        editable={false}
                        secureTextEntry={!showPassword}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: 10 }}
                      >
                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={{
                        height: 50, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1,
                        borderColor: theme.border, justifyContent: 'center', alignItems: 'center',
                        flexDirection: 'row', gap: 5, backgroundColor: theme.inputBg
                      }}
                      onPress={() => {
                        const newPass = generateSecurePassword();
                        setFormData(prev => ({ ...prev, password: newPass, confirmPassword: newPass }));
                      }}
                    >
                      <Ionicons name="refresh" size={18} color={theme.text} />
                      <Text style={{ color: theme.text, fontWeight: '600' }}>Regenerar</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{
                    marginTop: 10, padding: 12, borderRadius: 8,
                    backgroundColor: theme.infoBg, borderWidth: 1, borderColor: theme.infoBorder,
                    flexDirection: 'row', gap: 8
                  }}>
                    <Ionicons name="shield-checkmark-outline" size={20} color={theme.infoText} />
                    <Text style={{ flex: 1, fontSize: 12, color: theme.infoText }}>
                      Nota: La contraseña se enviará por correo y el usuario deberá cambiarla obligatoriamente al ingresar.
                    </Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={showCreateModal ? handleCreate : handleUpdate}
              >
                <Text style={styles.saveButtonText}>Guardar</Text>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Modal Password Reset */}
      <Modal visible={showPasswordModal} animationType="slide" onRequestClose={() => setShowPasswordModal(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.bg }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Resetear Contraseña</Text>
            <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
              <Ionicons name="close" size={28} color={theme.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.text }]}>Contraseña Temporal (Generada)</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1, position: 'relative', justifyContent: 'center' }}>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text, paddingRight: 40 }]}
                      value={passwordData.newPassword}
                      onChangeText={() => { }}
                      editable={false}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 10 }}
                    >
                      <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={theme.textMuted} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={{
                      height: 50, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1,
                      borderColor: theme.border, justifyContent: 'center', alignItems: 'center',
                      flexDirection: 'row', gap: 5, backgroundColor: theme.inputBg
                    }}
                    onPress={() => {
                      const newPass = generateSecurePassword();
                      setPasswordData({ newPassword: newPass, confirmPassword: newPass });
                    }}
                  >
                    <Ionicons name="refresh" size={18} color={theme.text} />
                    <Text style={{ color: theme.text, fontWeight: '600' }}>Regenerar</Text>
                  </TouchableOpacity>
                </View>
                <View style={{
                  marginTop: 10, padding: 12, borderRadius: 8,
                  backgroundColor: theme.infoBg, borderWidth: 1, borderColor: theme.infoBorder,
                  flexDirection: 'row', gap: 8
                }}>
                  <Ionicons name="information-circle-outline" size={20} color={theme.infoText} />
                  <Text style={{ flex: 1, fontSize: 12, color: theme.infoText }}>
                    Esta acción cambiará la contraseña actual y notificará al usuario por correo.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: theme.primary }]}
                onPress={handleChangePassword}
              >
                <Ionicons name="mail-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.saveButtonText}>Resetear y Notificar</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 25,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  filtersSection: { padding: 20 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, height: 48, gap: 8
  },
  searchInput: { flex: 1, fontSize: 14 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 14 },
  listContent: { padding: 20, paddingTop: 0 },
  adminCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  infoContainer: { flex: 1 },
  adminName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  adminEmail: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  cardDetails: { marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailLabel: { fontSize: 12 },
  detailValue: { fontSize: 12, fontWeight: '600' },
  cardActions: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 12, gap: 12 },
  actionButton: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', gap: 6 },
  actionText: { fontSize: 13, fontWeight: '600' },
  fab: {
    position: 'absolute', bottom: 20, right: 20, width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 6
  },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalContent: { padding: 20 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
  input: { height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  saveButton: { height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10, flexDirection: 'row', gap: 8 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});
