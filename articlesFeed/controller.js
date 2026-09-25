export class ArticlesFeedController
{
    constructor(model, view)
    {
        this.model = model;
        this.view = view;
        this.pageSize = 8;      // כמות התחלתית שמוצגת בעמוד
        this.loadMoreSize = 20; // כתבות נוספות בכל טעינה בגלילה

        this.ready = this.init();
    }

    async init()
    {
        this.view.renderFeaturedArticle(null);
        try
        {
            const [categories, featured] = await Promise.all([
                this.model.getCategories(),
                this.model.getArticles({}, 0, 1) // הכתבה המובילה קבועה, לא תלויה בסינון
            ]);
            this.view.renderCategoryOptions(categories.map(category => category.name));
            this.view.renderFeaturedArticle(featured.articles[0] || null);
        }
        catch (error)
        {
            this.view.showLoadError();
            return;
        }
        await this.resetAndLoad();

        this.view.bindFilterChange(() => this.handleFilterChange());
        this.view.bindArticleClick((id) => this.handleArticleClick(id));
        this.view.bindLoadMore(() => this.handleLoadMore());
    }

    async resetAndLoad()
    {
        this.articles = [];
        this.skip = 0;
        this.hasMore = true;
        await this.loadPage(this.pageSize);
    }

    async loadPage(limit)
    {
        const filters = this.view.getFilterValues();
        const requestId = this.requestId = (this.requestId || 0) + 1;
        try
        {
            const result = await this.model.getArticles(filters, this.skip, limit);
            if (requestId !== this.requestId) return;
            this.skip += result.articles.length;
            this.hasMore = result.hasMore;
            this.articles = [...this.articles, ...result.articles];
            this.view.renderArticles(this.articles);
            this.view.updateLoadMoreVisibility(this.hasMore);
        }
        catch (error)
        {
            if (requestId === this.requestId) this.view.showLoadError();
        }
    }

    async handleFilterChange()
    {
        await this.resetAndLoad();
    }

    async handleArticleClick(id)
    {
        window.location.href = `../article/index.html?id=${encodeURIComponent(id)}`;
    }

    async handleLoadMore()
    {
        await this.loadPage(this.loadMoreSize);
    }
}
