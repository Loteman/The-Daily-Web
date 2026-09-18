import { ManagementRepository } from './managementRepository.js';
import { articles } from './articles.js';

// Shared data access for the feed and article page.
// Later, replace these method bodies with requests to the backend API.
export class ArticleRepository
{
    async getAll()
    {
        const managed = await new ManagementRepository().getAll();
        return [...articles, ...managed.filter(article => article.status === 'published')];
    }

    async getById(id)
    {
        return (await this.getAll()).find(article => String(article.id) === String(id)) || null;
    }
}
