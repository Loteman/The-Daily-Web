export class ArticleController 
{
    constructor(model, view) 
    {
        this.model = model;
        this.view = view;

        this.init();
    }

    async init() 
    {
        this.view.renderArticle(this.model.articleData);
        this.view.renderRelatedPosts(this.model.relatedPosts);
        this.view.renderComments(this.model.comments);

        const weatherData = await this.model.fetchWeather();
        this.view.renderWeatherData(weatherData);

        this.view.bindCommentSubmit(this.handleCommentSubmit.bind(this));
    }

    async handleCommentSubmit(author, text) 
    {
        this.view.clearFormMsg();

        if (author.length < 2) 
        {
            this.view.showFormError("נא להזין שם מלא תקין (לפחות 2 תווים).", 'author');
            return;
        }
        
        if (text.length < 3)
        {
            this.view.showFormError("תוכן התגובה קצר מדי (לפחות 3 תווים).", 'text');
            return;
        }

        const newComment = {
            id: Date.now(),
            name: author,
            date: new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            text: text
        };

        try {
            const updatedComments = await this.model.addComment(newComment);
            this.view.renderComments(updatedComments);
            this.view.resetForm();
            this.view.showFormSuccess("התגובה נוספה בהצלחה!");
        } 
        catch (err) 
        {
            console.error("שגיאה בשמירת התגובה:", err);
            this.view.showFormError("אירעה שגיאה בשליחת התגובה. נסה שוב שנית.", 'text');
        }
    }
}