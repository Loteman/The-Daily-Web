
import { showImage } from '../data/presentation.js';

export class ArticlesManagementView
{
    constructor() 
    {
        this.userNameEl = document.querySelector('.user-name');
        this.userRoleEl = document.querySelector('.user-role');
        this.tableBody = document.querySelector('.data-table tbody');
        this.searchInput = document.querySelector('#article-search');
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

    
    // editable = "not read-only": both reporter drafting (edit) and editor reviewing (review) can type here now.
    fillForm(data, editable)
    {
        const form = document.querySelector('.article-dialog form');
        for (const field of ['title', 'summary', 'mainImage'])
        {
            form.elements[field].value = data?.[field] || '';
            form.elements[field].readOnly = !editable;
        }
        form.elements.categoryId.value = data?.categoryId ?? this.categories[0]?.id ?? '';
        form.elements.categoryId.disabled = !editable;
        form.elements.content.value = (data?.paragraphs || []).join('\n\n');
        form.elements.content.readOnly = !editable;
    }

    setActiveToggle(which)
    {
        const dialog = document.querySelector('.article-dialog');
        dialog.querySelector('.toggle-old')?.classList.toggle('active', which === 'old');
        dialog.querySelector('.toggle-new')?.classList.toggle('active', which === 'new');
    }

    // Switches the dialog between the currently published content and the pending edit under review,
    // preserving any in-progress edits to the pending version while doing so.
    showVersion(which)
    {
        const goingOld = which === 'old';
        if (goingOld === this.viewingOld)
            return;
        const form = document.querySelector('.article-dialog form');
        if (!this.viewingOld)
        {
            const fields = Object.fromEntries(new FormData(form));
            this.currentArticleData = {
                ...this.currentArticleData, ...fields,
                paragraphs: (fields.content || '').split(/\n\s*\n/).map(text => text.trim()).filter(Boolean)
            };
        }
        this.viewingOld = goingOld;
        const isEditableMode = this.dialogMode === 'edit' || this.dialogMode === 'review';
        this.fillForm(goingOld ? this.oldArticleData : this.currentArticleData, isEditableMode && !goingOld);
        this.setActiveToggle(goingOld ? 'old' : 'new');
        document.querySelector('.publish-article').disabled = goingOld;
        document.querySelector('.return-article').disabled = goingOld;
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
        this.currentArticleData = article ? { ...article } : null;
        this.oldArticleData = null;
        this.viewingOld = false;

        const editable = mode === 'edit' || mode === 'review';
        this.fillForm(this.currentArticleData, editable);
        dialog.querySelector('.dialog-title').textContent = mode === 'edit' ? 'עריכת כתבה' : 'בדיקת כתבה';
        dialog.querySelector('.editor-note').textContent = article?.editorNote || '';
        dialog.querySelector('.review-note-label').hidden = mode !== 'review';
        dialog.querySelector('.autosave-status').textContent = editable ? 'השינויים נשמרים אוטומטית' : '';
        dialog.querySelector('.publish-article').hidden = mode !== 'review';
        dialog.querySelector('.publish-article').disabled = false;
        dialog.querySelector('.return-article').hidden = mode !== 'review';
        dialog.querySelector('.return-article').disabled = false;
        dialog.querySelector('.dialog-message').textContent = '';

        const toggle = dialog.querySelector('.version-toggle');
        const showToggle = mode === 'review' && article?.version > 1 && typeof this.onLoadPublished === 'function';
        if (toggle)
        {
            toggle.hidden = !showToggle;
            this.setActiveToggle('new');
            const oldBtn = toggle.querySelector('.toggle-old');
            if (showToggle)
            {
                oldBtn.disabled = true;
                this.onLoadPublished(article.id)
                    .then(published => { this.oldArticleData = published; oldBtn.disabled = false; })
                    .catch(() => { this.oldArticleData = null; });
            }
        }
        dialog.showModal();
    }

    bindEditor(onSave, onReview, onLoadPublished)
    {
        const dialog = document.querySelector('.article-dialog');
        const form = dialog.querySelector('form');
        this.onDraftSave = onSave;
        this.onLoadPublished = onLoadPublished;
        form.addEventListener('submit', event => event.preventDefault());
        form.addEventListener('input', () => {
            if (this.viewingOld || (this.dialogMode !== 'edit' && this.dialogMode !== 'review'))
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
        const publishOrReturn = async (status, note) => {
            if (this.viewingOld || !(await this.saveDraftAutomatically()))
                return;
            onReview(this.editingId, status, note);
        };
        dialog.querySelector('.publish-article').addEventListener('click', () => publishOrReturn('published', ''));
        dialog.querySelector('.return-article').addEventListener('click', () => publishOrReturn('returned', form.elements.editorNote.value));
        dialog.querySelector('.version-toggle')?.addEventListener('click', event => {
            const btn = event.target.closest('button[data-version]');
            if (btn && !btn.disabled) this.showVersion(btn.dataset.version);
        });
    }

    async saveDraftAutomatically()
    {
        clearTimeout(this.autosaveTimer);
        if (this.savePromise)
            return this.savePromise;
        if ((this.dialogMode !== 'edit' && this.dialogMode !== 'review') || !this.draftDirty)
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
                    this.currentArticleData = article;
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

    setLoading(loading)
    {
        const el = document.querySelector('.loading-overlay');
        if (el) el.hidden = !loading;
    }

    showMessage(text)
    {
        const el = document.querySelector('.management-message');
        if (!el)
            return;
        el.textContent = text;
        clearTimeout(this.messageTimer);
        if (text) this.messageTimer = setTimeout(() => { el.textContent = ''; }, 4000);
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
            this.statNumbers[0].textContent = stats.draft;     // draft
            this.statNumbers[1].textContent = stats.pending;   // pending
            this.statNumbers[2].textContent = stats.published; // published
            this.statNumbers[3].textContent = stats.returned;  // returned
            this.statNumbers.forEach(el => el.classList.remove('skeleton'));
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

    // articles is already just the current page's rows (server-side paging); total is the full matching count.
    renderArticles(articles, currentPage, itemsPerPage, total)
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

        articles.forEach(article => {
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
            this.paginationSummary.textContent = `מציג ${articles.length} מתוך ${total} כתבות`;

        this.renderPaginationControls(total, itemsPerPage, currentPage);
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

        // With hundreds of pages, listing every number would flood the bar - show the ends and a
        // window around the current page instead, with an ellipsis for the gaps.
        let lastRendered = 0;
        for (let i = 1; i <= totalPages; i++)
        {
            if (i !== 1 && i !== totalPages && Math.abs(i - currentPage) > 2)
                continue;
            if (i - lastRendered > 1)
            {
                const ellipsis = document.createElement('span');
                ellipsis.className = 'p-ellipsis';
                ellipsis.textContent = '…';
                this.paginationContainer.appendChild(ellipsis);
            }
            const pageBtn = document.createElement('button');
            pageBtn.className = `p-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.dataset.page = i;
            this.paginationContainer.appendChild(pageBtn);
            lastRendered = i;
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
