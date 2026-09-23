import { ArticleRepository } from '../data/articleRepository.js';
import { currentUser } from '../data/api.js';

export class ArticleModel 
{
    constructor(repository = new ArticleRepository())
    {
        this.weatherApiKey = 'ca7e198fa478ce43e107cc122973e064';
        this.mockWeatherData = {
            location: "👤 שגיאה בטעינת מזג האוויר",
            currentTemp: "0°",
            condition: "לא ידוע",
            icon: "☀️",
        };
        this.repository = repository;
        this.articleData = null;
        this.relatedPosts = [];
        this.comments = [];
    }

    async loadArticle(id)
    {
        this.articleData = await this.repository.getById(id);
        if (!this.articleData)
            return null;

        const articles = await this.repository.getAll();
        this.relatedPosts = articles
            .filter(article => String(article.id) !== String(id) && article.category === this.articleData.category)
            .slice(0, 3);
        this.comments = await this.repository.getComments(id);
        this.user = await currentUser();
        return this.articleData;
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

    async fetchWeather() 
    {
        try {
            const ipResponse = await fetch('https://ipinfo.io/json');
            if (!ipResponse.ok) 
                throw new Error('שגיאה באיתור המיקום האוטומטי');
            
            const ipData = await ipResponse.json();
            const cityName = ipData.city || 'Petah Tikva';

            const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${this.weatherApiKey}&units=metric&lang=he`;
            const weatherResponse = await fetch(weatherUrl);
            if (!weatherResponse.ok) 
                throw new Error('שגיאה בטעינת מזג האוויר');

            const data = await weatherResponse.json();
            return {
                location: `👤 ${data.name}`,
                currentTemp: Math.round(data.main.temp) + '°',
                condition: data.weather[0].description,
                icon: this.getWeatherIcon(data.weather[0].icon)
            };
        } 
        catch (error) 
        {
            console.error('תקלה בזיהוי המיקום:', error);
            return this.mockWeatherData;
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
}
