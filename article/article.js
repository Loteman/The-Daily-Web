/**
 * --------------------------------------------------------------------------
 * QUERY SELECTORS
 * --------------------------------------------------------------------------
 */
const weatherLocationEl = document.querySelector('.weather-location');
const temperatureEl = document.querySelector('.temperature');
const conditionEl = document.querySelector('.condition');
const weatherIconEl = document.querySelector('.weather-icon');

const articleBigCategoryEl = document.querySelector('.article-section .tag-blue-big');
const articleTitleEl = document.querySelector('.article-title');
const articleSummaryEl = document.querySelector('.article-summary');
const authorSpanEl = document.querySelector('.article-details .author span');
const dateSpanEl = document.querySelector('.article-details .date span');
const categoryDetailSpanEl = document.querySelector('.article-details .category-detail span');
const articleParagraphsEls = document.querySelectorAll('.article-section .article-text');

const relatedPostsWidgetEl = document.querySelector('.related-posts-widget');
const commentsSectionEl = document.querySelector('.comments-section');
const commentFormEl = document.querySelector('.add-comment form');
const commentTextareaEl = document.querySelector('.add-comment textarea');
const commentAuthorInputEl = document.querySelector('.add-comment input[type="text"]');
const addCommentTitleEl = document.querySelector('.add-comment h2');

// יצירת אלמנט קבוע להודעות (שגיאה או הצלחה) ליד הכותרת
let formMsgEl = document.querySelector('.form-msg');
if (!formMsgEl && addCommentTitleEl) {
    formMsgEl = document.createElement('span');
    formMsgEl.className = 'form-msg';
    formMsgEl.style.fontSize = '0.85rem';
    formMsgEl.style.fontWeight = 'normal';
    formMsgEl.style.marginRight = '12px';
    formMsgEl.style.visibility = 'hidden';
    addCommentTitleEl.appendChild(formMsgEl);
}

/**
 * --------------------------------------------------------------------------
 * MOCK DATA
 * --------------------------------------------------------------------------
 */
const mockWeatherData = {
    location: "👤 שגיאה בטעינת מזג האוויר",
    currentTemp: "0°",
    condition: "לא ידוע",
    icon: "☀️",
};

