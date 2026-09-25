import { formatDate, showImage } from '../data/presentation.js';

export class ArticleView
{
    constructor() 
    {
        this.weatherLocationEl = document.querySelector('.weather-location');
        this.temperatureEl = document.querySelector('.temperature');
        this.conditionEl = document.querySelector('.condition');
        this.weatherIconEl = document.querySelector('.weather-icon');

        this.articleBigCategoryEl = document.querySelector('.article-section .tag-blue-big');
        this.articleTitleEl = document.querySelector('.article-title');
        this.articleSummaryEl = document.querySelector('.article-summary');
        this.authorSpanEl = document.querySelector('.article-details .author span');
        this.dateSpanEl = document.querySelector('.article-details .date span');
        this.categoryDetailSpanEl = document.querySelector('.article-details .category-detail span');
        this.articleBodyEl = document.querySelector('.article-body');

        this.relatedPostsWidgetEl = document.querySelector('.related-posts-widget');
        this.commentsSectionEl = document.querySelector('.comments-section');
        this.commentFormEl = document.querySelector('.add-comment form');
        this.commentTextareaEl = document.querySelector('.add-comment textarea');
        this.commentAuthorInputEl = document.querySelector('.add-comment input[type="text"]');
        this.addCommentTitleEl = document.querySelector('.add-comment h2');

        this.formMsgEl = document.querySelector('.form-msg');
        if (!this.formMsgEl && this.addCommentTitleEl) 
        {
            this.formMsgEl = document.createElement('span');
            this.formMsgEl.className = 'form-msg';
            this.formMsgEl.style.fontSize = '0.85rem';
            this.formMsgEl.style.fontWeight = 'normal';
            this.formMsgEl.style.marginRight = '12px';
            this.formMsgEl.style.visibility = 'hidden';
            this.addCommentTitleEl.appendChild(this.formMsgEl);
        }
    }

    sanitizeInput(str) 
    {
        const tempDiv = document.createElement('div');
        tempDiv.textContent = str;
        return tempDiv.innerHTML;
    }

    renderWeatherData(data) 
    {
        if (this.weatherLocationEl) 
            this.weatherLocationEl.textContent = data.location;
        if (this.temperatureEl) 
            this.temperatureEl.textContent = data.currentTemp;
        if (this.conditionEl) 
            this.conditionEl.textContent = data.condition;
        if (this.weatherIconEl) 
            this.weatherIconEl.textContent = data.icon;
    }

    renderArticle(article) 
    {
        if (this.articleBigCategoryEl) 
            this.articleBigCategoryEl.textContent = article.category;
        if (this.articleTitleEl) 
            this.articleTitleEl.textContent = article.title;
        if (this.articleSummaryEl) 
            this.articleSummaryEl.textContent = article.summary;
        if (this.authorSpanEl) 
            this.authorSpanEl.textContent = article.author;
        if (this.dateSpanEl) 
            this.dateSpanEl.textContent = formatDate(article.date);
        if (this.categoryDetailSpanEl) 
            this.categoryDetailSpanEl.textContent = article.category;

        document.title = `${article.title} - The Web Daily`;
        showImage(document.querySelector('.illustration-placeholder'), article.mainImage, article.title);
        this.articleBodyEl.replaceChildren();
        const paragraphs = article.paragraphs || [article.summary];
        paragraphs.forEach(text => {
            const paragraph = document.createElement('p');
            paragraph.className = 'article-text';
            paragraph.textContent = text;
            this.articleBodyEl.appendChild(paragraph);
        });
    }

    showArticleError(message)
    {
        const section = document.querySelector('.article-section');
        const title = document.createElement('h1');
        title.textContent = message;
        const backLink = document.createElement('a');
        backLink.href = '../articlesFeed/index.html';
        backLink.textContent = 'חזרה לכתבות';
        section.replaceChildren(title, backLink);
        this.relatedPostsWidgetEl.hidden = true;
    }

