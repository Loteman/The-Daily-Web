import { api } from './api.js';

export class UserRepository {
    list(search = '') {
        return api('/api/users' + (search ? '?search=' + encodeURIComponent(search) : ''));
    }
    create(fields) {
        return api('/api/users', { method: 'POST', body: fields });
    }
    update(idNumber, fields) {
        return api('/api/users/' + encodeURIComponent(idNumber), { method: 'PUT', body: fields });
    }
    remove(idNumber) {
        return api('/api/users/' + encodeURIComponent(idNumber), { method: 'DELETE', body: {} });
    }
}
