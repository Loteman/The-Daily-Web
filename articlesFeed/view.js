import { formatDate, showImage } from '../data/presentation.js';

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

    renderCategoryOptions(categories = [])
    {
        if (!this.categorySelect) 
            return;
        const currentVal = this.categorySelect.value;
        
        const allCategories = ['הכל', ...new Set(categories.filter(Boolean))];
        this.categorySelect.replaceChildren(...allCategories.map(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            option.selected = cat === currentVal;
            return option;
        }));
    }

    renderFeaturedArticle(article)
    {
        const hero = document.querySelector('.hero-card');
        if (!article)
        {
            hero.style.display = 'none';
            return;
        }

        hero.style.display = '';
        const category = hero.querySelector('.category');
        category.textContent = article.category;
        category.className = `category ${this.getCategoryClass(article.category)}`;
        hero.querySelector('.hero-title').textContent = article.title;
        hero.querySelector('.hero-summary').textContent = article.summary;
        hero.querySelector('.hero-meta').textContent = `${article.author} | ${formatDate(article.date)}`;
        showImage(hero.querySelector('.hero-image'), article.mainImage, article.title);
        hero.querySelector('.btn-read-more').href = `../article/index.html?id=${encodeURIComponent(article.id)}`;
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
            <article class="article-card" data-id="${this.sanitizeHTML(String(article.id)).replace(/"/g, '&quot;')}" style="cursor: pointer; border: ${article.isRead ? '2px solid #2563eb' : '2px solid transparent'}; transition: border 0.2s;">
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
                        מאת ${this.sanitizeHTML(article.author)} &nbsp;|&nbsp; ${formatDate(article.date)}
                        <span style="float: left;">${article.isRead ? '✅ נקראה' : ''}</span>
                    </div>
                </div>
            </article>
        `).join('');
        this.articlesGrid.querySelectorAll('.article-card').forEach((card, index) =>
            showImage(card.querySelector('.card-image'), articles[index].mainImage, articles[index].title));
    }

    showLoadError()
    {
        this.renderFeaturedArticle(null);
        this.articlesGrid.textContent = 'לא ניתן לטעון את הכתבות. נסו לרענן את העמוד.';
        this.updateLoadMoreVisibility(false);
        this.loadMoreContainer.textContent = '';
    }

    updateLoadMoreVisibility(hasMore) 
    {
        if (!this.loadMoreContainer) 
            return;

        this.hasMore = hasMore;
        this.loadMoreContainer.textContent = hasMore
            ? ''
            : 'אין כתבות נוספות להצגה';

        if (this.loadMoreObserver)
        {
            this.loadMoreObserver.unobserve(this.loadMoreContainer);
            if (hasMore)
                this.loadMoreObserver.observe(this.loadMoreContainer);
        }
    }

    getFilterValues() 
    {
        const searchInput = document.querySelector('#article-search');
        return {
            search: searchInput ? searchInput.value : '',
            category: this.categorySelect ? this.categorySelect.value : 'הכל',
            status: this.statusSelect ? this.statusSelect.value : 'הכל',
            sortBy: this.sortSelect ? this.sortSelect.value : 'תאריך פרסום'
        };
    }

    bindFilterChange(handler) 
    {
        const searchInput = document.querySelector('#article-search');
        if (searchInput)
            searchInput.addEventListener('input', handler);

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
        if (!this.loadMoreContainer)
            return;

        this.loadMoreObserver = new IntersectionObserver(async (entries) => {
            if (!entries.some(entry => entry.isIntersecting) || !this.hasMore || this.isLoadingMore)
                return;

            this.isLoadingMore = true;
            try
            {
                await handler();
            }
            finally
            {
                this.isLoadingMore = false;
            }
        }, { rootMargin: '0px 0px 300px 0px' });

        if (this.hasMore)
            this.loadMoreObserver.observe(this.loadMoreContainer);
    }
}
