export class ArticlesFeedController 
{
    constructor(model, view) 
    {
        this.model = model;
        this.view = view;
        this.displayCount = 8; // כמות התחלתית שמוצגת בעמוד

        this.init();
    }

    async init() 
    {
        this.view.renderFeaturedArticle(null);
        try
        {
            const catalog = await this.model.getArticles({}, Infinity);
            this.view.renderCategoryOptions((await this.model.getCategories()).map(category => category.name));
            this.view.renderFeaturedArticle(catalog.articles[0]);
        }
        catch (error)
        {
            this.view.showLoadError();
            return;
        }
        await this.updateView();

        this.view.bindFilterChange(() => this.handleFilterChange());
        this.view.bindArticleClick((id) => this.handleArticleClick(id));
        this.view.bindLoadMore(() => this.handleLoadMore());
    }

    async updateView() 
    {
        const filters = this.view.getFilterValues();
        const requestId = this.requestId = (this.requestId || 0) + 1;
        try
        {
            const result = await this.model.getArticles(filters, this.displayCount);
            if (requestId !== this.requestId) return;
            this.view.renderArticles(result.articles);
            this.view.updateLoadMoreVisibility(result.hasMore);
        }
        catch (error)
        {
            if (requestId === this.requestId) this.view.showLoadError();
        }
    }

    async handleFilterChange() 
    {
        this.displayCount = 8; // איפוס ספירת הטעינה בשינוי סינון
        await this.updateView();
    }

    async handleArticleClick(id) 
    {
        window.location.href = `../article/index.html?id=${encodeURIComponent(id)}`;
    }

    async handleLoadMore() 
    {
        this.displayCount += 20; // מוסיף עוד כתבות להצגה
        await this.updateView();
    }
}
