import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, History } from 'lucide-react';
import { Sheet, Avatar, ErrorNotice } from './ui';
import { api } from '../api';
import { formatDay, formatMoney, timeAgo } from '../utils/format';

const HISTORY_TEXT = {
    created: 'added this',
    updated: 'edited this',
    deleted: 'deleted this',
    settlement_recorded: 'recorded this payment',
    settlement_confirmed: 'confirmed receiving it',
    settlement_rejected: 'said it was not received'
};

const describeChange = (h) => {
    if (h.action !== 'updated' || !h.changes) return HISTORY_TEXT[h.action] || h.action;
    const parts = [];
    if (h.changes.description) parts.push(`renamed it to "${h.changes.description.to}"`);
    if (h.changes.amount) parts.push(`changed the amount ${formatMoney(h.changes.amount.from)} → ${formatMoney(h.changes.amount.to)}`);
    else if (h.changes.splits) parts.push('changed the split');
    if (h.changes.expense_date) parts.push(`moved it to ${formatDay(h.changes.expense_date.to)}`);
    return parts.join(', ') || 'edited this';
};

/** Full details of one expense or payment: who paid, who owes what, history, edit/delete. */
export const ExpenseDetailSheet = ({ entry, groupId, meId, onClose, onChanged }) => {
    const navigate = useNavigate();
    const [history, setHistory] = useState(null);
    const [error, setError] = useState(null);
    const isPayment = entry.type === 'settlement';
    const canModify = entry.paid_by === meId || entry.created_by === meId;

    useEffect(() => {
        api.history(entry.id).then(r => setHistory(r.history)).catch(() => setHistory([]));
    }, [entry.id]);

    const remove = async () => {
        const what = isPayment ? 'this payment' : `"${entry.description}"`;
        if (!window.confirm(`Delete ${what}? Balances will be updated for everyone. It stays in the group history.`)) return;
        try {
            await api.deleteExpense(entry.id);
            onChanged?.();
            onClose();
        } catch (err) {
            setError(err);
        }
    };

    return (
        <Sheet title={isPayment ? 'Payment' : entry.description} onClose={onClose}>
            <div className="stack">
                <div className="card hero neutral" style={{ boxShadow: 'none' }}>
                    <p className="hero-amount num">{formatMoney(entry.amount)}</p>
                    <p className="muted small" style={{ marginTop: '0.3rem' }}>
                        {isPayment
                            ? `${entry.paid_by_name} paid ${entry.splits[0]?.username} · ${formatDay(entry.expense_date)}`
                            : `Paid by ${entry.paid_by === meId ? 'you' : entry.paid_by_name} · ${formatDay(entry.expense_date)}`}
                    </p>
                    {entry.settlement_status === 'pending' && <p className="pending small" style={{ marginTop: '0.3rem' }}>Waiting for {entry.splits[0]?.username} to confirm</p>}
                    {entry.settlement_status === 'rejected' && <p className="negative small" style={{ marginTop: '0.3rem' }}>{entry.splits[0]?.username} said this was not received</p>}
                </div>

                {!isPayment && (
                    <section>
                        <h3 className="section-title">Split</h3>
                        <ul className="list card">
                            {entry.splits.map(s => (
                                <li key={s.userId} className="list-item">
                                    <Avatar name={s.username} id={s.userId} size="sm" />
                                    <span className="grow">{s.userId === meId ? 'You' : s.username}</span>
                                    <span className="num">{formatMoney(s.amount)}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {history?.length > 0 && (
                    <section>
                        <h3 className="section-title"><History size={12} /> History</h3>
                        <ul className="list card">
                            {history.map(h => (
                                <li key={h.id} className="list-item small">
                                    <span className="grow"><strong>{h.actor_id === meId ? 'You' : h.actor_name}</strong> {describeChange(h)}</span>
                                    <span className="muted tiny">{h.created_at ? timeAgo(h.created_at) : ''}</span>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <ErrorNotice error={error} />

                {canModify && (
                    <div className="row">
                        {!isPayment && (
                            <button className="btn btn-secondary grow" onClick={() => navigate(`/groups/${groupId}/expenses/${entry.id}/edit`)}>
                                <Pencil size={16} /> Edit
                            </button>
                        )}
                        <button className="btn btn-danger grow" onClick={remove}><Trash2 size={16} /> {isPayment ? 'Cancel payment' : 'Delete'}</button>
                    </div>
                )}
            </div>
        </Sheet>
    );
};
