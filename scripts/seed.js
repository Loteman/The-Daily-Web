// Demo data generator: ~500 articles across reporters and an editor, in every status, some with
// multiple revisions, plus comments and view history so the feed, management screen and Impact
// Analytics graph all have realistic data to show. Dry-run by default; pass --apply to write.
// Re-runnable: everything it creates is tagged (articleId/idNumber prefixed "seed_") so --reset
// only removes its own previous output, never real data.
require('dotenv').config({ path: ['.env.local', '.env'], quiet: true });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const { randomUUID } = require('node:crypto');

const TARGET_ARTICLES = 500;
const SEED_PREFIX = 'seed_';
const DAY = 24 * 60 * 60 * 1000;

const REPORTERS = [
  { username: 'seed_reporter_1', fullName: 'נועה כהן' },
  { username: 'seed_reporter_2', fullName: 'איתי לוי' },
  { username: 'seed_reporter_3', fullName: 'מאיה ברק' },
  { username: 'seed_reporter_4', fullName: 'דניאל אזולאי' },
];
const EDITOR = { username: 'seed_editor_1', fullName: 'רון שגיא' };
const SEED_PASSWORD = 'Seed1234!';

const NEW_CATEGORIES = ['טכנולוגיה', 'בריאות', 'ספורט'];

