import { api } from './api.js';

export class ManagementRepository {
    getAll() { return api('/api/management/articles'); }
    // Paged/filtered management listing: always returns { articles, hasMore }.
    search({ search = '', category = '', status = '', sort = '', skip = 0, limit = 20 } = {}) {
        const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
        if (search) params.set('search', search);
        if (category) params.set('category', category);
        if (status) params.set('status', status);
        if (sort) params.set('sort', sort);
        return api('/api/management/articles?' + params.toString());
    }
    getCategories() { return api('/api/categories'); }
    async getOne(id) {
        try { return await api('/api/management/articles/' + encodeURIComponent(id)); }
        catch (error) { if (error.status === 404) return null; throw error; }
    }
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
    deleteArticle(id) {
        return api('/api/management/articles/' + encodeURIComponent(id), { method: 'DELETE', body: {} });
    }
    // The publicly published version of an article, used to compare it against a pending edit under review.
    getPublished(id) {
        return api('/api/articles/' + encodeURIComponent(id));
    }
    getStatistics() { return api('/api/statistics'); }
}
