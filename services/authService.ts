import { ENDPOINTS } from '../constants/config';

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface LoginResponse {
    success: boolean;
    token?: string;
    usuario?: {
        id: number;
        nombre: string;
        email: string;
        rol: string;
    };
    message?: string;
}

export const authService = {
    /**
     * Login user with email and password
     */
    async login(credentials: LoginCredentials): Promise<LoginResponse> {
        try {
            const response = await fetch(ENDPOINTS.LOGIN, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials),
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    message: data.message || 'Error al iniciar sesión',
                };
            }

            return {
                success: true,
                token: data.token,
                usuario: data.usuario,
            };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'Error de conexión. Verifica tu internet.',
            };
        }
    },
};
