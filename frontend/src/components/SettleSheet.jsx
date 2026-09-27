import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Clock, Smartphone } from 'lucide-react';
import { Sheet, ErrorNotice } from './ui';
import { api } from '../api';
import { buildUpiLink } from '../utils/upi';
import { formatMoney } from '../utils/format';
import { toPaise } from '../utils/money';

/**
 * Settle a balance with one person in one group.
 *   direction "pay":     you owe them → pay by UPI, then "I've paid" (they must confirm)
 *   direction "receive": they owe you → record that they paid you (counts immediately)
 */
export const SettleSheet = ({ groupId, groupName, me, other, direction, suggestedAmount, onClose, onDone }) => {
    const [amount, setAmount] = useState(Math.abs(suggestedAmount).toFixed(2));
    const [upiId, setUpiId] = useState(other.upi_id ?? null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null);

    // The receiver's UPI ID comes from the group's member list when the caller didn't pass it
    useEffect(() => {
        if (direction !== 'pay' || other.upi_id !== undefined) return;
        api.members(groupId)
            .then(({ members }) => setUpiId(members.find(m => m.id === other.id)?.upi_id || null))
            .catch(() => setUpiId(null));
    }, [direction, groupId, other.id, other.upi_id]);

    const paise = toPaise(amount);
    const validAmount = Number.isFinite(paise) && paise > 0;

    const submit = async () => {
        setSaving(true);
        setError(null);
        try {
            const res = direction === 'pay'
                ? await api.settle(groupId, { toUserId: other.id, amount })
                : await api.settle(groupId, { fromUserId: other.id, toUserId: me.id, amount });
            setResult(res);
            onDone?.();
        } catch (err) {
            setError(err);
        } finally {
            setSaving(false);
        }
    };

    if (result) {
        const pending = result.status === 'pending';
        return (
            <Sheet title={pending ? 'Waiting for confirmation' : 'Payment recorded'} onClose={onClose}>
                <div className="empty">
                    <div className="empty-icon">{pending ? <Clock size={26} /> : <CheckCircle2 size={26} />}</div>
                    <p>
                        {pending
                            ? <>We&apos;ve asked <strong>{other.username}</strong> to confirm they received {formatMoney(amount)}. Your balance updates as soon as they do.</>
                            : <>{other.username} paid you {formatMoney(amount)}. Balances are updated.</>}
                    </p>
                    <button className="btn btn-primary btn-block" onClick={onClose}>Done</button>
                </div>
            </Sheet>
        );
    }

    const upiLink = upiId && validAmount ? buildUpiLink({ upiId, name: other.username, amount }) : null;

    return (
        <Sheet title={direction === 'pay' ? `Pay ${other.username}` : `${other.username} paid you`} onClose={onClose}>
            <div className="stack">
                <p className="muted small">
                    {direction === 'pay'
                        ? <>You owe {other.username} {formatMoney(suggestedAmount)} in {groupName}.</>
                        : <>{other.username} owes you {formatMoney(suggestedAmount)} in {groupName}. Record a payment you received.</>}
                </p>

                <label className="field">
                    <span className="label">Amount</span>
                    <span className="input-affix">
                        <span>₹</span>
                        <input className="input num" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
                    </span>
                </label>

                {direction === 'pay' && (
                    upiLink ? (
                        <div className="card card-pad stack" style={{ alignItems: 'center', textAlign: 'center' }}>
                            <a className="btn btn-primary btn-block" href={upiLink}>
                                <Smartphone size={18} /> Pay {formatMoney(amount)} with UPI app
                            </a>
                            <span className="hint">On a computer? Scan with Google Pay, PhonePe or Paytm:</span>
                            <span className="qr-box"><QRCodeSVG value={upiLink} size={150} /></span>
                            <span className="tiny muted">UPI ID: <strong>{upiId}</strong></span>
                        </div>
                    ) : (
                        <div className="notice notice-info">
                            {upiId === null
                                ? <>{other.username} hasn&apos;t added a UPI ID yet. Pay them any way you like, then tap &ldquo;I&apos;ve paid&rdquo;.</>
                                : 'Enter an amount to see the UPI payment option.'}
                        </div>
                    )
                )}

                <ErrorNotice error={error} />

                <button className="btn btn-primary btn-block" disabled={!validAmount || saving} onClick={submit}>
                    {saving ? 'Saving…' : direction === 'pay' ? `I've paid ${validAmount ? formatMoney(amount) : ''}` : `Record ${validAmount ? formatMoney(amount) : ''} received`}
                </button>
                {direction === 'pay' && (
                    <p className="hint" style={{ textAlign: 'center' }}>{other.username} will be asked to confirm before balances change.</p>
                )}
            </div>
        </Sheet>
    );
};
