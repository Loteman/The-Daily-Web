import { ArticleRepository } from '../data/articleRepository.js';

export class ArticlesFeedModel 
{
    constructor(repository = new ArticleRepository())
    {
        this.repository = repository;
        this.catalogPromise = null;
    }

    getCatalog()
    {
        // Share the in-flight request and its result for this page instance only.
        if (!this.catalogPromise)
            this.catalogPromise = this.repository.getAll().catch(error => {
                this.catalogPromise = null;
                throw error;
            });
        return this.catalogPromise;
    }

    async getArticles(filters = {}, displayCount = 8) 
    {
        let result = [...await this.getCatalog()];
        const search = (filters.search || '').trim().toLowerCase();

        if (search)
            result = result.filter(article =>
                [article.title, article.summary, article.author, article.category]
                    .some(value => value.toLowerCase().includes(search))
            );

        if (filters.category && filters.category !== 'הכל') 
            result = result.filter(article => article.category === filters.category);
        

        if (filters.status === 'נקראו') 
            result = result.filter(article => article.isRead);
        else if (filters.status === 'לא נקראו') 
            result = result.filter(article => !article.isRead);
        

        if (filters.sortBy === 'פופולריות') 
            result.sort((a, b) => b.views - a.views);
        
        else 
            result.sort((a, b) => new Date(b.date) - new Date(a.date));
        

        const paginatedResult = result.slice(0, displayCount);
        const hasMore = paginatedResult.length < result.length;

        return Promise.resolve({
            articles: paginatedResult,
            hasMore: hasMore
        });
    }

    async getCategories()
    {
        return this.repository.getCategories();
    }

    async toggleReadStatus(id) 
    {
        const result = await this.repository.recordView(id);
        if (this.catalogPromise)
        {
            const article = (await this.catalogPromise).find(article => String(article.id) === String(id));
            if (article) article.isRead = result.isRead;
        }
        return result;
    }
}
