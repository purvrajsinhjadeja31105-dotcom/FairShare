import { useState } from 'react';
import { Clock } from 'lucide-react';
import { api } from '../api';
import { formatMoney } from '../utils/format';

/**
 * "Bala says he paid you ₹300 — Confirm / Not received", plus your own payments still waiting.
 * `showGroup` adds the group name (on Home); inside a group it would just repeat the page title.
 */
export const PendingPayments = ({ forYou = [], byYou = [], onChange, showGroup = true }) => {
    const [busyId, setBusyId] = useState(null);
    const [error, setError] = useState(null);

    if (forYou.length === 0 && byYou.length === 0) return null;

    const respond = async (payment, action) => {
        if (action === 'reject' && !window.confirm(`Mark ${formatMoney(payment.amount)} from ${payment.fromUserName} as not received? Only do this if the money never arrived.`)) return;
        setBusyId(payment.id);
        setError(null);
        try {
            await api.respondToPayment(payment.id, action);
            onChange?.();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <section aria-label="Payments waiting for confirmation">
            <h2 className="section-title">Waiting for confirmation</h2>
            <ul className="list card">
                {forYou.map(p => (
                    <li key={p.id}>
                        <div className="list-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.6rem' }}>
                            <div className="row" style={{ alignItems: 'flex-start' }}>
                                <Clock size={18} className="pending" style={{ flexShrink: 0, marginTop: 2 }} />
                                <div className="grow">
                                    <div className="list-item-title">{p.fromUserName} says they paid you {formatMoney(p.amount)}</div>
                                    <div className="list-item-meta">{showGroup ? `${p.groupName} · ` : ''}Did you receive it?</div>
                                </div>
                            </div>
                            <div className="row" style={{ justifyContent: 'flex-end' }}>
                                <button className="btn btn-sm btn-secondary" disabled={busyId === p.id} onClick={() => respond(p, 'reject')}>Not received</button>
                                <button className="btn btn-sm btn-primary" disabled={busyId === p.id} onClick={() => respond(p, 'confirm')}>Confirm</button>
                            </div>
                        </div>
                    </li>
                ))}
                {byYou.map(p => (
                    <li key={p.id}>
                        <div className="list-item" style={{ alignItems: 'flex-start' }}>
                            <Clock size={18} className="muted" style={{ flexShrink: 0, marginTop: 2 }} />
                            <div className="grow">
                                <div className="list-item-title">You paid {p.toUserName} {formatMoney(p.amount)}</div>
                                <div className="list-item-meta">{showGroup ? `${p.groupName} · ` : ''}Waiting for {p.toUserName} to confirm</div>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
            {error && <p className="error-text" style={{ padding: '0.5rem 0.25rem 0' }}>{error}</p>}
        </section>
    );
};
