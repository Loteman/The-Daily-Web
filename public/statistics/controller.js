export class StatisticsController {
    constructor(model, view) {
        this.model = model;
        this.view = view;
        this.requestId = 0;
        this.view.bindArticleChange(() => this.load());
        this.view.bindPeriodChange(() => this.render());
        this.view.bindRefresh(() => this.load(true));
        this.view.bindRetry(() => this.load(true));
        this.ready = this.init();
    }

    async init() {
        const scope = this.model.getCurrentUser()
            .then(user => this.view.renderScope(user))
            .catch(() => this.view.showScopeFallback());
        await Promise.all([scope, this.load(true)]);
    }

    render() {
        if (this.model.statistics) this.view.render(this.model.getDashboard(this.view.getFilters()));
    }

    async load(refreshArticles = false) {
        const id = ++this.requestId;
        this.view.setLoading(true);
        try {
            if (refreshArticles) {
                const articles = await this.model.fetchArticles();
                if (id !== this.requestId) return;
                this.model.articles = articles;
                this.view.renderArticleOptions(articles);
            }
            const statistics = await this.model.fetchStatistics(this.view.getFilters().articleId);
            if (id !== this.requestId) return;
            this.model.statistics = statistics;
            this.render();
            this.view.showLoaded();
        } catch (error) {
            if (id === this.requestId) this.view.showError(error);
        } finally {
            if (id === this.requestId) this.view.setLoading(false);
        }
    }
}