const CATEGORY_CONTENT = {
  'אוכל': {
    topics: ['מטבח ביתי', 'בישול בסיר אחד', 'קינוחים פשוטים', 'שוק האוכל המקומי', 'תזונה ים תיכונית', 'אפייה ביתית', 'ירקות עונתיים', 'מטבח פתוח בבית'],
    titles: ['המדריך ל{topic}', '5 טיפים ל{topic}', 'איך מתחילים עם {topic}', 'הסוד מאחורי {topic}', 'כל מה שרציתם לדעת על {topic}', '{topic}: מה חשוב לדעת'],
    body: [
      'העניין ב{topic} גדל בשנים האחרונות, וכל מי שמתחיל מגלה שיש כמה כללי אצבע פשוטים שחוסכים הרבה טעויות.',
      'מומחים ממליצים להתחיל בקטן: לבחור מתכון אחד הקשור ל{topic} ולחזור עליו כמה פעמים לפני שעוברים הלאה.',
      'התזמון הוא לרוב ההבדל בין הצלחה לכישלון כשמדובר ב{topic} - כדאי לתכנן מראש את סדר הפעולות.',
      'לא צריך ציוד יקר כדי להתחיל עם {topic}; רוב האנשים כבר מחזיקים בבית את מה שנדרש.',
      'קהילות בישול מקוונות הפכו למקור מידע מרכזי בנושא {topic}, עם עשרות המלצות והתאמות אישיות.',
      'הטעות הנפוצה ביותר בתחום {topic} היא מיהור מדי בשלבים שדורשים סבלנות.',
    ],
  },
  'טיולים': {
    topics: ['טיול משפחתי', 'טרמפים בין ערים', 'תרמילאות בחו"ל', 'נופש בישראל', 'טיסות זולות', 'קמפינג בטבע', 'סופ"ש קצר', 'תכנון מסלול טיול'],
    titles: ['מדריך ל{topic}', 'איך לחסוך כסף ב{topic}', 'הדרך הנכונה ל{topic}', 'כל מה שצריך לדעת לפני {topic}', '{topic}: הטעויות שכדאי להימנע מהן', '7 רעיונות ל{topic}'],
    body: [
      'תכנון מוקדם הוא המפתח להצלחה של {topic}, במיוחד כשמדובר בתקציב מוגבל.',
      'רבים מגלים שהחוויה הטובה ביותר ב{topic} מגיעה דווקא מהרגעים הבלתי מתוכננים.',
      'כדאי לבדוק מזג אוויר ותנאי דרכים לפני שיוצאים ל{topic}, כדי להימנע מהפתעות.',
      'חבילת ציוד מינימלית מספיקה ברוב המקרים של {topic} - עומס מיותר רק מכביד.',
      'מקומיים הם המקור הטוב ביותר להמלצות אמיתיות כשמתכננים {topic}.',
      'שמירה על גמישות בלו"ז הופכת כל {topic} לפחות מלחיץ ויותר מהנה.',
    ],
  },
  'פוליטיקה': {
    topics: ['הדיון הציבורי', 'רפורמה מקומית', 'תקציב המדינה', 'בחירות מקומיות', 'שקיפות ממשלתית', 'מדיניות רווחה', 'יחסים בין רשויות', 'חקיקה חדשה'],
    titles: ['ניתוח: {topic}', 'מה עומד מאחורי {topic}', '{topic} בעין ביקורתית', 'הפולמוס סביב {topic}', 'מבט מעמיק על {topic}', '{topic}: השאלות שלא נשאלות'],
    body: [
      'לפני גיבוש עמדה בנושא {topic} כדאי לבדוק מי מציג את הטענה ועל אילו נתונים היא נשענת.',
      'הדיון סביב {topic} מתאפיין לרוב בקיטוב, אך הפרטים המספריים מספרים סיפור מורכב יותר.',
      'גורמים המעורים בנושא {topic} מציינים שההשלכות בפועל יתבהרו רק בטווח הארוך.',
      'סקרי דעת קהל אחרונים מראים פערים משמעותיים בעמדות הציבור כלפי {topic}.',
      'ועדות מקצועיות שדנו ב{topic} טרם פרסמו את מסקנותיהן הסופיות.',
      'ההבחנה בין עובדה, פרשנות והעדפה אישית חשובה במיוחד כשדנים ב{topic}.',
    ],
  },
  'טכנולוגיה': {
    topics: ['בינה מלאכותית', 'אבטחת מידע', 'עולם הסטארטאפים', 'עבודה מרחוק', 'מכשירים חכמים', 'רשתות חברתיות', 'מציאות מדומה', 'תשתיות ענן'],
    titles: ['{topic}: לאן זה הולך', 'המגמות החדשות ב{topic}', 'מה משתנה בעולם {topic}', 'מבט לעתיד: {topic}', '{topic} בשנה הקרובה', 'הסבר פשוט על {topic}'],
    body: [
      'הקצב שבו מתפתח תחום {topic} מקשה על משתמשים רגילים לעקוב אחרי כל שינוי.',
      'חברות מובילות משקיעות משאבים גדלים והולכים בתחום {topic}, מה שמאיץ את קצב החדשנות.',
      'מומחים מזהירים שגם בתחום {topic} יש לשקול את הסיכונים לצד ההזדמנויות.',
      'משתמשים ביתיים נהנים היום מיכולות ב{topic} שהיו שמורות פעם לארגונים גדולים בלבד.',
      'השאלה המרכזית בנוגע ל{topic} היא לא רק מה אפשר לעשות, אלא מה כדאי לעשות.',
      'סקר שנערך לאחרונה מצא עלייה משמעותית במודעות הציבור לנושא {topic}.',
    ],
  },
  'בריאות': {
    topics: ['שינה איכותית', 'תזונה מאוזנת', 'פעילות גופנית מתונה', 'בריאות הנפש', 'מניעה וגילוי מוקדם', 'ניהול לחץ', 'הרגלי בוקר', 'מנוחה ואיזון'],
    titles: ['איך משפרים {topic}', 'המדריך המלא ל{topic}', 'מה מומחים אומרים על {topic}', '5 הרגלים לשיפור {topic}', '{topic}: מיתוסים ועובדות', 'צעדים פשוטים לשיפור {topic}'],
    body: [
      'שינויים קטנים בשגרה היומית יכולים לתרום רבות לשיפור {topic}.',
      'גופי בריאות ממליצים לא להסתמך על פתרון קסם אחד כשמדובר ב{topic}.',
      'עקביות חשובה יותר מאינטנסיביות כשבונים הרגל חדש סביב {topic}.',
      'מחקרים עדכניים מחזקים את הקשר בין {topic} לבין איכות חיים כללית.',
      'כדאי להתייעץ עם גורם מקצועי לפני שינוי משמעותי הקשור ל{topic}.',
      'מעקב פשוט אחר ההתקדמות עוזר לשמור על מוטיבציה בנושא {topic}.',
    ],
  },
  'ספורט': {
    topics: ['כדורגל מקומי', 'ריצות עממיות', 'ליגת הכדורסל', 'אימוני כוח', 'ספורט נוער', 'אליפויות בינלאומיות', 'שיקום מפציעות', 'ספורט קהילתי'],
    titles: ['סיכום השבוע ב{topic}', 'מה קורה השבוע ב{topic}', '{topic}: התוצאות המלאות', 'מבט אל תוך {topic}', 'העונה של {topic}', 'הכל על {topic} החודש'],
    body: [
      'העונה האחרונה ב{topic} הפתיעה גם את הפרשנים הוותיקים ביותר.',
      'שחקנים צעירים מתחילים לתפוס מקום מרכזי בתחום {topic}.',
      'קהל האוהדים של {topic} גדל בהתמדה בשנים האחרונות.',
      'מאמנים בכירים מדגישים את חשיבות ההכנה הגופנית לקראת {topic}.',
      'תקציבים גדלים מאפשרים השקעה משמעותית יותר בתשתיות {topic}.',
      'הביצועים האחרונים ב{topic} מעלים שאלות לקראת העונה הבאה.',
    ],
  },
};

