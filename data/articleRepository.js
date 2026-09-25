import { api } from './api.js';

export class ArticleRepository {
    async getAll() { return api('/api/articles'); }
    // Paged/filtered feed lookup: always returns { articles, hasMore }.
    async search({ search = '', category = '', status = '', sort = '', skip = 0, limit = 20 } = {}) {
        const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
        if (search) params.set('search', search);
        if (category) params.set('category', category);
        if (status) params.set('status', status);
        if (sort) params.set('sort', sort);
        return api('/api/articles?' + params.toString());
    }
    async getCategories() { return api('/api/categories'); }
    async getById(id) {
        try { return await api('/api/articles/' + encodeURIComponent(id)); }
        catch (error) { if (error.status === 404) return null; throw error; }
    }
    async getRelated(id, category, limit = 3) {
        const params = new URLSearchParams({ category, limit: String(limit) });
        return api('/api/articles/' + encodeURIComponent(id) + '/related?' + params.toString());
    }
    async getComments(id) { return api('/api/articles/' + encodeURIComponent(id) + '/comments'); }
    async addComment(id, fields) {
        return api('/api/articles/' + encodeURIComponent(id) + '/comments', { method: 'POST', body: fields });
    }
    async editComment(articleId, commentId, fields) {
        return api('/api/articles/' + encodeURIComponent(articleId) + '/comments/' + encodeURIComponent(commentId),
            { method: 'PUT', body: fields });
    }
    async deleteComment(articleId, commentId) {
        return api('/api/articles/' + encodeURIComponent(articleId) + '/comments/' + encodeURIComponent(commentId),
            { method: 'DELETE', body: {} });
    }
    async recordView(id) {
        return api('/api/articles/' + encodeURIComponent(id) + '/views', { method: 'POST', body: {} });
    }
}
