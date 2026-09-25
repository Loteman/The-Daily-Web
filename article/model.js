import { ArticleRepository } from '../data/articleRepository.js';
import { currentUser } from '../data/api.js';

export class ArticleModel 
{
    constructor(repository = new ArticleRepository(), getUser = currentUser)
    {
        this.weatherApiKey = 'ca7e198fa478ce43e107cc122973e064';
        this.mockWeatherData = {
            location: "👤 שגיאה בטעינת מזג האוויר",
            currentTemp: "0°",
            condition: "לא ידוע",
            icon: "☀️",
        };
        // Falls back to Rishon LeZion only if the browser couldn't detect the real location (or the user declined).
        this.fallbackCoordinates = { lat: 31.9730, lon: 34.8066, name: 'ראשון לציון' };
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
            if (!globalThis.navigator?.geolocation)
            {
                resolve(this.fallbackCoordinates);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                position => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
                () => resolve(this.fallbackCoordinates),
                { timeout: 10000, maximumAge: 60000 }
            );
        });
    }

    async fetchWeather()
    {
        try
        {
            const { lat, lon, name } = await this.getUserCoordinates();
            const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=he&appid=${this.weatherApiKey}`;
            const weatherResponse = await fetch(weatherUrl);

            if (!weatherResponse.ok)
                throw new Error('שגיאה בטעינת מזג האוויר');

            const data = await weatherResponse.json();
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