function pick(array, random) { return array[Math.floor(random() * array.length)]; }
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildArticleContent(category, index, random) {
  const bank = CATEGORY_CONTENT[category];
  const topic = pick(bank.topics, random);
  const title = pick(bank.titles, random).replace('{topic}', topic) + (random() < 0.15 ? ` (חלק ${1 + Math.floor(random() * 3)})` : '');
  const shuffledBody = [...bank.body].sort(() => random() - 0.5);
  const paragraphs = shuffledBody.slice(0, 2 + Math.floor(random() * 2)).map(text => text.replace(/\{topic\}/g, topic));
  const summary = paragraphs[0];
  const content = [`כתבה מספר ${index} בנושא ${topic}.`, ...paragraphs].join('\n\n');
  return { title, summary, content, topic };
}

async function ensureUser(db, { username, fullName }, userType, apply) {
  const existing = await db.collection('Users').findOne({ username });
  if (existing) return existing;
  const idNumber = SEED_PREFIX + randomUUID();
  const doc = { idNumber, username, fullName, userType, passwordHash: await bcrypt.hash(SEED_PASSWORD, 10) };
  if (apply) await db.collection('Users').insertOne(doc);
  return doc;
}

async function ensureCategories(db, apply) {
  const doc = await db.collection('Categories').findOne({});
  const entries = Object.entries(doc).filter(([key]) => key !== '_id');
  let maxId = Math.max(0, ...entries.map(([, value]) => Number(value)));
  const toAdd = {};
  for (const name of NEW_CATEGORIES) {
    if (!(name in doc)) toAdd[name] = ++maxId;
  }
  if (Object.keys(toAdd).length && apply) {
    await db.collection('Categories').updateOne({ _id: doc._id }, { $set: toAdd });
  }
  const merged = { ...Object.fromEntries(entries), ...toAdd };
  return Object.entries(merged).map(([name, id]) => ({ id, name }));
}

function randomDateWithin(random, daysAgoMax, daysAgoMin = 0) {
  const span = (daysAgoMax - daysAgoMin) * DAY;
  return new Date(Date.now() - daysAgoMin * DAY - random() * span);
}

