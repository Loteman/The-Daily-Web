export class ArticlesFeedController 
{
    constructor(model, view) 
    {
        this.model = model;
        this.view = view;
        this.displayCount = 4; // כמות התחלתית שמוצגת בעמוד

        this.init();
    }

    async init() 
    {
        this.view.renderCategoryOptions();
        await this.updateView();

        this.view.bindFilterChange(() => this.handleFilterChange());
        this.view.bindArticleClick((id) => this.handleArticleClick(id));
        this.view.bindLoadMore(() => this.handleLoadMore());
    }

    async updateView() 
    {
        const filters = this.view.getFilterValues();
        const result = await this.model.getArticles(filters, this.displayCount);
        
        this.view.renderArticles(result.articles);
        this.view.updateLoadMoreVisibility(result.hasMore);
    }

    async handleFilterChange() 
    {
        this.displayCount = 8; // איפוס ספירת הטעינה בשינוי סינון
        await this.updateView();
    }

    async handleArticleClick(id) 
    {
        await this.model.toggleReadStatus(id);
        await this.updateView();
    }

    async handleLoadMore() 
    {
        this.displayCount += 4; // מוסיף עוד כתבות להצגה
        await this.updateView();
    }
}