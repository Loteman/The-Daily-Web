import { ArticleRepository } from '../data/articleRepository.js';

export class ArticlesFeedModel 
{
    constructor(repository = new ArticleRepository())
    {
        this.repository = repository;
        
    }

    async getArticles(filters = {}, displayCount = 8) 
    {
        let result = [...await this.repository.getAll()];
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
        return this.repository.recordView(id);
    }
}
