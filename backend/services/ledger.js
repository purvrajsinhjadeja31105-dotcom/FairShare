/**
 * Rules for which ledger entries (expenses and settlements) count toward balances.
 * Every balance calculation goes through countsTowardBalance so the rules live in one place.
 */

const SETTLEMENT_STATUS = {
    PENDING: 'pending',     // payer says they paid; waiting for the receiver to confirm
    CONFIRMED: 'confirmed', // receiver confirmed (or recorded it themselves)
    REJECTED: 'rejected'    // receiver says they never received it
};

// Settlements created before the `type` field existed are recognised by their description
const isSettlement = (entry) => entry.type === 'settlement' || /^settlement payment/i.test(entry.description || '');

const isDeleted = (entry) => Boolean(entry.deleted_at);

/** Legacy settlements have no status and were always counted, so they stay counted. */
const settlementStatus = (entry) => (isSettlement(entry) ? entry.settlement_status || SETTLEMENT_STATUS.CONFIRMED : null);

const countsTowardBalance = (entry) => {
    if (isDeleted(entry) || entry.is_wrong) return false;
    const status = settlementStatus(entry);
    return status === null || status === SETTLEMENT_STATUS.CONFIRMED;
};

/** The person receiving a settlement (the single split on it). */
const settlementReceiver = (entry) => entry.to_user_id || entry.splits?.[0]?.userId || null;

module.exports = { SETTLEMENT_STATUS, isSettlement, isDeleted, settlementStatus, countsTowardBalance, settlementReceiver };
