import React, { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { User } from '../types';
import { authService } from '../services/auth';

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<User>;
    logout: () => void;
    isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const isProd = import.meta.env.PROD;

    useEffect(() => {
        const initAuth = async () => {
            const storedToken = localStorage.getItem('token');
            if (storedToken || isProd) {
                try {
                    const userData = await authService.getMe();
                    setUser(userData);
                    setToken(storedToken);
                } catch {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setToken(null);
                    setUser(null);
                }
            }
            setLoading(false);
        };
        initAuth();
    }, [isProd]);

    const login = async (email: string, password: string) => {
        const response = await authService.login(email, password);
        if (!isProd && response.token) {
            localStorage.setItem('token', response.token);
            setToken(response.token);
        } else {
            localStorage.removeItem('token');
            setToken(null);
        }
        localStorage.setItem('user', JSON.stringify(response.user));
        setUser(response.user);
        return response.user;
    };

    const logout = () => {
        void authService.logout();
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                token,
                loading,
                login,
                logout,
                isAuthenticated: isProd ? !!user : !!token && !!user,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};
