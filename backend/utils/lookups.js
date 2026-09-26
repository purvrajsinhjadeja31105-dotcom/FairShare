const db = require('../config/db');

/**
 * Fetches a field for many documents in one batched read instead of one round trip per document.
 * Returns { [id]: value }, using `fallback` for ids that don't exist.
 */
const fetchFieldByIds = async (collection, ids, field, fallback) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    const result = {};
    if (uniqueIds.length === 0) return result;

    const docs = await db.getAll(...uniqueIds.map(id => db.collection(collection).doc(id)));
    docs.forEach(doc => {
        result[doc.id] = doc.exists ? doc.data()[field] : fallback;
    });
    return result;
};

const fetchUsernames = (ids) => fetchFieldByIds('users', ids, 'username', 'Unknown User');
const fetchGroupNames = (ids) => fetchFieldByIds('groups', ids, 'name', 'Unknown Group');

module.exports = { fetchFieldByIds, fetchUsernames, fetchGroupNames };
