import { api, currentUser } from '../data/api.js';

async function loadHeader() {
    try {
        // נשלף במקביל: כך שם המשתמש והרשאות התפריט כבר ידועים לפני שההדר מצטייר בכלל,
        // במקום להציג רגע אחד מצב "אורח"/תפריט קודם ואז להחליף אותו (הבהוב בעת מעבר בין משתמשים).
        const [response, user] = await Promise.all([fetch('/header/index.html'), currentUser()]);
        if (!response.ok) throw new Error('Could not load the header.');
        const header = document.querySelector('.header');
        header.innerHTML = await response.text();
        header.querySelector('.user-name').textContent = user?.fullName || user?.username || 'Guest';
        header.querySelector('.login-link').parentElement.hidden = Boolean(user);
        header.querySelectorAll('[data-logged-in]').forEach(item => { item.hidden = !user; });
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
