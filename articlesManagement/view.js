
import { showImage } from '../data/presentation.js';

export class ArticlesManagementView
{
    constructor() 
    {
        this.userNameEl = document.querySelector('.user-name');
        this.userRoleEl = document.querySelector('.user-role');
        this.tableBody = document.querySelector('.data-table tbody');
        this.searchInput = document.querySelector('.search-box input');
        this.newArticleBtn = document.querySelector('.btn-new-article');
        this.selectElements = document.querySelectorAll('.filter-group select');
        this.paginationContainer = document.querySelector('.pagination-buttons');
        this.paginationSummary = document.querySelector('.pagination-summary');
        
        this.statNumbers = document.querySelectorAll('.stat-number');
    }


    renderUserProfile(user)
    {
        document.querySelector('.page-title').textContent = user.role + ' - ניהול כתבות';
    }

    setRole(role)
    {
        this.newArticleBtn.hidden = role !== 'reporter';
    }

    

    setCategories(categories)
    {
        this.categories = categories;
        const select = document.querySelector('[name="categoryId"]');
        select.replaceChildren(...categories.map(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            return option;
        }));
    }

    renderAnalytics(statistics)
    {
        const container = document.querySelector('.view-statistics');
        container.innerHTML = `<h2>צפיות בכתבות — ${statistics.totalViews}</h2>
            <table class="data-table"><thead><tr><th>תאריך</th><th>צפיות</th><th>גרסאות שפורסמו</th></tr></thead><tbody></tbody></table>`;
        const dates = new Set(statistics.dailyViews.map(day => day.date));
        const publicationDay = value => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
        statistics.publications.filter(item => item.publishedAt).forEach(item => dates.add(publicationDay(item.publishedAt)));
        for (const date of [...dates].sort())
        {
            const row = document.createElement('tr');
            const publications = statistics.publications.filter(item => item.publishedAt && publicationDay(item.publishedAt) === date);
            for (const value of [date, statistics.dailyViews.find(day => day.date === date)?.views || 0,
                publications.map(item => item.articleId + ' v' + item.version).join(', ') || '—'])
            {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.appendChild(cell);
            }
            container.querySelector('tbody').appendChild(row);
        }
        if (!dates.size) container.append('אין נתוני צפייה עדיין.');
    }

    openArticle(article, mode)
    {
        const dialog = document.querySelector('.article-dialog');
        const form = dialog.querySelector('form');
        form.reset();
        this.editingId = article?.id || null;
        this.draftDirty = false;
        this.savePromise = null;
        clearTimeout(this.autosaveTimer);
        this.dialogMode = mode;
        for (const field of ['title', 'summary', 'mainImage'])
        {
            form.elements[field].value = article?.[field] || '';
            form.elements[field].readOnly = mode !== 'edit';
        }
        form.elements.categoryId.value = article?.categoryId ?? this.categories[0]?.id ?? '';
        form.elements.categoryId.disabled = mode !== 'edit';
        form.elements.content.value = (article?.paragraphs || []).join('\n\n');
        form.elements.content.readOnly = mode !== 'edit';
        dialog.querySelector('.dialog-title').textContent = mode === 'edit' ? 'עריכת כתבה' : 'בדיקת כתבה';
        dialog.querySelector('.editor-note').textContent = article?.editorNote || '';
        dialog.querySelector('.review-note-label').hidden = mode !== 'review';
        dialog.querySelector('.autosave-status').textContent = mode === 'edit' ? 'השינויים נשמרים אוטומטית' : '';
        dialog.querySelector('.publish-article').hidden = mode !== 'review';
        dialog.querySelector('.return-article').hidden = mode !== 'review';
        dialog.querySelector('.dialog-message').textContent = '';
        dialog.showModal();
    }

    bindEditor(onSave, onReview)
    {
        const dialog = document.querySelector('.article-dialog');
        const form = dialog.querySelector('form');
        this.onDraftSave = onSave;
        form.addEventListener('submit', event => event.preventDefault());
        form.addEventListener('input', () => {
            if (this.dialogMode !== 'edit')
                return;
            this.draftDirty = true;
            dialog.querySelector('.autosave-status').textContent = 'שינויים ממתינים לשמירה...';
            clearTimeout(this.autosaveTimer);
            this.autosaveTimer = setTimeout(() => this.saveDraftAutomatically(), 600);
        });

        const close = async () => {
            if (await this.saveDraftAutomatically())
                dialog.close();
        };
        dialog.querySelector('.close-dialog').addEventListener('click', close);
        dialog.addEventListener('cancel', event => {
            event.preventDefault();
            close();
        });
        window.addEventListener('beforeunload', event => {
            if (this.draftDirty || this.savePromise)
            {
                event.preventDefault();
                event.returnValue = '';
            }
        });
        dialog.querySelector('.publish-article').addEventListener('click', () => onReview(this.editingId, 'published', ''));
        dialog.querySelector('.return-article').addEventListener('click', () => onReview(this.editingId, 'returned', form.elements.editorNote.value));
    }

    async saveDraftAutomatically()
    {
        clearTimeout(this.autosaveTimer);
        if (this.savePromise)
            return this.savePromise;
        if (this.dialogMode !== 'edit' || !this.draftDirty)
            return true;

        const dialog = document.querySelector('.article-dialog');
        const form = dialog.querySelector('form');
        const status = dialog.querySelector('.autosave-status');
        this.savePromise = (async () => {
            try
            {
                while (this.draftDirty)
                {
                    const fields = Object.fromEntries(new FormData(form));
                    this.draftDirty = false;
                    if (!this.editingId && !['title', 'summary', 'mainImage', 'content'].some(key => fields[key].trim()))
                    {
                        status.textContent = 'השינויים נשמרים אוטומטית';
                        continue;
                    }
                    status.textContent = 'שומר טיוטה...';
                    const article = await this.onDraftSave(this.editingId, fields);
                    this.editingId = article.id;
                }
                dialog.querySelector('.dialog-message').textContent = '';
                status.textContent = this.editingId ? 'הטיוטה נשמרה אוטומטית' : '';
                return true;
            }
            catch (error)
            {
                this.draftDirty = true;
                status.textContent = 'הטיוטה לא נשמרה';
                this.showEditorError(error.message);
                return false;
            }
        })();

        try
        {
            return await this.savePromise;
        }
        finally
        {
            this.savePromise = null;
        }
    }

    closeEditor()
    {
        document.querySelector('.article-dialog').close();
    }

    showEditorError(message)
    {
        document.querySelector('.dialog-message').textContent = message;
    }

    escape(value)
    {
        const element = document.createElement('span');
        element.textContent = value ?? '';
        return element.innerHTML.replaceAll('"', '&quot;');
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
                .map(cat => `<option value="${this.escape(cat)}">${this.escape(cat)}</option>`).join('');

            this.selectElements[1].innerHTML = options.statuses
                .map(status => `<option value="${this.escape(status)}">${this.escape(status)}</option>`).join('');
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
                            <div class="article-heading">${this.escape(article.title || 'טיוטה ללא כותרת')}</div>
                            <div class="article-sub">${this.escape(article.subtitle)}</div>
                        </div>
                    </div>
                </td>
                <td>${this.escape(article.category)}</td>
                <td><span class="badge ${article.badgeClass}">${this.escape(article.statusText)}</span></td>
                <td class="date-cell">
                    <div>${this.escape(new Date(article.date).toLocaleDateString('he-IL'))}</div>
                    <div class="time-str">${this.escape(article.time)}</div>
                </td>
                <td>
                    <div class="action-group">
                        ${article.actions.map(action => `<button class="btn-outline action-main-btn" data-id="${this.escape(article.id)}" data-action="${action.type}">${action.label}</button>`).join('')}
                    </div>
                </td>
            `;
            this.tableBody.appendChild(tr);
            showImage(tr.querySelector('.article-img'), article.mainImage, article.title);
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

    bindTableActions(onActionHandler)
    {
        if (!this.tableBody) 
            return;

        this.tableBody.addEventListener('click', (e) => {
            const actionBtn = e.target.closest('.action-main-btn');

            if (actionBtn) 
            {
                const articleId = actionBtn.getAttribute('data-id');
                const actionType = actionBtn.getAttribute('data-action');
                onActionHandler(articleId, actionType);
            }

        });
    }
}
