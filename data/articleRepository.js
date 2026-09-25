import { api } from './api.js';

export class ArticleRepository {
    async getAll() { return api('/api/articles'); }
    async getCategories() { return api('/api/categories'); }
    async getById(id) {
        try { return await api('/api/articles/' + encodeURIComponent(id)); }
        catch (error) { if (error.status === 404) return null; throw error; }
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
