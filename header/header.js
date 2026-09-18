async function loadHeader()
{
    try
    {
        const response = await fetch('/header/index.html');
        if (!response.ok)
            throw new Error('Could not load the header.');

        const header = document.querySelector('.header');
        header.innerHTML = await response.text();
        const username = sessionStorage.getItem('username');
        header.querySelector('.user-name').textContent = username || 'Guest';
        header.querySelector('.login-link').parentElement.hidden = Boolean(username);
        header.querySelectorAll('[data-logged-in]').forEach(item => {
            item.hidden = !username;
        });
    }
    catch (error)
    {
        console.error('Header loading failed:', error);
    }
}

loadHeader();
