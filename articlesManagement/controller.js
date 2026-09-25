export class ArticlesManagementController
{
    constructor(model, view)
    {
        this.model = model;
        this.view = view;

        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.currentSearch = "";
        this.selectedCategory = "כל הקטגוריות";
        this.selectedStatus = "כל הסטטוסים";

        this.ready = this.init();
    }


    async init()
    {
        // The remote database round-trips (stats + first page) take a couple of seconds - without this
        // spinner the stat cards just sit on their static "…" placeholders and look broken/stuck.
        this.view.setLoading(true);
        const user = await this.model.getUserProfile();
        this.view.renderUserProfile(user);
        this.view.setRole(this.model.role);

        const filterOptions = this.model.getFilterOptions();
        this.view.renderFilters(filterOptions);

        // Neither depends on the other, so run them together instead of one after the other.
        await Promise.all([this.refreshStats(), this.loadPage(1)]);
        this.view.setLoading(false);

        this.view.bindSearchEvent(this.handleSearch.bind(this));
        this.view.bindFilterEvents(this.handleCategoryChange.bind(this), this.handleStatusChange.bind(this));
        this.view.bindPaginationEvent(this.handlePageChange.bind(this));
        this.view.bindNewArticleEvent(this.handleNewArticle.bind(this));
        this.view.bindTableActions(this.handleArticleAction.bind(this));
        this.view.bindEditor(this.handleSave.bind(this), this.handleReview.bind(this), this.model.getPublished.bind(this.model));
    }

    async refreshStats()
    {
        this.view.renderStats(await this.model.calculateStats());
    }

    // Search/filter/sort/paging all run server-side - only the current page's articles are ever fetched.
    async loadPage(page)
    {
        this.currentPage = page;
        const skip = (page - 1) * this.itemsPerPage;
        const filters = {
            search: this.currentSearch,
            category: this.selectedCategory === "כל הקטגוריות" ? '' : this.selectedCategory,
            status: this.selectedStatus === "כל הסטטוסים" ? '' : this.selectedStatus
        };
        const result = await this.model.search(filters, skip, this.itemsPerPage);
        this.view.renderArticles(result.articles, this.currentPage, this.itemsPerPage, result.total);
    }

    async updateView()
    {
        await Promise.all([this.loadPage(this.currentPage), this.refreshStats()]);
    }

    async handleSearch(searchTerm)
    {
        this.currentSearch = searchTerm;
        await this.loadPage(1);
    }

    async handleCategoryChange(category)
    {
        this.selectedCategory = category;
        await this.loadPage(1);
    }

    async handleStatusChange(status)
    {
        this.selectedStatus = status;
        await this.loadPage(1);
    }

    async handlePageChange(newPage)
    {
        await this.loadPage(newPage);
    }

    handleNewArticle()
    {
        this.view.openArticle(null, 'edit');
    }

    async handleArticleAction(articleId, actionType)
    {
        try
        {
            const article = await this.model.getArticle(articleId);
            if (actionType === 'view')
                window.location.href = `../article/index.html?id=${encodeURIComponent(articleId)}`;
            else if (actionType === 'send')
            {
                await this.model.changeStatus(articleId, 'pending');
                await this.updateView();
                this.view.showMessage('הכתבה נשלחה לאישור.');
            }
            else if (actionType === 'revise')
                this.view.openArticle(await this.model.startRevision(articleId), 'edit');
            else if (actionType === 'delete')
            {
                if (!window.confirm(`למחוק את הכתבה "${article.title || 'טיוטה ללא כותרת'}"? הפעולה בלתי הפיכה.`))
                    return;
                await this.model.deleteArticle(articleId);
                await this.updateView();
                this.view.showMessage('הכתבה נמחקה.');
            }
            else
                this.view.openArticle(article, actionType === 'edit' ? 'edit' : actionType === 'review' ? 'review' : 'preview');
        }
        catch (error)
        {
            this.view.showMessage(error.message);
        }
    }

    async handleSave(id, fields)
    {
        const article = await this.model.saveDraft(id, fields);
        await this.updateView();
        return article;
    }

    async handleReview(id, status, note)
    {
        try
        {
            await this.model.changeStatus(id, status, note);
            this.view.closeEditor();
            await this.updateView();
            this.view.showMessage(status === 'published' ? 'הכתבה פורסמה.' : 'הכתבה הוחזרה לתיקונים.');
        }
        catch (error)
        {
            this.view.showEditorError(error.message);
        }
    }
}
