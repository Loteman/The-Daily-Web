import { ArticleRepository } from '../data/articleRepository.js';
import { api, currentUser } from '../data/api.js';

export class ArticleModel 
{
    constructor(repository = new ArticleRepository(), getUser = currentUser)
    {
        // Shown when the weather can't be loaded: no temperature and no weather icon, so it can't pass for a reading.
        this.mockWeatherData = {
            location: "👤",
            currentTemp: "—",
            condition: "מזג האוויר אינו זמין כרגע",
            icon: "⚠️",
        };
        // Falls back to Rishon LeZion only if the browser couldn't detect the real location (or the user declined).
        this.fallbackCoordinates = { lat: 31.9730, lon: 34.8066, name: 'ראשון לציון' };
        // How long to wait for the browser's location, including a permission prompt the reader never answers.
        this.locationTimeoutMs = 8000;
        this.repository = repository;
        this.getUser = getUser;
        this.articleData = null;
        this.relatedPosts = [];
        this.comments = [];
    }

    async loadArticle(id)
    {
        this.articleData = await this.repository.getById(id);
        return this.articleData;
    }

    async loadRelatedPosts(id)
    {
        this.relatedPosts = await this.repository.getRelated(id, this.articleData.category, 3);
        return this.relatedPosts;
    }

    async loadComments(id)
    {
        this.comments = await this.repository.getComments(id);
        return this.comments;
    }

    async loadUser()
    {
        this.user = await this.getUser();
        return this.user;
    }

    getWeatherIcon(iconCode) 
    {
        switch (iconCode) {
            case '01d': case '01n': return '☀️';
            case '02d': case '02n': return '⛅';
            case '03d': case '03n': case '04d': case '04n': return '☁️';
            case '09d': case '09n': case '10d': case '10n': return '🌧️';
            case '11d': case '11n': return '⛈️';
            case '13d': case '13n': return '❄️';
            case '50d': case '50n': return '🌫️';
            default: return '☀️';
        }
    }

    async addComment(commentObj)
    {
         const comment = await this.repository.addComment(this.articleData.id, {
            fullName: commentObj.name, content: commentObj.text
        });
        this.comments.unshift(comment);
        return this.comments;
    }

    async editComment(commentId, text)
    {
        const updated = await this.repository.editComment(this.articleData.id, commentId, { content: text });
        this.comments = this.comments.map(comment => comment.id === commentId ? updated : comment);
        return this.comments;
    }

    async deleteComment(commentId)
    {
        await this.repository.deleteComment(this.articleData.id, commentId);
        this.comments = this.comments.filter(comment => comment.id !== commentId);
        return this.comments;
    }

    // Tries to get the real location from the browser (GPS/Wi-Fi); if unsupported, denied, or it fails/times out, falls back to Rishon LeZion.
    getUserCoordinates()
    {
        return new Promise(resolve => {
            const geolocation = globalThis.navigator?.geolocation;
            if (!geolocation)
            {
                resolve(this.fallbackCoordinates);
                return;
            }
            // geolocation's own timeout only starts once the reader allows access, so it can't end an unanswered prompt.
            const timer = setTimeout(() => resolve(this.fallbackCoordinates), this.locationTimeoutMs);
            const settle = coordinates => {
                clearTimeout(timer);
                resolve(coordinates);
            };
            geolocation.getCurrentPosition(
                position => settle({ lat: position.coords.latitude, lon: position.coords.longitude }),
                () => settle(this.fallbackCoordinates),
                { timeout: this.locationTimeoutMs, maximumAge: 60000 }
            );
        });
    }

    async fetchWeather()
    {
        try
        {
            const { lat, lon, name } = await this.getUserCoordinates();
            // The site's server asks the weather service (and keeps its key); the browser only sends its coordinates,
            // rounded to one decimal (about 11 km) as the server rounds them anyway, so the exact location stays here.
            const rounded = value => Math.round(value * 10) / 10;
            const data = await api('/api/weather?' + new URLSearchParams({ lat: rounded(lat), lon: rounded(lon) }));
            return {
                location: `👤 ${name || data.name}`,
                currentTemp: Math.round(data.main.temp) + '°',
                condition: data.weather[0].description,
                icon: this.getWeatherIcon(data.weather[0].icon)
            };
        }
        catch (error)
        {
            console.error('תקלה בטעינת מזג האוויר:', error);
            return this.mockWeatherData;
        }
    }
}
