import { api, currentUser } from '../../data/api.js';

const dayKey = value => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(value));

// Matches the server's hourly bucket format ("YYYY-MM-DDTHH:00", Asia/Jerusalem) exactly.
const hourKey = value => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(value));
    const get = type => parts.find(part => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:00`;
};

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
    resetViews(articleId) {
        return this.request('/api/statistics/' + encodeURIComponent(articleId), { method: 'DELETE', body: {} });
    }

    // Sums the server's hourly buckets back up into daily ones, for every period except a single day.
    dailyViewsFrom(hourlyViews) {
        const byDate = new Map();
        for (const { hour, views } of hourlyViews) {
            const date = hour.slice(0, 10);
            byDate.set(date, (byDate.get(date) || 0) + views);
        }
        return [...byDate.entries()].map(([date, views]) => ({ date, views })).sort((a, b) => a.date < b.date ? -1 : 1);
    }

    getDashboard({ articleId = '', period = 'all' }, now = new Date()) {
        const selected = this.articles.filter(article => !articleId || article.id === articleId);
        const titles = new Map(this.articles.map(article => [article.id, article.title]));
        const today = dayKey(now);
        const isSingleDay = period === 'today';

        const chartDays = isSingleDay
            ? this.buildHourlyChart(today)
            : this.buildDailyChart(period, today);

        const cutoffKey = chartDays[0]?.date;
        const keyOf = isSingleDay ? hourKey : dayKey;

        const publications = this.statistics.publications
            .filter(item => item.publishedAt && (!cutoffKey || keyOf(item.publishedAt) >= cutoffKey) && dayKey(item.publishedAt) <= today)
            .map(item => ({ ...item, title: titles.get(item.articleId) || item.articleId }))
            .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        const versionChanges = (this.statistics.versionChanges || [])
            .filter(item => item.updatedAt && (!cutoffKey || keyOf(item.updatedAt) >= cutoffKey) && dayKey(item.updatedAt) <= today);

        const totalViews = chartDays.reduce((sum, entry) => sum + entry.views, 0);
        const activeBuckets = chartDays.filter(entry => entry.views > 0).length;

        return {
            totalViews, articleCount: selected.length, publications,
            averageViews: activeBuckets ? totalViews / activeBuckets : 0,
            chartDays, versionChanges, statuses: this.statistics.statuses, isSingleDay, keyOf,
            ranking: [...selected].sort((a, b) => b.views - a.views).slice(0, 10)
        };
    }

    buildDailyChart(period, today) {
        const dailyViews = this.dailyViewsFrom(this.statistics.hourlyViews || []);
        const cutoff = period === 'all' ? '' : new Date(Date.parse(today) - (Number(period) - 1) * 86400000).toISOString().slice(0, 10);
        const days = dailyViews.filter(day => (!cutoff || day.date >= cutoff) && day.date <= today);
        const chartDays = [];
        if (days.length) {
            const byDate = new Map(days.map(day => [day.date, day.views]));
            // Include zero-view days so gaps are not shown as continuous activity.
            for (let date = Date.parse(cutoff || days[0].date); date <= Date.parse(today); date += 86400000) {
                const key = new Date(date).toISOString().slice(0, 10);
                const views = byDate.get(key) || 0;
                const previous = chartDays.at(-1)?.totalViews || 0;
                chartDays.push({ date: key, views, totalViews: previous + views });
            }
        }
        return chartDays;
    }

    // Every hour of the selected day, including zero-view hours, so the shape of a single day's traffic is visible.
    buildHourlyChart(today) {
        const byHour = new Map((this.statistics.hourlyViews || []).map(entry => [entry.hour, entry.views]));
        const chartDays = [];
        for (let hour = 0; hour < 24; hour++) {
            const key = `${today}T${String(hour).padStart(2, '0')}:00`;
            const views = byHour.get(key) || 0;
            const previous = chartDays.at(-1)?.totalViews || 0;
            chartDays.push({ date: key, views, totalViews: previous + views });
        }
        return chartDays;
    }
}
