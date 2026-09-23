import { api, currentUser } from '../../data/api.js';

const dayKey = value => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(value));

export class StatisticsModel {
    constructor(request = api, getUser = currentUser) {
        this.request = request;
        this.getUser = getUser;
        this.articles = [];
        this.statistics = null;
    }

    getCurrentUser() { return this.getUser(); }
    fetchArticles() { return this.request('/api/management/articles'); }
    fetchStatistics(articleId) {
        return this.request('/api/statistics' + (articleId ? '?articleId=' + encodeURIComponent(articleId) : ''));
    }

    getDashboard({ articleId = '', period = 'all' }, now = new Date()) {
        const selected = this.articles.filter(article => !articleId || article.id === articleId);
        const today = dayKey(now);
        const cutoff = period === 'all' ? '' : new Date(Date.parse(today) - (Number(period) - 1) * 86400000).toISOString().slice(0, 10);
        const days = this.statistics.dailyViews.filter(day => (!cutoff || day.date >= cutoff) && day.date <= today);
        const titles = new Map(this.articles.map(article => [article.id, article.title]));
        const publications = this.statistics.publications
            .filter(item => item.publishedAt && (!cutoff || dayKey(item.publishedAt) >= cutoff) && dayKey(item.publishedAt) <= today)
            .map(item => ({ ...item, title: titles.get(item.articleId) || item.articleId }))
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        const totalViews = days.reduce((sum, day) => sum + day.views, 0);
        const activeDays = days.filter(day => day.views > 0).length;
        const chartDays = [];
        if (days.length) {
            const byDate = new Map(days.map(day => [day.date, day.views]));
            // Include zero-view days so gaps are not shown as continuous activity.
            for (let date = Date.parse(cutoff || days[0].date); date <= Date.parse(today); date += 86400000) {
                const key = new Date(date).toISOString().slice(0, 10);
                chartDays.push({ date: key, views: byDate.get(key) || 0 });
            }
        }
        return {
            totalViews, articleCount: selected.length, publications,
            averageViews: activeDays ? totalViews / activeDays : 0,
            chartDays, statuses: this.statistics.statuses,
            ranking: [...selected].sort((a, b) => b.views - a.views).slice(0, 10)
        };
    }
}
