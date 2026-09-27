/** How one entry affects the viewer, in plain words. */
export const myEffect = (entry, meId) => {
    if (entry.type === 'settlement') return null;
    const myShare = entry.splits.find(s => s.userId === meId)?.amount || 0;
    if (entry.paid_by === meId) {
        const lent = entry.amount - myShare;
        return lent > 0.004 ? { tone: 'positive', label: 'you lent', amount: lent } : { tone: 'neutral', label: 'just you', amount: null };
    }
    return myShare > 0 ? { tone: 'negative', label: 'you borrowed', amount: myShare } : { tone: 'neutral', label: 'not involved', amount: null };
};

/**
 * Payments in a group still waiting for the receiver, split into the ones you must confirm
 * and the ones you sent. Oldest first, so nothing old gets buried. Same shape as the Home overview.
 */
export const pendingPayments = (entries, meId, groupName) => {
    const rows = entries
        .filter(e => e.type === 'settlement' && e.settlement_status === 'pending')
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map(e => ({
            id: e.id,
            groupName,
            amount: e.amount,
            fromUserId: e.paid_by,
            fromUserName: e.paid_by_name,
            toUserId: e.splits[0]?.userId,
            toUserName: e.splits[0]?.username
        }));
    return {
        forYou: rows.filter(r => r.toUserId === meId),
        byYou: rows.filter(r => r.fromUserId === meId)
    };
};
