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
            if (actionType === 'view') {
                const article = this.model.cachedArticle(articleId) || await this.model.getArticle(articleId);
                window.location.href = `../article/index.html?id=${encodeURIComponent(articleId)}`;
                return;
            }
            else if (actionType === 'send')
            {
                await this.model.changeStatus(articleId, 'pending');
                await this.updateView();
                this.view.showMessage('הכתבה נשלחה לאישור.');
                return;
            }
            else if (actionType === 'delete')
            {
                const cached = this.model.cachedArticle(articleId);
                if (!window.confirm(`למחוק את הכתבה "${cached?.title || 'טיוטה ללא כותרת'}"? הפעולה בלתי הפיכה.`))
                    return;
                await this.model.deleteArticle(articleId);
                await this.updateView();
                this.view.showMessage('הכתבה נמחקה.');
                return;
            }

            const mode = actionType === 'review' ? 'review' : actionType === 'preview' ? 'preview' : 'edit';
            
            // 1. קריאה ל-View לפתוח מיד את הפופ-אפ במצב טעינה (בלי לגעת ב-DOM בקונטרולר!)
            if (typeof this.view.showLoadingModal === 'function') {
                this.view.showLoadingModal(mode);
            }

            // 2. שליפת הנתונים מהשרת ברקע
            const cached = actionType === 'revise' ? null : this.model.cachedArticle(articleId);
            let article = cached || await this.model.getArticle(articleId);

            if (actionType === 'revise')
            {
                const revision = article.status === 'published' ? await this.model.startRevision(articleId) : article;
                await this.updateView();
                const targetMode = revision.status === 'pending' ? (this.model.role === 'editor' ? 'review' : 'preview') : 'edit';
                
                // 3. הצגת הנתונים האמיתיים (ה-View יסיר את הטעינה או יחליף את התוכן)
                this.view.openArticle(revision, targetMode);
            }
            else
            {
                this.view.openArticle(article, mode);
            }
        }
        catch (error)
        {
            // אם יש שגיאה, אומרים ל-View לסגור או לבטל את הטעינה
            if (typeof this.view.hideLoadingModal === 'function') {
                this.view.hideLoadingModal();
            }
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