const mockArticleData = {
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

const mockRelatedPosts = [
    { id: 1, category: "עולם", categoryClass: "tag-blue", title: "פסגת האקלים: מדינות חדשות על יעד חדש", date: "20.07.2025" },
    { id: 2, category: "סביבה", categoryClass: "tag-green", title: "הטכנולוגיה שמצילה את היערות בעולם", date: "19.07.2025" },
    { id: 3, category: "טכנולוגיה", categoryClass: "tag-purple", title: "בינה מלאכותית משנה את שוק העבודה...", date: "18.07.2025" }
];

let mockComments = [
    { id: 1, name: "נועה ברק", date: "20.07.2025", text: "כתבה מעולה! נותנת זווית חדשה על הנושא." },
    { id: 2, name: "עידן כהן", date: "19.07.2025", text: "תודה על הכתבה המפורטת והמקיפה." },
    { id: 3, name: "מיכל רוזן", date: "18.07.2025", text: "מעניין מאוד, מחכה לעדכונים נוספים בנושא." }
];

/**
 * --------------------------------------------------------------------------
 * FUNCTIONS
 * --------------------------------------------------------------------------
 */

function sanitizeInput(str) {
    const tempDiv = document.createElement('div');
    tempDiv.textContent = str;
    return tempDiv.innerHTML;
}

function getWeatherIcon(iconCode) {
    switch (iconCode) {
        case '01d': case '01n': return '☀️'; // שמים בהירים
        case '02d': case '02n': return '⛅'; // מעונן חלקית
        case '03d': case '03n': case '04d': case '04n': return '☁️'; // מעונן
        case '09d': case '09n': case '10d': case '10n': return '🌧️'; // גשם
        case '11d': case '11n': return '⛈️'; // סופת רעמים
        case '13d': case '13n': return '❄️'; // שלג
        case '50d': case '50n': return '🌫️'; // ערפל
        default: return '☀️'; // ברירת מחדל
    }
}

async function fetchWeatherByAutoLocation() {
    const apiKey = 'ca7e198fa478ce43e107cc122973e064';

    try {
        // שלב 1: זיהוי מיקום אוטומטי לפי IP של המשתמש
        const ipResponse = await fetch('https://ipinfo.io/json');
        if (!ipResponse.ok) 
            throw new Error('שגיאה באיתור המיקום האוטומטי');
        
        const ipData = await ipResponse.json();
        const cityName = ipData.city || 'Petah Tikva'; // ברירת מחדל אם הזיהוי נכשל

        // שלב 2: קבלת נתוני מזג האוויר לפי העיר שזוהתה
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&appid=${apiKey}&units=metric&lang=he`;
        const weatherResponse = await fetch(weatherUrl);
        if (!weatherResponse.ok) 
            throw new Error('שגיאה בטעינת מזג האוויר');

        const data = await weatherResponse.json();
        const rawIconCode = data.weather[0].icon;
        
        // התאמת שם העיר לעברית או הצגת השם הלועזי שחזר מהשרת
        const liveWeatherData = {
            location: `👤 ${data.name}`,
            currentTemp: Math.round(data.main.temp) + '°',
            condition: data.weather[0].description,
            icon: getWeatherIcon(rawIconCode)
        };

        renderWeatherData(liveWeatherData);

    } 
    catch (error) 
    {
        console.error('תקלה בזיהוי המיקום האוטומטי, טוען נתוני גיבוי:', error);
        renderWeatherData(mockWeatherData); // נפילה חזרה לנתוני הדמה במקרה של תקלת רשת
    }
}


function renderWeatherData(data) {
    if (weatherLocationEl)
        weatherLocationEl.textContent = data.location;
    if (temperatureEl)
        temperatureEl.textContent = data.currentTemp;
    if (conditionEl) 
        conditionEl.textContent = data.condition;
    if (weatherIconEl) 
        weatherIconEl.textContent = data.icon;

    
}

function renderArticle(article) {
    if (articleBigCategoryEl) 
        articleBigCategoryEl.textContent = article.category;
    if (articleTitleEl) 
        articleTitleEl.textContent = article.title;
    if (articleSummaryEl) 
        articleSummaryEl.textContent = article.summary;
    if (authorSpanEl) 
        authorSpanEl.textContent = article.author;
    if (dateSpanEl) 
        dateSpanEl.textContent = article.date;
    if (categoryDetailSpanEl) 
        categoryDetailSpanEl.textContent = article.category;

    if (articleParagraphsEls.length > 0) {
        articleParagraphsEls.forEach((pEl, index) => {
            if (article.paragraphs[index]) {
                pEl.textContent = article.paragraphs[index];
            }
        });
    }
}

function renderRelatedPosts(posts) {
    if (!relatedPostsWidgetEl) return;
    
    const headerEl = relatedPostsWidgetEl.querySelector('.widget-header');
    let postsHtml = headerEl ? headerEl.outerHTML : '<div class="widget-header"><h3>כתבות נוספות</h3><a href="#" class="see-all"> הצג הכל←</a></div>';
    
    posts.forEach(post => {
        postsHtml += `
            <div class="related-post" data-id="${post.id}">
                <div class="post-meta">
                    <span class="category ${post.categoryClass}">${post.category}</span>
                    <p class="post-title">${post.title}</p>
                    <span class="post-date">${post.date}</span>
                </div>
                <div class="post-thumb-placeholder"></div>
            </div>
        `;
    });
    
    relatedPostsWidgetEl.innerHTML = postsHtml;
}

function renderComments(comments) {
    if (!commentsSectionEl) return;
    
    let commentsHtml = `<h2>תגובות (${comments.length})</h2>`;
    
    comments.forEach(comment => {
        commentsHtml += `
            <div class="comment" data-id="${comment.id}">
                <div class="avatar">👤</div>
                <div class="comment-content">
                    <div class="comment-details">
                        <span class="user-name">${sanitizeInput(comment.name)}</span>
                        <span class="comment-date">${comment.date}</span>
                    </div>
                    <p class="comment-text">${sanitizeInput(comment.text)}</p>
                </div>
            </div>
        `;
    });
    
    commentsSectionEl.innerHTML = commentsHtml;
}

function showFormError(message, targetField) {
    if (!formMsgEl) return;
    
    if (commentAuthorInputEl) 
        commentAuthorInputEl.style.borderColor = '';
    if (commentTextareaEl) 
        commentTextareaEl.style.borderColor = '';
    
    if (targetField === 'author' && commentAuthorInputEl) {
        commentAuthorInputEl.style.borderColor = '#dc2626';
        commentAuthorInputEl.focus();
    } 
    if (targetField === 'text' && commentTextareaEl) {
        commentTextareaEl.style.borderColor = '#dc2626';
        commentTextareaEl.focus();
    }
    
    formMsgEl.style.color = '#dc2626';
    formMsgEl.textContent = message;
    formMsgEl.style.visibility = 'visible';
}

function showFormSuccess(message) 
{
    if (!formMsgEl) return;
    
    if (commentAuthorInputEl) 
        commentAuthorInputEl.style.borderColor = '';
    if (commentTextareaEl) 
        commentTextareaEl.style.borderColor = '';
    
    formMsgEl.style.color = '#16a34a'; 
    formMsgEl.textContent = message;
    formMsgEl.style.visibility = 'visible';

    setTimeout(() => {
        clearFormMsg();
    }, 5000);
}

function clearFormMsg() {
    if (!formMsgEl) return;
    formMsgEl.textContent = '';
    formMsgEl.style.visibility = 'hidden';
    if (commentAuthorInputEl) 
        commentAuthorInputEl.style.borderColor = '';
    if (commentTextareaEl) 
        commentTextareaEl.style.borderColor = '';
}

function handleCommentSubmit(event) {
    //מניעת ריענון בעת שליחה
    event.preventDefault();
    clearFormMsg();
    
    const author = commentAuthorInputEl ? commentAuthorInputEl.value.trim() : "";
    const text = commentTextareaEl ? commentTextareaEl.value.trim() : "";
    
    if (author.length < 2) {
        showFormError("נא להזין שם מלא תקין (לפחות 2 תווים).", 'author');
        return;
    }
    
    if (text.length < 3) {
        showFormError("תוכן התגובה קצר מדי (לפחות 3 תווים).", 'text');
        return;
    }
    
    const newComment = {
        id: Date.now(),
        name: author,
        date: new Date().toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        text: text
    };
    
    saveCommentToDB(newComment)
        .then(saved => {
            mockComments.unshift(saved);
            renderComments(mockComments);
            if (commentFormEl) commentFormEl.reset();
            showFormSuccess("התגובה נוספה בהצלחה!");
        })
        .catch(err => {
            console.error("שגיאה בשמירת התגובה:", err);
            showFormError("אירעה שגיאה בשליחת התגובה. נסה שוב שנית.", 'text');
        });
}

function saveCommentToDB(commentObj) 
{
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(commentObj);
        }, 300);
    });
}

/**
 * --------------------------------------------------------------------------
 * EVENT LISTENERS
 * --------------------------------------------------------------------------
 */
document.addEventListener('DOMContentLoaded', () => {
    fetchWeatherByAutoLocation();
    renderArticle(mockArticleData);
    renderRelatedPosts(mockRelatedPosts);
    renderComments(mockComments);
    commentFormEl.addEventListener('submit', handleCommentSubmit);

});