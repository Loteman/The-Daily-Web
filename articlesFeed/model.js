export class ArticlesFeedModel 
{
    constructor() 
    {
        this.articles = [
            {
                id: 1,
                title: "כותרת כתבה לדוגמה",
                summary: "תקציר קצר של הכתבה יופיע כאן. זהו טקסט דמה להמחשה.",
                category: "עולם",
                author: "נועה ברק",
                date: "2025-07-18",
                views: 1200,
                isRead: false
            },
            {
                id: 2,
                title: "כותרת כתבה לדוגמה",
                summary: "תקציר קצר של הכתבה יופיע כאן. זהו טקסט דמה להמחשה.",
                category: "כלכלה",
                author: "עידן כהן",
                date: "2025-07-19",
                views: 3400,
                isRead: false
            },
            {
                id: 3,
                title: "כותרת כתבה לדוגמה",
                summary: "תקציר קצר של הכתבה יופיע כאן. זהו טקסט דמה להמחשה.",
                category: "טכנולוגיה",
                author: "דנה ישראלי",
                date: "2025-07-19",
                views: 890,
                isRead: false
            },
            {
                id: 4,
                title: "כותרת כתבה לדוגמה",
                summary: "תקציר קצר של הכתבה יופיע כאן. זהו טקסט דמה להמחשה.",
                category: "ספורט",
                author: "שרון לוי",
                date: "2025-07-20",
                views: 4500,
                isRead: false
            },
            {
                id: 5,
                title: "כותרת כתבה לדוגמה",
                summary: "תקציר קצר של הכתבה יופיע כאן. זהו טקסט דמה להמחשה.",
                category: "סביבה",
                author: "גל פרידמן",
                date: "2025-07-16",
                views: 600,
                isRead: false
            },
            {
                id: 6,
                title: "כותרת כתבה לדוגמה",
                summary: "תקציר קצר של הכתבה יופיע כאן. זהו טקסט דמה להמחשה.",
                category: "מדע",
                author: "רותם אביב",
                date: "2025-07-17",
                views: 2100,
                isRead: false
            },
            {
                id: 7,
                title: "כותרת כתבה לדוגמה",
                summary: "תקציר קצר של הכתבה יופיע כאן. זהו טקסט דמה להמחשה.",
                category: "תרבות",
                author: "איתי שפירא",
                date: "2025-07-17",
                views: 1500,
                isRead: false
            },
            {
                id: 8,
                title: "כותרת כתבה לדוגמה",
                summary: "תקציר קצר של הכתבה יופיע כאן. זהו טקסט דמה להמחשה.",
                category: "בריאות",
                author: "מיכל רוזן",
                date: "2025-07-18",
                views: 3100,
                isRead: false
            },
            {
                id: 9,
                title: "כתבה נוספת מהשרת - חדשנות",
                summary: "תקציר אודות חדשנות טכנולוגית ועולמית.",
                category: "טכנולוגיה",
                author: "יובל שרעבי",
                date: "2025-07-21",
                views: 950,
                isRead: false
            },
            {
                id: 10,
                title: "כתבה נוספת מהשרת - שווקים",
                summary: "ניתוח מצב השווקים הפיננסיים והכלכלה הגלובלית.",
                category: "כלכלה",
                author: "טלי גולן",
                date: "2025-07-22",
                views: 1800,
                isRead: false
            }
        ];
        
        localStorage.removeItem('catalog_read_states');
    }

    async getArticles(filters = {}, displayCount = 8) 
    {
        let result = [...this.articles];

        if (filters.category && filters.category !== 'הכל') 
            result = result.filter(article => article.category === filters.category);
        

        if (filters.status === 'נקראו') 
            result = result.filter(article => article.isRead);
        else if (filters.status === 'לא נקראו') 
            result = result.filter(article => !article.isRead);
        

        if (filters.sortBy === 'פופולריות') 
            result.sort((a, b) => b.views - a.views);
        
        else 
            result.sort((a, b) => new Date(b.date) - new Date(a.date));
        

        const paginatedResult = result.slice(0, displayCount);
        const hasMore = paginatedResult.length < result.length;

        return Promise.resolve({
            articles: paginatedResult,
            hasMore: hasMore
        });
    }

    async toggleReadStatus(id) 
    {
        const targetId = Number(id);
        this.articles.forEach(art => {
            if (art.id === targetId) 
                // אם היא כבר הייתה מסומנת, נבטל את הסימון, או נסמן אותה בלבד
                art.isRead = !art.isRead;
            else 
                art.isRead = false; // כל השאר לא מסומנות
            
        });
        return Promise.resolve();
    }
}