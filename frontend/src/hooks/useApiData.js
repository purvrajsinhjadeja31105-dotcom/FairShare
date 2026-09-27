import { useCallback, useEffect, useRef, useState } from 'react';
import { readCache, writeCache } from '../utils/cache';

/**
 * Loads data for a screen: shows the last cached copy instantly (per user), then refreshes from the server.
 * `fetcher` returns a promise of the data; `cacheKey` null disables caching.
 * Returns { data, error, loading, reload }.
 */
export const useApiData = (cacheKey, fetcher) => {
    const [data, setData] = useState(() => (cacheKey ? readCache(cacheKey) : null));
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(!data);
    const fetcherRef = useRef(fetcher);
    useEffect(() => {
        fetcherRef.current = fetcher;
    });

    const reload = useCallback(async () => {
        try {
            const fresh = await fetcherRef.current();
            setData(fresh);
            setError(null);
            if (cacheKey) writeCache(cacheKey, fresh);
            return fresh;
        } catch (err) {
            setError(err);
            return null;
        } finally {
            setLoading(false);
        }
    }, [cacheKey]);

    useEffect(() => {
        const cached = cacheKey ? readCache(cacheKey) : null;
        setData(cached);
        setLoading(!cached);
        reload();
    }, [cacheKey, reload]);

    return { data, error, loading, reload };
};
