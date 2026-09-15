
export class ArticlesManagementView 
{
    constructor() 
    {
        this.userNameEl = document.querySelector('.user-name');
        this.userRoleEl = document.querySelector('.user-role');
        this.tableBody = document.querySelector('.data-table tbody');
        this.searchInput = document.querySelector('.search-box input');
        this.newArticleBtn = document.querySelector('.btn-new-article');
        this.selectElements = document.querySelectorAll('.custom-select select');
        this.paginationContainer = document.querySelector('.pagination-buttons');
        this.paginationSummary = document.querySelector('.pagination-summary');
        
        this.statNumbers = document.querySelectorAll('.stat-number');
    }


    renderUserProfile(user) 
    {
        if (!this.userNameEl || !this.userRoleEl)
            return;
        this.userNameEl.textContent = user.name;
        this.userRoleEl.textContent = user.role;
    }

    renderStats(stats) 
    {
        if (this.statNumbers.length >= 4) 
        {
            this.statNumbers[0].textContent = stats.draft;     // בהכנה
            this.statNumbers[1].textContent = stats.pending;   // ממתינות לאישור
            this.statNumbers[2].textContent = stats.published; // פורסמו
            this.statNumbers[3].textContent = stats.returned;  // הוחזרה לתיקונים
        }
    }

    renderFilters(options) 
    {
        if (this.selectElements.length >= 2) 
        {
            this.selectElements[0].innerHTML = options.categories
                .map(cat => `<option value="${cat}">${cat}</option>`).join('');

            this.selectElements[1].innerHTML = options.statuses
                .map(status => `<option value="${status}">${status}</option>`).join('');
        }
    }

    renderArticles(articles, currentPage, itemsPerPage) 
    {
        if (!this.tableBody) 
            return;
        this.tableBody.innerHTML = '';

        if (articles.length === 0) 
        {
            this.tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">לא נמצאו כתבות</td></tr>`;
            if (this.paginationSummary) 
                this.paginationSummary.textContent = `מציג 0 מתוך 0 כתבות`;
            if (this.paginationContainer) 
                this.paginationContainer.innerHTML = '';
            return;
        }

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedArticles = articles.slice(startIndex, endIndex);

        paginatedArticles.forEach(article => {
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td>
                    <div class="article-info">
                        <div class="article-img ${article.thumbClass || 'thumb-robot'}"></div>
                        <div class="article-text">
                            <div class="article-heading">${DOMPurify.sanitize(article.title)}</div>
                            <div class="article-sub">${DOMPurify.sanitize(article.subtitle)}</div>
                        </div>
                    </div>
                </td>
                <td>${DOMPurify.sanitize(article.category)}</td>
                <td><span class="badge ${article.badgeClass}">${DOMPurify.sanitize(article.statusText)}</span></td>
                <td class="date-cell">
                    <div>${article.date}</div>
                    <div class="time-str">${article.time}</div>
                </td>
                <td>
                    <div class="action-group">
                        <button class="btn-outline action-main-btn" data-id="${article.id}" data-action="${article.actionType}">${DOMPurify.sanitize(article.actionText)}</button>
                        <button class="btn-dots btn-menu-options" data-id="${article.id}">⋮</button>
                    </div>
                </td>
            `;
            this.tableBody.appendChild(tr);
        });

        if (this.paginationSummary) 
            this.paginationSummary.textContent = `מציג ${paginatedArticles.length} מתוך ${articles.length} כתבות`;

        this.renderPaginationControls(articles.length, itemsPerPage, currentPage);
    }

    renderPaginationControls(totalItems, itemsPerPage, currentPage) 
    {
        if (!this.paginationContainer) 
            return;
        this.paginationContainer.innerHTML = '';

        const totalPages = Math.ceil(totalItems / itemsPerPage);
        if (totalPages <= 1) 
            return;

        const prevBtn = document.createElement('button');
        prevBtn.className = 'p-btn';
        prevBtn.textContent = '<';
        prevBtn.disabled = currentPage === 1;
        prevBtn.dataset.page = currentPage - 1;
        this.paginationContainer.appendChild(prevBtn);

        for (let i = 1; i <= totalPages; i++) 
        {
            const pageBtn = document.createElement('button');
            pageBtn.className = `p-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.dataset.page = i;
            this.paginationContainer.appendChild(pageBtn);
        }

        const nextBtn = document.createElement('button');
        nextBtn.className = 'p-btn';
        nextBtn.textContent = '>';
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.dataset.page = currentPage + 1;
        this.paginationContainer.appendChild(nextBtn);
    }


    bindSearchEvent(handler) 
    {
        if (!this.searchInput) 
            return;
        this.searchInput.addEventListener('input', (e) => handler(e.target.value));
    }

    bindFilterEvents(onCategoryChange, onStatusChange) 
    {
        if (this.selectElements.length >= 2) 
        {
            this.selectElements[0].addEventListener('change', (e) => onCategoryChange(e.target.value));
            this.selectElements[1].addEventListener('change', (e) => onStatusChange(e.target.value));
        }
    }

    bindPaginationEvent(handler) 
    {
        if (!this.paginationContainer) 
            return;
        this.paginationContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('p-btn') && !e.target.disabled) 
            {
                const targetPage = Number(e.target.dataset.page);
                handler(targetPage);
            }
        });
    }

    bindNewArticleEvent(handler) 
    {
        if (!this.newArticleBtn) 
            return;
        this.newArticleBtn.addEventListener('click', handler);
    }

    bindTableActions(onActionHandler, onOptionsHandler) 
    {
        if (!this.tableBody) 
            return;

        this.tableBody.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.action-main-btn');
            const optionsBtn = e.target.closest('.btn-menu-options');

            if (actionBtn) 
            {
                const articleId = actionBtn.getAttribute('data-id');
                const actionType = actionBtn.getAttribute('data-action');
                onActionHandler(articleId, actionType);
            }

            if (optionsBtn) 
            {
                const articleId = optionsBtn.getAttribute('data-id');
                onOptionsHandler(articleId);
            }
        });
    }
}