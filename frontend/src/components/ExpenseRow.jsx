import { ArrowRightLeft, Receipt } from 'lucide-react';
import { myEffect } from '../utils/entries';
import { formatDay, formatMoney } from '../utils/format';

export const ExpenseRow = ({ entry, meId, onOpen }) => {
    const isPayment = entry.type === 'settlement';
    const receiver = entry.splits[0];
    const pending = entry.settlement_status === 'pending';
    const rejected = entry.settlement_status === 'rejected';
    const canConfirm = isPayment && pending && receiver?.userId === meId;
    const effect = myEffect(entry, meId);
    const payerName = entry.paid_by === meId ? 'You' : entry.paid_by_name;
    const receiverName = receiver?.userId === meId ? 'you' : receiver?.username;

    return (
        <li className="list-item" style={{ opacity: rejected ? 0.6 : 1 }}>
            <button className="row-button" onClick={() => onOpen(entry)}>
                <span className="avatar avatar-sm" style={{ background: isPayment ? 'var(--positive)' : 'var(--accent)' }} aria-hidden="true">
                    {isPayment ? <ArrowRightLeft size={14} /> : <Receipt size={14} />}
                </span>
                <span className="grow">
                    <span className="list-item-title truncate" style={{ display: 'block' }}>
                        {isPayment ? `${payerName} paid ${receiverName}` : entry.description}
                    </span>
                    <span className="list-item-meta truncate" style={{ display: 'block' }}>
                        {formatDay(entry.expense_date)} · {isPayment ? formatMoney(entry.amount) : `${payerName} paid ${formatMoney(entry.amount)}`}
                        {pending && <> · <span className="pill pill-pending">{canConfirm ? 'Needs your OK' : 'Waiting'}</span></>}
                        {rejected && <> · <span className="pill pill-rejected">Not received</span></>}
                    </span>
                </span>
                {effect && (
                    <span className="list-item-end">
                        <span className={`tiny ${effect.tone}`} style={{ display: 'block', fontWeight: 600 }}>{effect.label}</span>
                        {effect.amount !== null && <strong className={`num ${effect.tone}`}>{formatMoney(effect.amount)}</strong>}
                    </span>
                )}
            </button>
        </li>
    );
};
