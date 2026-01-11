import { Stack } from 'expo-router';

export default function RolesLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="admin-movil" />
            <Stack.Screen name="docente-movil" />
            <Stack.Screen name="estudiante-movil" />
            <Stack.Screen name="superadmin-movil" />
        </Stack>
    );
}
