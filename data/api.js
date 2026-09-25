export async function api(path, { method = 'GET', body } = {}) {
    const response = await fetch(path, {
        method, cache: 'no-store', credentials: 'same-origin',
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    });
    if (response.status === 204) return null;
    let data;
    try { data = await response.json(); }
    catch { throw new Error('יש לפתוח את האתר דרך שרת Node באמצעות npm start.'); }
    if (!response.ok) {
        const error = new Error(data.error || 'הבקשה נכשלה.');
        Object.assign(error, { status: response.status, code: data.code, retryAfterSeconds: data.retryAfterSeconds });
        throw error;
    }
    return data;
}
export async function currentUser() {
    return (await api('/api/auth/me')).user;
}
