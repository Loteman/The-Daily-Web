import { ManagementRepository } from '../data/managementRepository.js';
import { currentUser } from '../data/api.js';

const statuses = {
    draft: ['בהכנה', 'badge-blue'], pending: ['ממתינה לאישור', 'badge-orange'],
    published: ['פורסמה', 'badge-green'], returned: ['הוחזרה לתיקונים', 'badge-red']
};

export class ArticlesManagementModel {
    constructor(repository = new ManagementRepository()) { this.repository = repository; this.revisions = new Map(); }
    async initialize() {
        const user = await currentUser();
        this.username = user?.username; this.fullName = user?.fullName; this.role = user?.role;
        this.categories = user ? await this.repository.getCategories() : [];
        return this.canAccess();
    }
    canAccess() { return Boolean(this.username) && ['reporter', 'editor'].includes(this.role); }
    async getUserProfile() { return { name: this.fullName || this.username, role: this.role === 'editor' ? 'עורך' : 'כתב' }; }
    getFilterOptions() {
        return { categories: ['כל הקטגוריות', ...this.categories.map(item => item.name)], statuses: ['כל הסטטוסים', ...Object.values(statuses).map(item => item[0])] };
    }
    // Reverse-maps a displayed status label ("בהכנה") back to its raw key ("draft") for the API query.
    statusKeyFromLabel(label) {
        return Object.entries(statuses).find(([, [text]]) => text === label)?.[0] || '';
    }
    remember(article) { this.revisions.set(article.id, { updateId: article.updateId, updatedAt: article.updatedAt }); return article; }
    decorate(article) {
        this.remember(article);
        return { ...article, subtitle: article.summary, statusText: statuses[article.status]?.[0] || article.status, badgeClass: statuses[article.status]?.[1] || 'badge-blue', actions: this.getActions(article) };
    }
    // Search/filter/sort/paging all run on the server now, so this scales with the article count
    // instead of downloading the whole table on every keystroke.
    async search(filters, skip, limit) {
        const result = await this.repository.search({
            search: filters.search, category: filters.category, status: this.statusKeyFromLabel(filters.status), skip, limit
        });
        return { articles: result.articles.map(article => this.decorate(article)), total: result.total };
    }
    getActions(article) {
        if (this.role === 'reporter' && ['draft', 'returned'].includes(article.status)) return [{ type: 'edit', label: 'עריכה' }, { type: 'send', label: 'שליחה לאישור' }];
        if (this.role === 'reporter' && article.status === 'published') return [{ type: 'view', label: 'צפייה' }, { type: 'revise', label: 'גרסה חדשה' }];
        if (this.role === 'editor' && article.status === 'pending') return [{ type: 'review', label: 'בדיקה' }, { type: 'delete', label: 'מחיקה' }];
        if (this.role === 'editor') return [{ type: article.status === 'published' ? 'view' : 'preview', label: 'צפייה' }, { type: 'delete', label: 'מחיקה' }];
        return [{ type: article.status === 'published' ? 'view' : 'preview', label: 'צפייה' }];
    }
    async getArticle(id) {
        const article = await this.repository.getOne(id);
        if (!article) throw new Error('הכתבה לא נמצאה או שאין לך הרשאה.');
        return this.decorate(article);
    }
    async saveDraft(id, fields) { return this.decorate(await this.repository.saveDraft(id, { title: fields.title, summary: fields.summary, categoryId: fields.categoryId, mainImage: fields.mainImage, content: fields.content, ...(id ? this.revisions.get(id) : {}) })); }
    async changeStatus(id, status, note = '') { return this.decorate(await this.repository.changeStatus(id, { status, editorNote: note, ...this.revisions.get(id) })); }
    async startRevision(id) { return this.decorate(await this.repository.startRevision(id, this.revisions.get(id))); }
    async deleteArticle(id) { await this.repository.deleteArticle(id); this.revisions.delete(id); }
    // The currently published version of the same article, for the "old vs. new" comparison while reviewing.
    getPublished(id) { return this.repository.getPublished(id); }
    // Backed by the aggregated /api/statistics endpoint - no need to fetch every article just to count them.
    async calculateStats() { return (await this.repository.getStatistics()).statuses; }
    getStatistics() { return this.repository.getStatistics(); }
}
