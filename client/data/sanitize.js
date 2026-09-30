import DOMPurify from '/vendor/dompurify/purify.es.mjs';

// מנקה מחרוזת HTML לפני שהיא נכנסת לדף: מסיר סקריפטים, אירועים (onclick, onerror) וכו'.
export function safeHTML(html) {
    return DOMPurify.sanitize(html);
}

// שורות טבלה: ניקוי של "<td>...</td>" לבד יגרום לאיבוד תגיות ה-<td>. 
// לכן התאים מנוקים בתוך מבנה טבלה זמני ואז הילדים מועברים לשורה האמיתית.
export function setRowHTML(tr, cellsHtml) {
    const fragment = DOMPurify.sanitize(`<table><tbody><tr>${cellsHtml}</tr></tbody></table>`, { RETURN_DOM_FRAGMENT: true });
    tr.replaceChildren(...fragment.querySelector('tr').childNodes);
}





