// Simple authentication service
// In production, integrate with AWS Cognito

export interface LoginCredentials {
    email: string;
    password: string;
}

export const authService = {
    login: async (credentials: LoginCredentials): Promise<string> => {
        // TODO: Integrate with AWS Cognito
        // For now, return a mock token
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (credentials.email && credentials.password) {
                    const mockToken = 'mock-jwt-token-' + Date.now();
                    localStorage.setItem('jwt_token', mockToken);
                    localStorage.setItem('user_email', credentials.email);
                    resolve(mockToken);
                } else {
                    reject(new Error('Invalid credentials'));
                }
            }, 500);
        });
    },

    logout: () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('user_email');
    },

    isAuthenticated: (): boolean => {
        return !!localStorage.getItem('jwt_token');
    },

    getToken: (): string | null => {
        return localStorage.getItem('jwt_token');
    },

    getUserEmail: (): string | null => {
        return localStorage.getItem('user_email');
    },
};
