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
        this.articles = [];
        this.skip = 0;
        this.hasMore = true;
        let categories = [];
        try
        {
            if (typeof this.view.showLoadingOverlay === 'function') {
                this.view.showLoadingOverlay(true);
            }
            // All three are independent of each other (the featured article and first page never
            // depend on filters at this point), so fetching them together turns 2 sequential
            // round-trips to the database into 1 - the single biggest cost on this page's load time.
            const [categories, featured, page] = await Promise.all([
                this.model.getCategories(),
                this.model.getArticles({}, 0, 1), // הכתבה המובילה קבועה, לא תלויה בסינון
                this.model.getArticles({}, 0, this.pageSize)
            ]);
            const categoryClasses = {};
            categories.forEach(cat => {
                if (cat.name && cat.className) {
                    categoryClasses[cat.name] = cat.className;
                }
            });
            if (typeof this.view.setCategoryClasses === 'function') {
                this.view.setCategoryClasses(categoryClasses);
            }
            this.view.renderCategoryOptions(categories.map(category => category.name));
            this.view.renderFeaturedArticle(featured.articles[0] || null);
            this.skip = page.articles.length;
            this.hasMore = page.hasMore;
            this.articles = page.articles;
            this.view.renderArticles(this.articles);
            this.view.updateLoadMoreVisibility(this.hasMore);
            this.view.hideLoadingOverlay();
        }
        catch (error)
        {
            this.view.showLoadError();
            return;
        }
        finally
        {
            // 2. מכבים את עיגול הטעינה תמיד בסוף (הצלחה או שגיאה)
            if (typeof this.view.hideLoadingOverlay === 'function') {
                this.view.hideLoadingOverlay();
            }
        }

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
            if (typeof this.view.showLoadingOverlay === 'function') {
                this.view.showLoadingOverlay();
            }
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
        finally
        {
            // 4. מכבים את עיגול הטעינה בסיום טעינת העמוד/הסינון
            if (requestId === this.requestId && typeof this.view.hideLoadingOverlay === 'function') {
                this.view.hideLoadingOverlay();
            }
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