async function main() {
  const apply = process.argv.includes('--apply');
  const reset = process.argv.includes('--reset');
  await require('../config/db')();
  const db = mongoose.connection.db;
  const random = mulberry32(20260925);

  if (reset) {
    const counts = await Promise.all([
      db.collection('Views').deleteMany({ articleId: { $regex: '^art_' + SEED_PREFIX } }),
      db.collection('Commnents').deleteMany({ articleId: { $regex: '^art_' + SEED_PREFIX } }),
      db.collection('Updates').deleteMany({ articleId: { $regex: '^art_' + SEED_PREFIX } }),
      db.collection('Articles').deleteMany({ articleId: { $regex: '^art_' + SEED_PREFIX } }),
    ].map(p => apply ? p : Promise.resolve({ deletedCount: 'dry-run' })));
    console.log('Reset (previous seed data only):', JSON.stringify(counts.map(c => c.deletedCount)));
    if (!apply) return;
  }

  const existingSeedCount = await db.collection('Articles').countDocuments({ articleId: { $regex: '^art_' + SEED_PREFIX } });
  if (existingSeedCount > 0 && !reset) {
    console.log(`${existingSeedCount} seed articles already exist. Run with --reset --apply to regenerate.`);
    return;
  }

  const categories = await ensureCategories(db, apply);
  const categoryNames = Object.keys(CATEGORY_CONTENT);

  const reporters = [];
  for (const reporter of REPORTERS) reporters.push(await ensureUser(db, reporter, 1, apply));
  const editor = await ensureUser(db, EDITOR, 2, apply);

  const articles = [], updates = [], comments = [], views = [];
  const statusPlan = ['published', 'published', 'published', 'published', 'published', 'published', 'published', 'pending', 'draft', 'returned'];

  for (let i = 1; i <= TARGET_ARTICLES; i++) {
    const articleId = `art_${SEED_PREFIX}${String(i).padStart(4, '0')}`;
    const categoryName = pick(categoryNames, random);
    const category = categories.find(item => item.name === categoryName);
    const reporter = pick(reporters, random);
    const image = `https://picsum.photos/seed/${articleId}/1200/800`;
    const createdAt = randomDateWithin(random, 90, 30);
    const primaryStatus = pick(statusPlan, random);

    articles.push({
      articleId, title: '', reporterIdNumber: reporter.idNumber,
      categoryId: category.id, mainImage: image, createdAt: createdAt.toISOString(),
    });

    // v1: always a resolved version (published, or the article's only version if not published).
    const v1 = buildArticleContent(categoryName, i, random);
    const v1Status = primaryStatus === 'returned' ? 'returned' : primaryStatus === 'draft' ? 'draft'
      : primaryStatus === 'pending' ? 'pending' : 'published';
    const v1UpdatedAt = new Date(createdAt.getTime() + random() * 6 * DAY);
    const v1PublishedAt = v1Status === 'published' ? new Date(v1UpdatedAt.getTime() + random() * DAY) : null;
    articles[articles.length - 1].title = v1.title;
    updates.push({
      updateId: `upd_${SEED_PREFIX}${randomUUID()}`, articleId, version: 1,
      title: v1.title, categoryId: category.id, mainImage: image,
      summary: v1.summary, content: v1.content, status: v1Status,
      editorNote: v1Status === 'returned' ? 'יש להרחיב את התוכן ולהוסיף מקורות.' : '',
      updatedAt: v1UpdatedAt.toISOString(), publishedAt: v1PublishedAt ? v1PublishedAt.toISOString() : null,
    });

    // ~18% of published articles also get a second (and occasionally third) revision in progress,
    // so the management screen's old/new version toggle has real multi-version articles to show.
    if (v1Status === 'published' && random() < 0.18) {
      const v2 = buildArticleContent(categoryName, i, random);
      const v2Status = pick(['draft', 'pending', 'returned', 'published'], random);
      const v2UpdatedAt = new Date((v1PublishedAt || v1UpdatedAt).getTime() + DAY + random() * 20 * DAY);
      const v2PublishedAt = v2Status === 'published' ? new Date(v2UpdatedAt.getTime() + random() * DAY) : null;
      updates.push({
        updateId: `upd_${SEED_PREFIX}${randomUUID()}`, articleId, version: 2,
        title: v2.title, categoryId: category.id, mainImage: image,
        summary: v2.summary, content: v2.content, status: v2Status,
        editorNote: v2Status === 'returned' ? 'נדרשים תיקונים לפני פרסום מחדש.' : '',
        updatedAt: v2UpdatedAt.toISOString(), publishedAt: v2PublishedAt ? v2PublishedAt.toISOString() : null,
      });
      if (v2Status === 'published' && random() < 0.25) {
        const v3 = buildArticleContent(categoryName, i, random);
        const v3UpdatedAt = new Date(v2PublishedAt.getTime() + DAY + random() * 15 * DAY);
        updates.push({
          updateId: `upd_${SEED_PREFIX}${randomUUID()}`, articleId, version: 3,
          title: v3.title, categoryId: category.id, mainImage: image,
          summary: v3.summary, content: v3.content, status: 'draft', editorNote: '',
          updatedAt: v3UpdatedAt.toISOString(), publishedAt: null,
        });
      }
    }

    // Comments and views only make sense for articles readers could actually see.
    if (v1Status === 'published') {
      const commentCount = random() < 0.6 ? Math.floor(random() * 5) : 0;
      for (let c = 0; c < commentCount; c++) {
        const isGuest = random() < 0.3;
        comments.push({
          commentId: `com_${SEED_PREFIX}${randomUUID()}`, articleId,
          idNumber: isGuest ? null : pick(reporters, random).idNumber,
          fullName: isGuest ? pick(['אורח/ת', 'קורא/ת', 'מבקר/ת'], random) : pick(reporters, random).fullName,
          content: pick(['כתבה מעניינת, תודה!', 'הייתי שמח לקרוא עוד בנושא.', 'לא הסכמתי עם כל הנקודות אבל כן מעניין.', 'תודה על הסיקור המפורט.', 'חבל שלא הרחבתם יותר.'], random),
          createdAt: new Date((v1PublishedAt || createdAt).getTime() + random() * 20 * DAY).toISOString(),
        });
      }
      // Popularity varies a lot so the "most viewed" ranking has a real long tail.
      const popularity = random() < 0.1 ? 200 + random() * 400 : random() < 0.3 ? 40 + random() * 100 : random() * 30;
      const viewCount = Math.floor(popularity);
      const viewStart = (v1PublishedAt || createdAt).getTime();
      const viewSpan = Math.max(Date.now() - viewStart, DAY);
      for (let v = 0; v < viewCount; v++) {
        const isGuest = random() < 0.4;
        views.push({
          viewId: `view_${SEED_PREFIX}${randomUUID()}`, articleId,
          idNumber: isGuest ? null : pick(reporters, random).idNumber,
          viewedAt: new Date(viewStart + random() * viewSpan).toISOString(),
        });
      }
    }
  }

  console.log(JSON.stringify({
    database: db.databaseName, articles: articles.length, updates: updates.length,
    comments: comments.length, views: views.length,
    categories: categories.map(c => c.name), reporters: reporters.map(r => r.username), editor: editor.username,
  }, null, 2));
  if (!apply) { console.log('Dry run only. Re-run with --apply to write.'); return; }

  async function insertBatched(collection, docs, size = 1000) {
    for (let i = 0; i < docs.length; i += size) await db.collection(collection).insertMany(docs.slice(i, i + size));
  }
  await insertBatched('Articles', articles);
  await insertBatched('Updates', updates);
  if (comments.length) await insertBatched('Commnents', comments);
  if (views.length) await insertBatched('Views', views);

  console.log(JSON.stringify({
    inserted: { articles: articles.length, updates: updates.length, comments: comments.length, views: views.length },
    totalArticlesInDb: await db.collection('Articles').countDocuments(),
  }));
}

main().catch(error => { console.error(error.name, error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
