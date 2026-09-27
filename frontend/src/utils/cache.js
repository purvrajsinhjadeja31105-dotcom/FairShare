// Per-user localStorage cache for instant rendering (stale-while-revalidate).
// Keys include the user's ID so one account never sees another account's cached data
// on a shared browser, and everything is wiped on login/logout.

const PREFIX = 'fairshare_cache_';

const currentUserId = () => {
    try {
        return JSON.parse(localStorage.getItem('fairshare_user'))?.id || null;
    } catch {
        return null;
    }
};

const keyFor = (name) => {
    const userId = currentUserId();
    return userId ? `${PREFIX}${userId}_${name}` : null;
};

export const readCache = (name) => {
    const key = keyFor(name);
    if (!key) return null;
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch {
        return null;
    }
};

export const writeCache = (name, data) => {
    const key = keyFor(name);
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch { /* storage full or blocked: caching is optional */ }
};

/** Shallow-merges `part` into the cached object. */
export const mergeCache = (name, part) => writeCache(name, { ...(readCache(name) || {}), ...part });

/** Removes every cached entry (all users, including the old un-keyed format). */
export const clearAllCaches = () => {
    try {
        Object.keys(localStorage)
            .filter(key => key.startsWith(PREFIX))
            .forEach(key => localStorage.removeItem(key));
    } catch { /* storage unavailable */ }
};
