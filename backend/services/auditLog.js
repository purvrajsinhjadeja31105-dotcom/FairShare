const { FieldValue } = require('firebase-admin/firestore');
const db = require('../config/db');

/**
 * Append-only history of changes to a group's ledger.
 * Entries are written in the same batch/transaction as the change they describe,
 * so the log can never disagree with the data.
 */
const AUDIT_ACTIONS = {
    CREATED: 'created',
    UPDATED: 'updated',
    DELETED: 'deleted',
    SETTLEMENT_RECORDED: 'settlement_recorded',
    SETTLEMENT_CONFIRMED: 'settlement_confirmed',
    SETTLEMENT_REJECTED: 'settlement_rejected'
};

/** Adds an audit entry to a Firestore WriteBatch or Transaction (both expose .set). */
const addAuditEntry = (writer, { groupId, expenseId, action, actorId, changes = null }) => {
    writer.set(db.collection('audit_logs').doc(), {
        group_id: groupId,
        expense_id: expenseId,
        action,
        actor_id: actorId,
        changes,
        created_at: FieldValue.serverTimestamp()
    });
};

/** Returns { field: { from, to } } for the fields whose value changed. */
const diffFields = (before, after, fields) => {
    const changes = {};
    for (const field of fields) {
        if (after[field] === undefined) continue;
        if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
            changes[field] = { from: before[field] ?? null, to: after[field] };
        }
    }
    return changes;
};

module.exports = { AUDIT_ACTIONS, addAuditEntry, diffFields };
