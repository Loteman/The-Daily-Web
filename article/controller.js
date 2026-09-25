export class ArticleController 
{
    constructor(model, view) 
    {
        this.model = model;
        this.view = view;

        this.ready = this.init();
    }

    async init() 
    {
        const id = new URLSearchParams(window.location.search).get('id');
        try
        {
            const article = id ? await this.model.loadArticle(id) : null;
            if (!article)
            {
                this.view.showArticleError('הכתבה לא נמצאה');
                return;
            }
            this.view.renderArticle(article);
        }
        catch (error)
        {
            this.view.showArticleError('שגיאה בטעינת הכתבה');
            return;
        }
        this.view.setCommentsLoading(true);
        this.view.bindCommentSubmit(this.handleCommentSubmit.bind(this));
        this.view.bindCommentActions(this.handleCommentEdit.bind(this), this.handleCommentDelete.bind(this));

        // None of these secondary requests blocks rendering the article itself.
        this.secondaryReady = Promise.allSettled([
            this.model.loadRelatedPosts(id)
                .then(posts => this.view.renderRelatedPosts(posts))
                .catch(() => this.view.renderRelatedPosts([])),
            Promise.all([this.model.loadComments(id), this.model.loadUser()])
                .then(([comments, user]) => {
                    this.view.renderComments(comments);
                    this.view.setCommentUser(user);
                    this.view.setCommentsLoading(false);
                })
                .catch(() => this.view.showCommentsLoadError()),
            this.model.repository.recordView(id)
                .catch(error => console.error('View tracking failed:', error.message)),
            this.model.fetchWeather().then(data => this.view.renderWeatherData(data))
        ]);
    }

    async handleCommentSubmit(author, text) 
    {
        this.view.clearFormMsg();

        author = this.model.user?.fullName || author;
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
            if (err.code === 'GUEST_COMMENT_LIMIT')
            {
                this.view.showFormError(
                    `אורחים יכולים לשלוח עד 3 תגובות בדקה. נסו שוב בעוד ${err.retryAfterSeconds} שניות.`,
                    'text'
                );
                return;
            }

            console.error("שגיאה בשמירת התגובה:", err);
            this.view.showFormError("אירעה שגיאה בשליחת התגובה. נסה שוב שנית.", 'text');
        }
    }

    async handleCommentEdit(commentId, text)
    {
        if (text.length < 3)
        {
            this.view.showCommentEditError(commentId, "תוכן התגובה קצר מדי (לפחות 3 תווים).");
            return;
        }
        try
        {
            const updatedComments = await this.model.editComment(commentId, text);
            this.view.renderComments(updatedComments);
        }
        catch (err)
        {
            this.view.showCommentEditError(commentId, err.message || "לא ניתן היה לשמור את השינוי.");
        }
    }

    async handleCommentDelete(commentId)
    {
        try
        {
            const updatedComments = await this.model.deleteComment(commentId);
            this.view.renderComments(updatedComments);
        }
        catch (err)
        {
            console.error("שגיאה במחיקת התגובה:", err);
        }
    }
}
