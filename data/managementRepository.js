import { managementArticles } from './managementArticles.js';

export class ManagementRepository
{
    async getAll()
    {
        const saved = localStorage.getItem('managed_articles');
        if (saved)
            return JSON.parse(saved);

        return managementArticles.map(article => ({
            ...article,
            id: 'managed-' + article.id,
            creator: 'admin_creator',
            author: 'admin_creator',
            summary: article.subtitle,
            paragraphs: [article.subtitle],
            date: '2025-07-22',
            editorNote: '',
            views: 0,
            isRead: false
        }));
    }

    async save(article)
    {
        const articles = await this.getAll();
        const index = articles.findIndex(item => item.id === article.id);
        if (index === -1)
            articles.unshift(article);
        else
            articles[index] = article;
        localStorage.setItem('managed_articles', JSON.stringify(articles));
        return article;
    }
}
