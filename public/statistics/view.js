const $ = selector => document.querySelector(selector);
const number = value => new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 }).format(value);
const dateLabel = value => new Date(value).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });

function cellRow(values) {
    const row = document.createElement('tr');
    values.forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
    return row;
}

const dayKey = value => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(value));

function drawChart(days, versionChanges) {
    const container = $('#chart');
    container.replaceChildren();
    if (!days.length) { container.textContent = 'אין צפיות בתקופה שנבחרה.'; container.className = 'empty'; return; }
    container.className = '';
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 720 260');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'סך צפיות מצטבר לאורך זמן. הנקודות מציינות גרסאות שנשלחו לאישור.');
    const add = (tag, attrs, text) => {
        const element = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
        if (text !== undefined) element.textContent = text;
        svg.append(element); return element;
    };
    const maximum = Math.max(1, ...days.map(day => day.totalViews));
    const start = Date.parse(days[0].date), end = Date.parse(days.at(-1).date);
    const x = day => end === start ? 380 : 48 + (Date.parse(day.date) - start) / (end - start) * 648;
    const y = value => 214 - value / maximum * 180;
    for (let i = 0; i <= 4; i++) {
        const value = maximum * i / 4;
        add('line', { x1: 48, x2: 696, y1: y(value), y2: y(value), stroke: '#e2e8f0' });
        add('text', { x: 38, y: y(value) + 4, 'text-anchor': 'end', fill: '#64748b', 'font-size': 11 }, number(value));
    }
    add('polyline', { points: days.map(day => `${x(day)},${y(day.totalViews)}`).join(' '), fill: 'none', stroke: '#2563eb', 'stroke-width': 3 });
    days.forEach(day => {
        const point = add('circle', { cx: x(day), cy: y(day.totalViews), r: 3, fill: '#2563eb', tabindex: 0 });
        const title = document.createElementNS(ns, 'title');
        title.textContent = `${dateLabel(day.date)}: ${number(day.totalViews)} צפיות מצטברות`;
        point.setAttribute('aria-label', title.textContent); point.append(title);
    });
    versionChanges.forEach(change => {
        const day = days.find(item => item.date === dayKey(change.updatedAt));
        if (!day) return;
        const point = add('circle', { cx: x(day), cy: y(day.totalViews), r: 5, fill: '#f59e0b', stroke: '#fff', 'stroke-width': 2, tabindex: 0 });
        const title = document.createElementNS(ns, 'title');
        title.textContent = `${dateLabel(change.updatedAt)}: גרסה ${change.version} נשלחה לאישור — ${number(day.totalViews)} צפיות מצטברות`;
        point.setAttribute('aria-label', title.textContent); point.append(title);
    });
    add('text', { x: 48, y: 244, fill: '#64748b', 'font-size': 12 }, dateLabel(days[0].date));
    if (days.length > 1) add('text', { x: 696, y: 244, 'text-anchor': 'end', fill: '#64748b', 'font-size': 12 }, dateLabel(days.at(-1).date));
    container.append(svg);
}

export class StatisticsView {
    getFilters() {
        return { articleId: $('#article-filter').value, period: $('#period-filter').value };
    }
    renderArticleOptions(articles) {
        const selected = $('#article-filter').value;
        $('#article-filter').replaceChildren(new Option('כל הכתבות', ''), ...articles.map(article => new Option(article.title || 'טיוטה ללא כותרת', article.id)));
        if (articles.some(article => article.id === selected)) $('#article-filter').value = selected;
    }
    renderScope(user) {
        $('#scope').textContent = user?.role === 'editor' ? 'תמונת מצב של כלל הכתבות במערכת' : 'תמונת מצב של הכתבות שלך';
    }
    showScopeFallback() { $('#scope').textContent = 'פעילות הכתבות במערכת'; }
    setLoading(loading) {
        for (const selector of ['#refresh', '#article-filter', '#period-filter']) $(selector).disabled = loading;
        $('#dashboard').setAttribute('aria-busy', String(loading));
        if (loading) $('#message').textContent = 'טוען נתונים…';
    }
    showLoaded() {
        $('#dashboard').hidden = false;
        $('#message').textContent = '';
        $('#updated').textContent = 'עודכן ב־' + new Date().toLocaleTimeString('he-IL');
    }
    showError(error) {
        $('#dashboard').hidden = true;
        $('#message').textContent = error.status === 401 ? 'יש להתחבר כדי לצפות בסטטיסטיקה. ' : 'לא ניתן לטעון את הנתונים. ';
        if (error.status === 401) {
            const link = document.createElement('a'); link.href = '/login/index.html'; link.textContent = 'לעמוד ההתחברות'; $('#message').append(link);
        } else {
            const retry = document.createElement('button'); retry.textContent = 'נסו שוב'; retry.onclick = () => this.onRetry(); $('#message').append(retry);
        }
    }
    bindArticleChange(handler) { $('#article-filter').addEventListener('change', handler); }
    bindPeriodChange(handler) { $('#period-filter').addEventListener('change', handler); }
    bindRefresh(handler) { $('#refresh').addEventListener('click', handler); }
    bindRetry(handler) { this.onRetry = handler; }
    render({ totalViews, articleCount, publications, averageViews, chartDays, versionChanges, statuses, ranking }) {
        $('#total-views').textContent = number(totalViews);
        $('#article-count').textContent = number(articleCount);
        $('#publication-count').textContent = number(publications.length);
        $('#average-views').textContent = number(averageViews);
        drawChart(chartDays, versionChanges || []);
        $('#daily-table').replaceChildren(...(chartDays.length ? chartDays.map(day => cellRow([dateLabel(day.date), number(day.totalViews)])) : [cellRow(['אין נתוני צפייה', '—'])]));
        $('#statuses').replaceChildren();
        for (const [status, label, color] of [['draft', 'בהכנה', '#3b82f6'], ['pending', 'ממתינות לאישור', '#f59e0b'], ['published', 'פורסמו', '#10b981'], ['returned', 'הוחזרו לתיקונים', '#f43f5e']]) {
            const count = statuses[status] || 0;
            const row = document.createElement('div'); row.className = 'status-row';
            row.innerHTML = `<div class="status-label"><span>${label}</span><strong>${number(count)}</strong></div><div class="track"><div class="fill" style="width:${articleCount ? count / articleCount * 100 : 0}%;background:${color}"></div></div>`;
            $('#statuses').append(row);
        }
        $('#ranking').replaceChildren();
        ranking.forEach(article => {
            const row = document.createElement('li');
            const title = document.createElement('span'); title.className = 'rank-title'; title.textContent = article.title || 'טיוטה ללא כותרת';
            const count = document.createElement('strong'); count.textContent = number(article.views) + ' צפיות'; row.append(title, count); $('#ranking').append(row);
        });
        if (!articleCount) $('#ranking').textContent = 'אין כתבות להצגה.';

        $('#publications').replaceChildren(...(publications.length ? publications.map(item => cellRow([item.title, item.version, dateLabel(item.publishedAt)])) : [cellRow(['אין פרסומים בתקופה זו', '—', '—'])]));
    }
}
