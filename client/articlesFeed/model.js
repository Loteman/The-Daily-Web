import { ArticleRepository } from '../data/articleRepository.js';

// Hebrew UI labels -> API query values.
const sortMap = { 'פופולריות': 'popularity', 'תאריך פרסום': 'date' };
const statusMap = { 'נקראו': 'read', 'לא נקראו': 'unread' };

export class ArticlesFeedModel
{
    constructor(repository = new ArticleRepository())
    {
        this.repository = repository;
    }

    // Search/filter/sort/paging all run on the server, so this scales with the article count
    // instead of downloading the whole catalog on every page load.
    async getArticles(filters = {}, skip = 0, limit = 8)
    {
        return this.repository.search({
            search: (filters.search || '').trim(),
            category: filters.category && filters.category !== 'הכל' ? filters.category : '',
            status: statusMap[filters.status] || '',
            sort: sortMap[filters.sortBy] || 'date',
            skip, limit
        });
    }

    async getCategories()
    {
        return this.repository.getCategories();
    }

    async toggleReadStatus(id)
    {
        return this.repository.recordView(id);
    }
}
