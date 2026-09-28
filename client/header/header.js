import { api, currentUser } from '../data/api.js';

const HEADER_HTML_CACHE_KEY = 'header-html-v1';
const HEADER_USER_CACHE_KEY = 'header-user-v1';

// The header markup itself never changes between pages or users (only the username/role-based
// visibility toggled below does) - after the first page load in this tab, reuse it from
// sessionStorage instead of re-fetching and re-rendering the same fragment on every navigation.
async function loadHeaderHtml() {
    try {
        const cached = sessionStorage.getItem(HEADER_HTML_CACHE_KEY);
        if (cached) return cached;
    } catch { /* sessionStorage unavailable (private mode, etc.) - fall through to fetch */ }
    const response = await fetch('/header/index.html');
    if (!response.ok) throw new Error('Could not load the header.');
    const html = await response.text();
    try { sessionStorage.setItem(HEADER_HTML_CACHE_KEY, html); } catch { /* best effort */ }
    return html;
}

async function loadHeader() {
    try {
        // Fetched in parallel so the username and menu permissions are already known before the header
        // renders, instead of briefly showing a stale guest/previous state and then swapping it (a flash when switching users).
        const [html, user] = await Promise.all([loadHeaderHtml(), currentUser()]);
        const header = document.querySelector('.header');
        header.innerHTML = html;
        header.querySelector('.user-name').textContent = user?.fullName || user?.username || 'Guest';
        header.querySelector('.login-link').hidden = Boolean(user);
        header.querySelectorAll('[data-logged-in]').forEach(item => { item.hidden = !user; });
        header.querySelectorAll('[data-editor-only]').forEach(item => { item.hidden = user?.role !== 'editor'; });
        // Remembered so the next page's inline script (see index.html) can show the right nav items
        // immediately instead of starting from the "guest" defaults and popping the rest in a moment later.
        try { sessionStorage.setItem(HEADER_USER_CACHE_KEY, JSON.stringify(user || null)); } catch { /* best effort */ }
        header.querySelector('.logout-link').addEventListener('click', async event => {
            event.preventDefault();
            try {
                await api('/api/auth/logout', { method: 'POST', body: {} });
                sessionStorage.removeItem('username');
                sessionStorage.removeItem('role');
                try { sessionStorage.removeItem(HEADER_USER_CACHE_KEY); } catch { /* best effort */ }
                window.location.href = '/articlesFeed/index.html';
            } catch (error) {
                header.querySelector('.user-name').textContent = error.message;
            }
        });
    } catch (error) { console.error('Header loading failed:', error); }
}
loadHeader();
