
export class ArticlesManagementController 
{
    constructor(model, view) 
    {
        this.model = model;
        this.view = view;

        this.currentPage = 1;
        this.itemsPerPage = 5;
        this.currentSearch = "";
        this.selectedCategory = "כל הקטגוריות";
        this.selectedStatus = "כל הסטטוסים";

        this.init();
    }


    async init() 
    {
        const user = await this.model.getUserProfile();
        this.view.renderUserProfile(user);
        this.view.setRole(this.model.role);

        const stats = await this.model.calculateStats();
        this.view.renderStats(stats);

        const filterOptions = await this.model.getFilterOptions();
        this.view.renderFilters(filterOptions);

        await this.updateView();

        this.view.bindSearchEvent(this.handleSearch.bind(this));
        this.view.bindFilterEvents(this.handleCategoryChange.bind(this), this.handleStatusChange.bind(this));
        this.view.bindPaginationEvent(this.handlePageChange.bind(this));
        this.view.bindNewArticleEvent(this.handleNewArticle.bind(this));
        this.view.bindTableActions(this.handleArticleAction.bind(this));
        this.view.bindEditor(this.handleSave.bind(this), this.handleReview.bind(this));
    }

    async getFilteredArticles() 
    {
        const articles = await this.model.getArticles();
        
        return articles.filter(article => {
            const matchesSearch = article.title.toLowerCase().includes(this.currentSearch.toLowerCase()) || 
                                  article.category.toLowerCase().includes(this.currentSearch.toLowerCase());
            
            const matchesCategory = this.selectedCategory === "כל הקטגוריות" || article.category === this.selectedCategory;
            
            const matchesStatus = this.selectedStatus === "כל הסטטוסים" || article.statusText === this.selectedStatus;

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }

    async updateView() 
    {
        const filteredArticles = await this.getFilteredArticles();
        this.currentPage = Math.min(this.currentPage, Math.max(1, Math.ceil(filteredArticles.length / this.itemsPerPage)));
        this.view.renderArticles(filteredArticles, this.currentPage, this.itemsPerPage);
        this.view.renderStats(await this.model.calculateStats());
    }

    async handleSearch(searchTerm) 
    {
        this.currentSearch = searchTerm;
        this.currentPage = 1;
        await this.updateView();
    }

    async handleCategoryChange(category) 
    {
        this.selectedCategory = category;
        this.currentPage = 1;
        await this.updateView();
    }

    async handleStatusChange(status) 
    {
        this.selectedStatus = status;
        this.currentPage = 1;
        await this.updateView();
    }

    async handlePageChange(newPage) 
    {
        this.currentPage = newPage;
        await this.updateView();
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
        try
        {
            await this.model.saveDraft(id, fields);
            this.view.closeEditor();
            this.view.renderFilters(await this.model.getFilterOptions());
            this.selectedCategory = 'כל הקטגוריות';
            this.selectedStatus = 'כל הסטטוסים';
            await this.updateView();
            this.view.showMessage('הטיוטה נשמרה.');
        }
        catch (error)
        {
            this.view.showEditorError(error.message);
        }
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
