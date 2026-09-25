import { api, currentUser } from '../data/api.js';

async function loadHeader() {
    try {
        // Fetched in parallel so the username and menu permissions are already known before the header
        // renders, instead of briefly showing a stale guest/previous state and then swapping it (a flash when switching users).
        const [response, user] = await Promise.all([fetch('/header/index.html'), currentUser()]);
        if (!response.ok) throw new Error('Could not load the header.');
        const header = document.querySelector('.header');
        header.innerHTML = await response.text();
        header.querySelector('.user-name').textContent = user?.fullName || user?.username || 'Guest';
        header.querySelector('.login-link').parentElement.hidden = Boolean(user);
        header.querySelectorAll('[data-logged-in]').forEach(item => { item.hidden = !user; });
        header.querySelectorAll('[data-editor-only]').forEach(item => { item.hidden = user?.role !== 'editor'; });
        header.querySelector('.logout-link').addEventListener('click', async event => {
            event.preventDefault();
            try {
                await api('/api/auth/logout', { method: 'POST', body: {} });
                sessionStorage.removeItem('username');
                sessionStorage.removeItem('role');
                window.location.href = '/articlesFeed/index.html';
            } catch (error) {
                header.querySelector('.user-name').textContent = error.message;
            }
        });
    } catch (error) { console.error('Header loading failed:', error); }
}
loadHeader();
