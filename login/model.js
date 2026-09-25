import { api } from '../data/api.js';

export class LoginModel {
    async validateCredentials(username, password) {
        try {
            const result = await api('/api/auth/login', { method: 'POST', body: { username, password } });
            return { success: true, ...result.user };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}
