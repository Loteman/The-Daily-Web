
export class ArticlesManagementModel 
{
    constructor() 
    {
        this.currentUser = {
            name: "דנה כהן",
            role: "כותבת תוכן",
            avatar: "👤"
        };

        this.categories = ["כל הקטגוריות", "טכנולוגיה", "עסקים", "חדשות", "חברה", "בריאות"];
        this.statuses = ["כל הסטטוסים", "בהכנה", "ממתינה לאישור", "פורסמה", "הוחזרה לתיקונים"];

        this.articles = [
            {
                id: 1,
                title: "העתיד של בינה מלאכותית בעולם העבודה",
                subtitle: "איך AI משנה את הדרך בה אנחנו עובדים, ומה זה...",
                category: "טכנולוגיה",
                status: "draft",
                statusText: "בהכנה",
                badgeClass: "badge-blue",
                thumbClass: "thumb-robot",
                date: "15 באפר' 2024",
                time: "10:24",
                actionType: "edit",
                actionText: "✏️ עריכה"
            },
            {
                id: 2,
                title: "5 טיפים לצמיחה עסקית בעידן הדיגיטלי",
                subtitle: "כלים פרקטיים שיעזרו לעסקים קטנים לגדול...",
                category: "עסקים",
                status: "pending",
                statusText: "ממתינה לאישור",
                badgeClass: "badge-orange",
                thumbClass: "thumb-laptop",
                date: "14 באפר' 2024",
                time: "16:32",
                actionType: "send",
                actionText: "✈️ שליחה לאישור"
            },
            {
                id: 3,
                title: "שוק העבודה הישראלי: מגמות לשנת 2024",
                subtitle: "סקירה מקיפה של המגמות המרכזיות בשוק העבודה...",
                category: "חדשות",
                status: "published",
                statusText: "פורסמה",
                badgeClass: "badge-green",
                thumbClass: "thumb-city",
                date: "12 באפר' 2024",
                time: "09:15",
                actionType: "view",
                actionText: "👁️ צפייה"
            },
            {
                id: 4,
                title: "איך יוצרים איזון בין עבודה לחיים פרטיים",
                subtitle: "מבט מעמיק על האתגרים והפתרונות בעולם המודרני...",
                category: "חברה",
                status: "returned",
                statusText: "הוחזרה לתיקונים",
                badgeClass: "badge-red",
                thumbClass: "thumb-person",
                date: "10 באפר' 2024",
                time: "14:20",
                actionType: "edit",
                actionText: "✏️ עריכה"
            },
            {
                id: 5,
                    title: "המדריך המלא לאורח חיים בריא יותר",
                subtitle: "צעדים קטנים שעושים הבדל גדול – הבריאות מתחילה...",
                category: "בריאות",
                status: "draft",
                statusText: "בהכנה",
                badgeClass: "badge-blue",
                thumbClass: "thumb-food",
                date: "8 באפר' 2024",
                time: "11:07",
                actionType: "comment",
                actionText: "💬 הערת עורך"
            },
            {
                id: 6,
                title: "המדריך למתחילים בפיתוח תוכנה",
                subtitle: "צעדים ראשונים בעולם הקוד והתכנות...",
                category: "טכנולוגיה",
                status: "draft",
                statusText: "בהכנה",
                badgeClass: "badge-blue",
                thumbClass: "thumb-robot",
                date: "5 באפר' 2024",
                time: "12:00",
                actionType: "edit",
                actionText: "✏️ עריכה"
            }
        ];
    }

    async getUserProfile() 
    {
        return Promise.resolve(this.currentUser);
    }

    async getFilterOptions() 
    {
        return Promise.resolve({
            categories: this.categories,
            statuses: this.statuses
        });
    }

    async getArticles() 
    {
        return Promise.resolve(this.articles);
    }

    // חישוב דינמי של סטטיסטיקות מתוך מערך הכתבות
    async calculateStats() 
    {
        const stats = {
            draft: 0,
            pending: 0,
            published: 0,
            returned: 0
        };

        this.articles.forEach(article => {
            if (stats.hasOwnProperty(article.status)) {
                stats[article.status]++;
            }
        });

        return Promise.resolve(stats);
    }
}