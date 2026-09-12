export class ArticleModel 
{
    constructor() 
    {
        this.weatherApiKey = 'ca7e198fa478ce43e107cc122973e064';
        this.mockWeatherData = {
            location: "👤 שגיאה בטעינת מזג האוויר",
            currentTemp: "0°",
            condition: "לא ידוע",
            icon: "☀️",
        };
        this.articleData = {
            category: "עולם",
            title: "פסגת האקלים העולמית: הישגים חדשים לשנת 2026",
            summary: "ראשי מדינות מרכזיות סיכמו על צעדים דרמטיים לצמצום פליטות הפחמן, תוך הקצאת משאבים אדירים למעבר לאנרגיה ירוקה.",
            author: "דור כהן",
            date: "20.07.2025",
            paragraphs: [
                "זהו טקסט דמה מלא ומעמיק לכתבה. כאן יופיע תוכן הכתבה המלא, עם פסקאות שמסבירות את הנושא בצורה ברורה ומפורטת כדי לתת חוויית קריאה מושלמת לגולשים.",
                "בהמשך הדיונים, הדגישו המומחים כי שיתוף הפעולה בין המגזר הפרטי לציבורי יהיה קריטי להצלחת היעדים החדשים, וימנע משבר אקלימי חמור בעשורים הקרובים.",
                "בסיום הכתבה ניתן לראות כיצד השפעות אלו מתחילות לבוא לידי ביטוי גם בכלכלות מקומיות ובשוק התעסוקה הגלובלי."
            ]
        };
        this.relatedPosts = [
            { id: 1, category: "עולם", categoryClass: "tag-blue", title: "פסגת האקלים: מדינות חדשות על יעד חדש", date: "20.07.2025" },
            { id: 2, category: "סביבה", categoryClass: "tag-green", title: "הטכנולוגיה שמצילה את היערות בעולם", date: "19.07.2025" },
            { id: 3, category: "טכנולוגיה", categoryClass: "tag-purple", title: "בינה מלאכותית משנה את שוק העבודה...", date: "18.07.2025" }
        ];
        this.comments = [
            { id: 1, name: "נועה ברק", date: "20.07.2025", text: "כתבה מעולה! נותנת זווית חדשה על הנושא." },
            { id: 2, name: "עידן כהן", date: "19.07.2025", text: "תודה על הכתבה המפורטת והמקיפה." },
            { id: 3, name: "מיכל רוזן", date: "18.07.2025", text: "מעניין מאוד, מחכה לעדכונים נוספים בנושא." }
        ];
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

    addComment(commentObj) 
    {
        return new Promise((resolve) => {
            setTimeout(() => {
                this.comments.unshift(commentObj);
                resolve(this.comments);
            }, 300);
        });
    }
}