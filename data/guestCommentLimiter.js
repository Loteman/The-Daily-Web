const storageKey = 'guest_comment_timestamps';
const limit = 3;
const windowMs = 60_000;

// Local prototype only. The backend must enforce this when comments use an API.
export async function submitGuestComment(saveComment)
{
    const submit = () => {
        const now = Date.now();
        let timestamps;
        try
        {
            timestamps = JSON.parse(localStorage.getItem(storageKey) || '[]');
        }
        catch
        {
            timestamps = [];
        }

        const recent = Array.isArray(timestamps)
            ? timestamps.filter(time => Number.isFinite(time) && time <= now && now - time < windowMs)
            : [];

        if (recent.length >= limit)
        {
            const error = new Error('Guest comment limit reached.');
            error.code = 'GUEST_COMMENT_LIMIT';
            error.retryAfterSeconds = Math.ceil((Math.min(...recent) + windowMs - now) / 1000);
            throw error;
        }

        localStorage.setItem(storageKey, JSON.stringify([...recent, now]));
        return saveComment();
    };

    // Serialize submissions from different tabs sharing this browser storage.
    if (globalThis.navigator?.locks)
        return navigator.locks.request(storageKey, submit);

    return submit();
}
