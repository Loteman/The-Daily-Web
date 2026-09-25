import { ManagementRepository } from '../data/managementRepository.js';
import { currentUser } from '../data/api.js';

const statuses = {
    draft: ['בהכנה', 'badge-blue'], pending: ['ממתינה לאישור', 'badge-orange'],
    published: ['פורסמה', 'badge-green'], returned: ['הוחזרה לתיקונים', 'badge-red']
};
export class ArticlesManagementModel {
    constructor(repository = new ManagementRepository()) {
        this.repository = repository;
        this.revisions = new Map();
    }
    async initialize() {
        const user = await currentUser();
        this.username = user?.username;
        this.fullName = user?.fullName;
        this.role = user?.role;
        this.categories = user ? await this.repository.getCategories() : [];
        return this.canAccess();
    }
    canAccess() { return Boolean(this.username) && ['reporter', 'editor'].includes(this.role); }
    async getUserProfile() { return { name: this.fullName || this.username, role: this.role === 'editor' ? 'עורך' : 'כתב' }; }
    async getFilterOptions() {
        return { categories: ['כל הקטגוריות', ...this.categories.map(item => item.name)],
            statuses: ['כל הסטטוסים', ...Object.values(statuses).map(item => item[0])] };
    }
    remember(article) {
        this.revisions.set(article.id, { updateId: article.updateId, updatedAt: article.updatedAt });
        return article;
    }
    async getArticles() {
        const articles = await this.repository.getAll();
        return articles.map(article => {
            // Do not replace an open editor's revision token during background list refreshes.
            if (!this.revisions.has(article.id)) this.remember(article);
            return { ...article, subtitle: article.summary,
                statusText: statuses[article.status]?.[0] || article.status,
                badgeClass: statuses[article.status]?.[1] || 'badge-blue',
                actions: this.getActions(article) };
        });
    }
    getActions(article) {
        if (this.role === 'reporter' && ['draft', 'returned'].includes(article.status))
            return [{ type: 'edit', label: 'עריכה' }, { type: 'send', label: 'שליחה לאישור' }];
        if (this.role === 'reporter' && article.status === 'published')
            return [{ type: 'view', label: 'צפייה' }, { type: 'revise', label: 'גרסה חדשה' }];
        if (this.role === 'editor' && article.status === 'pending') return [{ type: 'review', label: 'בדיקה' }];
        return [{ type: article.status === 'published' ? 'view' : 'preview', label: 'צפייה' }];
    }
    async getArticle(id) {
        const article = (await this.getArticles()).find(item => item.id === id);
        if (!article) throw new Error('הכתבה לא נמצאה או שאין לך הרשאה.');
        return this.remember(article);
    }
    async saveDraft(id, fields) {
        return this.remember(await this.repository.saveDraft(id, {
            title: fields.title, summary: fields.summary, categoryId: fields.categoryId,
            mainImage: fields.mainImage, content: fields.content,
            ...(id ? this.revisions.get(id) : {})
        }));
    }
    async changeStatus(id, status, note = '') {
        return this.remember(await this.repository.changeStatus(id, {
            status, editorNote: note, ...this.revisions.get(id)
        }));
    }
    async startRevision(id) {
        return this.remember(await this.repository.startRevision(id, this.revisions.get(id)));
    }
    async calculateStats() {
        const stats = { draft: 0, pending: 0, published: 0, returned: 0 };
        (await this.getArticles()).forEach(article => { if (article.status in stats) stats[article.status]++; });
        return stats;
    }
    getStatistics() { return this.repository.getStatistics(); }
}