    renderRelatedPosts(posts) 
    {
        if (!this.relatedPostsWidgetEl) 
            return;
        const headerEl = this.relatedPostsWidgetEl.querySelector('.widget-header');
        let postsHtml = headerEl ? headerEl.outerHTML : '<div class="widget-header"><h3>כתבות נוספות</h3><a href="#" class="see-all"> הצג הכל←</a></div>';
        
        posts.forEach(post => {
            postsHtml += `
                <div class="related-post" data-id="${this.sanitizeInput(String(post.id))}">
                    <div class="post-meta">
                        <span class="category tag-blue">${this.sanitizeInput(post.category)}</span>
                        <p class="post-title"><a href="?id=${encodeURIComponent(post.id)}">${this.sanitizeInput(post.title)}</a></p>
                        <span class="post-date">${formatDate(post.date)}</span>
                    </div>
                    <div class="post-thumb-placeholder"></div>
                </div>
            `;
        });
        this.relatedPostsWidgetEl.innerHTML = postsHtml;
    }

    renderComments(comments) 
    {
        if (!this.commentsSectionEl) 
            return;
        let commentsHtml = `<h2>תגובות (${comments.length})</h2>`;
        
        comments.forEach(comment => {
            commentsHtml += `
                <div class="comment" data-id="${this.sanitizeInput(String(comment.id)).replaceAll('"', '&quot;')}">
                    <div class="avatar">👤</div>
                    <div class="comment-content">
                        <div class="comment-details">
                            <span class="user-name">${this.sanitizeInput(comment.name)}</span>
                            <span class="comment-date">${this.sanitizeInput(new Date(comment.date).toLocaleString('he-IL'))}</span>
                        </div>
                        <p class="comment-text">${this.sanitizeInput(comment.text)}</p>
                    </div>
                </div>
            `;
        });
        this.commentsSectionEl.innerHTML = commentsHtml;
    }

    setCommentUser(user)
    {
        if (user && this.commentAuthorInputEl)
        {
            this.commentAuthorInputEl.value = user.fullName || user.username;
            this.commentAuthorInputEl.defaultValue = this.commentAuthorInputEl.value;
            this.commentAuthorInputEl.readOnly = true;
        }
    }

    showFormError(message, targetField)
    {
        if (!this.formMsgEl) 
            return;
        if (this.commentAuthorInputEl) 
            this.commentAuthorInputEl.style.borderColor = '';
        if (this.commentTextareaEl) 
            this.commentTextareaEl.style.borderColor = '';
        
        if (targetField === 'author' && this.commentAuthorInputEl) 
        {
            this.commentAuthorInputEl.style.borderColor = '#dc2626';
            this.commentAuthorInputEl.focus();
        } 
        if (targetField === 'text' && this.commentTextareaEl) 
        {
            this.commentTextareaEl.style.borderColor = '#dc2626';
            this.commentTextareaEl.focus();
        }
        
        this.formMsgEl.style.color = '#dc2626';
        this.formMsgEl.textContent = message;
        this.formMsgEl.style.visibility = 'visible';
    }

    showFormSuccess(message) 
    {
        if (!this.formMsgEl) 
            return;
        if (this.commentAuthorInputEl) 
            this.commentAuthorInputEl.style.borderColor = '';
        if (this.commentTextareaEl) 
            this.commentTextareaEl.style.borderColor = '';
        
        this.formMsgEl.style.color = '#16a34a'; 
        this.formMsgEl.textContent = message;
        this.formMsgEl.style.visibility = 'visible';

        setTimeout(() => this.clearFormMsg(), 5000);
    }

    clearFormMsg() 
    {
        if (!this.formMsgEl) return;
        this.formMsgEl.textContent = '';
        this.formMsgEl.style.visibility = 'hidden';
        if (this.commentAuthorInputEl) 
            this.commentAuthorInputEl.style.borderColor = '';
        if (this.commentTextareaEl) 
            this.commentTextareaEl.style.borderColor = '';
    }

    bindCommentSubmit(handler) 
    {
        if (this.commentFormEl) 
            {
            this.commentFormEl.addEventListener('submit', (event) => {
                event.preventDefault();
                const author = this.commentAuthorInputEl ? this.commentAuthorInputEl.value.trim() : "";
                const text = this.commentTextareaEl ? this.commentTextareaEl.value.trim() : "";
                handler(author, text);
            });
        }
    }

    resetForm() 
    {
        if (this.commentFormEl) 
            this.commentFormEl.reset();
    }
}
