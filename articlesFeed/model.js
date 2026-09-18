import { ArticleRepository } from '../data/articleRepository.js';

export class ArticlesFeedModel 
{
    constructor(repository = new ArticleRepository())
    {
        this.repository = repository;
        
        localStorage.removeItem('catalog_read_states');
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

    async toggleReadStatus(id) 
    {
        const targetId = String(id);
        const articles = await this.repository.getAll();
        articles.forEach(art => {
            if (String(art.id) === targetId)
                // אם היא כבר הייתה מסומנת, נבטל את הסימון, או נסמן אותה בלבד
                art.isRead = !art.isRead;
            else 
                art.isRead = false; // כל השאר לא מסומנות
            
        });
        return Promise.resolve();
    }
}