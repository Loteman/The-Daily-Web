const classes = {
            "עולם": "tag-blue",
            "כלכלה": "tag-orange",
            "טכנולוגיה": "tag-purple",
            "ספורט": "tag-green",
            "סביבה": "tag-dark-green",
            "מדע": "tag-teal",
            "תרבות": "tag-amber",
            "בריאות": "tag-coral"
        };
const allCategories = ['הכל', 'עולם', 'כלכלה', 'טכנולוגיה', 'ספורט', 'סביבה', 'מדע', 'תרבות', 'בריאות'];

export class ArticlesFeedView 
{
    
    constructor() 
    {
        this.articlesGrid = document.querySelector('.articles-grid');
        this.categorySelect = document.querySelector('.filter-bar .filter-group:nth-child(1) select');
        this.statusSelect = document.querySelector('.filter-bar .filter-group:nth-child(2) select');
        this.sortSelect = document.querySelector('.filter-bar .filter-group:nth-child(3) select');
        this.loadMoreContainer = document.querySelector('.load-more-container');
        
    }

    sanitizeHTML(str) 
    {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    }

    getCategoryClass(category) 
    {
        return classes[category] || "tag-blue";
    }

    renderCategoryOptions() 
    {
        if (!this.categorySelect) 
            return;
        const currentVal = this.categorySelect.value;
        
        this.categorySelect.innerHTML = allCategories.map(cat => 
            `<option value="${cat}" ${cat === currentVal ? 'selected' : ''}>${cat}</option>`
        ).join('');
    }

    renderArticles(articles) 
    {
        if (!this.articlesGrid) 
            return;

        if (!articles.length) 
        {
            this.articlesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 20px;">לא נמצאו כתבות.</p>';
            return;
        }

        this.articlesGrid.innerHTML = articles.map(article => `
            <article class="article-card" data-id="${article.id}" style="cursor: pointer; border: ${article.isRead ? '2px solid #2563eb' : '2px solid transparent'}; transition: border 0.2s;">
                <div class="card-image">
                    <svg width="60" height="40" viewBox="0 0 60 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M10 32 L25 16 L38 28 L46 20 L52 32 Z" fill="#94a3b8"/>
                        <circle cx="43" cy="14" r="4" fill="#94a3b8"/>
                    </svg>
                </div>
                <div class="card-body">
                    <span class="category ${this.getCategoryClass(article.category)}">${this.sanitizeHTML(article.category)}</span>
                    <h3 class="card-title">${this.sanitizeHTML(article.title)}</h3>
                    <p class="card-summary">${this.sanitizeHTML(article.summary)}</p>
                    <div class="card-meta">
                        מאת ${this.sanitizeHTML(article.author)} &nbsp;|&nbsp; ${this.sanitizeHTML(article.date)} 
                        <span style="float: left;">${article.isRead ? '✅ נבחרה' : ''}</span>
                    </div>
                </div>
            </article>
        `).join('');
    }

    updateLoadMoreVisibility(hasMore) 
    {
        if (!this.loadMoreContainer) 
            return;

        this.loadMoreContainer.innerHTML = '';
        this.loadMoreContainer.style.display = 'flex';
        this.loadMoreContainer.style.justifyContent = 'center';
        this.loadMoreContainer.style.alignItems = 'center';

        if (hasMore) 
        {
            this.loadMoreButton = document.createElement('button');
            this.loadMoreButton.className = 'btn-load-more';
            this.loadMoreButton.innerHTML = `
                <span class="spinner-icon">🔄</span>
                טעינת כתבות נוספות
            `;
            this.loadMoreContainer.appendChild(this.loadMoreButton);
        } 
        else 
        {
            const noMoreText = document.createElement('p');
            noMoreText.style.textAlign = 'center';
            noMoreText.style.color = '#64748b';
            noMoreText.style.margin = '10px 0';
            noMoreText.textContent = 'אין כתבות נוספות להצגה';
            this.loadMoreContainer.appendChild(noMoreText);
            this.loadMoreButton = null;
        }
    }

    getFilterValues() 
    {
        return {
            category: this.categorySelect ? this.categorySelect.value : 'הכל',
            status: this.statusSelect ? this.statusSelect.value : 'הכל',
            sortBy: this.sortSelect ? this.sortSelect.value : 'תאריך פרסום'
        };
    }

    bindFilterChange(handler) 
    {
        if (this.categorySelect)
            this.categorySelect.addEventListener('change', handler);
        if (this.statusSelect) 
            this.statusSelect.addEventListener('change', handler);
        if (this.sortSelect) 
            this.sortSelect.addEventListener('change', handler);
    }

    bindArticleClick(handler) 
    {
        if (this.articlesGrid) 
        {
            // מאזין ישירות לחיצות על כרטיסיות הכתבות מבלי לדרוס את הרשת
            this.articlesGrid.addEventListener('click', (event) => {
                const card = event.target.closest('.article-card');
                if (card && handler) 
                {
                    const id = card.dataset.id;
                    handler(id);
                }
            });
        }
    }

    bindLoadMore(handler) 
    {
        if (this.loadMoreContainer) 
        {
            this.loadMoreContainer.addEventListener('click', (event) => {
                const button = event.target.closest('.btn-load-more');
                if (button && handler) 
                    handler();
            });
        }
    }
}