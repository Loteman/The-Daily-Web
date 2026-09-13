
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

        const stats = await this.model.calculateStats();
        this.view.renderStats(stats);

        const filterOptions = await this.model.getFilterOptions();
        this.view.renderFilters(filterOptions);

        await this.updateView();

        this.view.bindSearchEvent(this.handleSearch.bind(this));
        this.view.bindFilterEvents(this.handleCategoryChange.bind(this), this.handleStatusChange.bind(this));
        this.view.bindPaginationEvent(this.handlePageChange.bind(this));
        this.view.bindNewArticleEvent(this.handleNewArticle.bind(this));
        this.view.bindTableActions(this.handleArticleAction.bind(this), this.handleOptionsMenu.bind(this));
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
        this.view.renderArticles(filteredArticles, this.currentPage, this.itemsPerPage);
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
        alert("פתיחת טופס ליצירת כתבה חדשה.");
    }

    async handleArticleAction(articleId, actionType) 
    {
        const articles = await this.model.getArticles();
        const article = articles.find(a => a.id === Number(articleId));
        if (!article) return;

        switch (actionType) 
        {
            case 'edit':
                alert(`מעבר למסך עריכת הכתבה: "${article.title}"`);
                break;
            case 'send':
                alert(`הכתבה "${article.title}" נשלחה לאישור המערכת!`);
                break;
            case 'view':
                alert(`פתיחת תצוגה מקדימה לכתבה המפורסמת: "${article.title}"`);
                break;
            case 'comment':
                alert(`הצגת הערות עורך עבור הכתבה: "${article.title}"`);
                break;
            default:
                alert(`בוצעה פעולה כללית על כתבה מס' ${articleId}`);
        }
    }

    handleOptionsMenu(articleId) 
    {
        const actions = prompt(`תפריט אפשרויות מתקדם לכתבה מס' ${articleId}:\n1. שיתוף\n2. שכפול כתבה\n3. העברה לארכיון\n\nהקש את מספר הפעולה המבוקשת:`);
        if (actions === "1") 
            alert("הקישור הועתק ללוח!");
        else if (actions === "2") 
            alert("הכתבה שוכפלה בהצלחה.");
        else if (actions === "3") 
            alert("הכתבה הועברה לארכיון.");
    }
}