import { api } from './api.js';

export class ManagementRepository {
    getAll() { return api('/api/management/articles'); }
    getCategories() { return api('/api/categories'); }
    saveDraft(id, fields) {
        return api('/api/management/articles' + (id ? '/' + encodeURIComponent(id) : ''), {
            method: id ? 'PUT' : 'POST', body: fields
        });
    }
    changeStatus(id, fields) {
        return api('/api/management/articles/' + encodeURIComponent(id) + '/status', { method: 'PATCH', body: fields });
    }
    startRevision(id, fields) {
        return api('/api/management/articles/' + encodeURIComponent(id) + '/revisions', { method: 'POST', body: fields });
    }
    getStatistics() { return api('/api/statistics'); }
}
