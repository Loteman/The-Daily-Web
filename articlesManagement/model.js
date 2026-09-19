import { ManagementRepository } from '../data/managementRepository.js';

const statuses = {
    draft: ['בהכנה', 'badge-blue'],
    pending: ['ממתינה לאישור', 'badge-orange'],
    published: ['פורסמה', 'badge-green'],
    returned: ['הוחזרה לתיקונים', 'badge-red']
};

export class ArticlesManagementModel
{
    constructor(repository = new ManagementRepository())
    {
        this.repository = repository;
        this.username = sessionStorage.getItem('username');
        this.role = sessionStorage.getItem('role');
    }

    canAccess()
    {
        return Boolean(this.username) && ['creator', 'editor'].includes(this.role);
    }

    async getUserProfile()
    {
        return { name: this.username, role: this.role === 'editor' ? 'עורך' : 'יוצר תוכן' };
    }

    async getFilterOptions()
    {
        const articles = await this.getArticles();
        return {
            categories: ['כל הקטגוריות', ...new Set(articles.map(article => article.category).filter(Boolean))],
            statuses: ['כל הסטטוסים', ...Object.values(statuses).map(status => status[0])]
        };
    }

    async getArticles()
    {
        if (!this.canAccess())
            throw new Error('יש להתחבר עם משתמש יוצר או עורך.');

        const articles = await this.repository.getAll();
        return articles
            .filter(article => this.role === 'editor' || article.creator === this.username)
            .map(article => ({
                ...article,
                subtitle: article.summary,
                statusText: statuses[article.status][0],
                badgeClass: statuses[article.status][1],
                actions: this.getActions(article)
            }));
    }

    getActions(article)
    {
        if (this.role === 'creator' && ['draft', 'returned'].includes(article.status))
            return [{ type: 'edit', label: 'עריכה' }, { type: 'send', label: 'שליחה לאישור' }];
        if (this.role === 'editor' && article.status === 'pending')
            return [{ type: 'review', label: 'בדיקה' }];
        return [{ type: article.status === 'published' ? 'view' : 'preview', label: 'צפייה' }];
    }

    async getArticle(id)
    {
        const article = (await this.getArticles()).find(article => article.id === id);
        if (!article)
            throw new Error('הכתבה לא נמצאה או שאין לך הרשאה.');
        return article;
    }

    async saveDraft(id, fields)
    {
        if (!this.canAccess() || this.role !== 'creator')
            throw new Error('רק יוצר יכול לשמור טיוטה.');
        const existing = id ? await this.getArticle(id) : null;
        if (existing && !['draft', 'returned'].includes(existing.status))
            throw new Error('ניתן לערוך רק טיוטות וכתבות שהוחזרו.');

        const title = fields.title.trim();
        const summary = fields.summary.trim();
        const category = fields.category.trim();
        const paragraphs = fields.content.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean);
        return this.repository.save({
            ...existing,
            id: existing?.id || 'managed-' + crypto.randomUUID(),
            creator: this.username,
            author: this.username,
            title, summary, category, paragraphs,
            status: 'draft',
            editorNote: existing?.editorNote || '',
            date: new Date().toISOString().slice(0, 10),
            time: new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
            views: existing?.views || 0,
            isRead: false
        });
    }

    async changeStatus(id, status, note = '')
    {
        const article = await this.getArticle(id);
        const creatorSubmit = this.role === 'creator' && status === 'pending'
            && ['draft', 'returned'].includes(article.status);
        const editorReview = this.role === 'editor' && article.status === 'pending'
            && ['published', 'returned'].includes(status);
        if (!creatorSubmit && !editorReview)
            throw new Error('הפעולה אינה זמינה למשתמש או למצב הכתבה.');
        if (['pending', 'published'].includes(status)
            && (!article.title.trim() || !article.summary.trim() || !article.category.trim() || !article.paragraphs.length))
            throw new Error('יש למלא כותרת, תקציר, קטגוריה ותוכן לפני שליחה לאישור.');
        if (status === 'returned' && !note.trim())
            throw new Error('יש להזין הערה ליוצר לפני החזרה לתיקונים.');
        return this.repository.save({
            ...article, status,
            editorNote: status === 'returned' ? note.trim() : '',
            date: new Date().toISOString().slice(0, 10)
        });
    }

    async calculateStats()
    {
        const stats = { draft: 0, pending: 0, published: 0, returned: 0 };
        (await this.getArticles()).forEach(article => stats[article.status]++);
        return stats;
    }
}
