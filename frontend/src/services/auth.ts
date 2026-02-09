import api from './api';
import type { User, LoginResponse } from '../types';
import { isMockMode, mockAuthService } from '../mock';

export const authService = {
    async login(email: string, password: string): Promise<LoginResponse> {
        if (isMockMode()) {
            return mockAuthService.login(email, password);
        }
        const response = await api.post<LoginResponse>('/auth/login', { email, password });
        return response.data;
    },

    async getMe(): Promise<User> {
        if (isMockMode()) {
            return mockAuthService.getMe();
        }
        const response = await api.get<User>('/auth/me');
        return response.data;
    },

    logout() {
        if (isMockMode()) {
            mockAuthService.logout();
            return;
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    },
};

