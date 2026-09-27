import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useSocketEvents } from '../context/SocketContext';
import { Avatar, ErrorNotice, Spinner } from '../components/ui';
import { formatMoney, todayIso } from '../utils/format';
import { splitEvenly, toPaise } from '../utils/money';
import { computeSplit } from '../utils/split';

const MODES = [
    { id: 'equal', label: 'Equally' },
    { id: 'exact', label: 'Amounts' },
    { id: 'percent', label: 'Percent' }
];

export default function ExpenseForm() {
    const { groupId, expenseId } = useParams();
    const isEdit = Boolean(expenseId);
    const navigate = useNavigate();
    const { user } = useAuth();

    const [members, setMembers] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [groupName, setGroupName] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [paidBy, setPaidBy] = useState(user.id);
    const [date, setDate] = useState(todayIso());
    const [mode, setMode] = useState('equal');
    const [included, setIncluded] = useState({});
    const [values, setValues] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const [{ group }, { members: list }, existing] = await Promise.all([
                    api.group(groupId),
                    api.members(groupId),
                    isEdit ? api.expenses(groupId) : Promise.resolve(null)
                ]);
                setGroupName(group.name);
                setMembers(list);

                if (!isEdit) {
                    setIncluded(Object.fromEntries(list.map(m => [m.id, true])));
                    return;
                }
                const expense = existing.expenses.find(e => e.id === expenseId);
                if (!expense) throw new Error('This expense no longer exists.');
                setAmount(String(expense.amount));
                setDescription(expense.description);
                setPaidBy(expense.paid_by);
                setDate(expense.expense_date || todayIso());
                // Reopen as "Equally" when the stored shares are exactly an equal split, otherwise as amounts
                const people = list.filter(m => expense.splits.some(s => s.userId === m.id));
                const equalParts = splitEvenly(expense.amount, people.length);
                const isEqual = people.every((m, i) => toPaise(expense.splits.find(s => s.userId === m.id).amount) === toPaise(equalParts[i]));
                setIncluded(Object.fromEntries(list.map(m => [m.id, people.includes(m)])));
                setValues(Object.fromEntries(expense.splits.map(s => [s.userId, s.amount.toFixed(2)])));
                setMode(isEqual ? 'equal' : 'exact');
            } catch (err) {
                setLoadError(err);
            }
        };
        load();
    }, [groupId, expenseId, isEdit]);

    // Someone joined or left while the form is open: refresh the list. New people start unticked,
    // so a split you've already set up never changes without you noticing.
    useSocketEvents(['update_groups'], async (payload) => {
        if (payload?.groupId && payload.groupId !== groupId) return;
        try {
            const { members: list } = await api.members(groupId);
            setMembers(list);
            setIncluded(prev => ({ ...Object.fromEntries(list.map(m => [m.id, false])), ...prev }));
        } catch { /* keep the current list; saving still validates membership */ }
    });

    const split = useMemo(
        () => (members ? computeSplit({ mode, amount, members, included, values }) : { valid: false, shares: {} }),
        [mode, amount, members, included, values]
    );

    const changeMode = (next) => {
        // Start each mode from something sensible instead of blank inputs
        if (next === 'exact' && members) {
            setValues(Object.fromEntries(members.map(m => [m.id, split.shares[m.id] || ''])));
        } else if (next === 'percent' && members) {
            const people = members.filter(m => included[m.id]);
            const base = people.length ? Math.floor(10000 / people.length) / 100 : 0;
            setValues(Object.fromEntries(members.map(m => {
                if (!included[m.id]) return [m.id, ''];
                const isLast = people.indexOf(m) === people.length - 1;
                return [m.id, isLast ? String(Math.round((100 - base * (people.length - 1)) * 100) / 100) : String(base)];
            })));
        }
        setMode(next);
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!split.valid || !description.trim()) return;
        setSaving(true);
        setSaveError(null);
        const splits = Object.entries(split.shares).map(([userId, amount_owed]) => ({ userId, amount_owed }));
        const payload = { amount, description: description.trim(), paidBy, date, splits };
        try {
            if (isEdit) await api.updateExpense(expenseId, payload);
            else await api.addExpense(groupId, payload);
            navigate(`/groups/${groupId}`, { replace: true });
        } catch (err) {
            setSaveError(err);
            setSaving(false);
        }
    };

    if (loadError) return <main className="page"><ErrorNotice error={loadError} /><Link to={`/groups/${groupId}`} className="btn btn-secondary">Back to group</Link></main>;
    if (!members) return <main className="page"><Spinner /></main>;

    return (
        <main className="page">
            <div className="page-header">
                <Link to={`/groups/${groupId}`} className="btn btn-ghost icon-btn" aria-label="Back to group"><ArrowLeft size={20} /></Link>
                <h1>{isEdit ? 'Edit expense' : 'Add expense'}</h1>
            </div>
            <p className="muted small" style={{ marginTop: '-0.5rem' }}>{groupName}</p>

            <form className="stack" onSubmit={submit}>
                <label className="field">
                    <span className="sr-only">Amount in rupees</span>
                    <input
                        className="input input-amount num" inputMode="decimal" placeholder="₹0" autoFocus={!isEdit}
                        value={amount} onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))} required
                    />
                </label>
                <label className="field">
                    <span className="label">What was it for?</span>
                    <input className="input" placeholder="Dinner, fuel, rent…" value={description} onChange={e => setDescription(e.target.value)} maxLength={255} required />
                </label>
                <div className="row">
                    <label className="field grow">
                        <span className="label">Paid by</span>
                        <select className="select" value={paidBy} onChange={e => setPaidBy(e.target.value)}>
                            {members.map(m => <option key={m.id} value={m.id}>{m.id === user.id ? 'You' : m.username}</option>)}
                        </select>
                    </label>
                    <label className="field">
                        <span className="label">Date</span>
                        <input className="input" type="date" value={date} max={todayIso()} onChange={e => setDate(e.target.value)} required />
                    </label>
                </div>

                <section className="card card-pad stack">
                    <div className="row-between">
                        <h2>Split</h2>
                        <div className="segmented" role="group" aria-label="How to split" style={{ minWidth: 240 }}>
                            {MODES.map(m => (
                                <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => changeMode(m.id)}>{m.label}</button>
                            ))}
                        </div>
                    </div>

                    <ul className="list">
                        {members.map(m => (
                            <li key={m.id} className="list-item" style={{ padding: '0.55rem 0' }}>
                                {mode === 'equal' ? (
                                    <label className="row grow" style={{ cursor: 'pointer' }}>
                                        <input type="checkbox" className="checkbox" checked={Boolean(included[m.id])} onChange={e => setIncluded(prev => ({ ...prev, [m.id]: e.target.checked }))} />
                                        <Avatar name={m.username} id={m.id} size="sm" />
                                        <span className="grow">{m.id === user.id ? 'You' : m.username}</span>
                                        <span className="num muted">{split.shares[m.id] ? formatMoney(split.shares[m.id]) : '—'}</span>
                                    </label>
                                ) : (
                                    <label className="row grow">
                                        <Avatar name={m.username} id={m.id} size="sm" />
                                        <span className="grow">{m.id === user.id ? 'You' : m.username}</span>
                                        {mode === 'percent' && split.shares[m.id] && <span className="tiny muted num">{formatMoney(split.shares[m.id])}</span>}
                                        <span className="input-affix">
                                            {mode === 'exact' && <span>₹</span>}
                                            <input
                                                className="input input-sm num" inputMode="decimal" placeholder="0"
                                                aria-label={`${m.username} ${mode === 'exact' ? 'amount' : 'percent'}`}
                                                value={values[m.id] || ''}
                                                onChange={e => setValues(prev => ({ ...prev, [m.id]: e.target.value.replace(/[^\d.]/g, '') }))}
                                                style={mode === 'percent' ? { paddingRight: '1.6rem' } : undefined}
                                            />
                                            {mode === 'percent' && <span style={{ left: 'auto', right: '0.6rem' }}>%</span>}
                                        </span>
                                    </label>
                                )}
                            </li>
                        ))}
                    </ul>

                    <p className={`small ${split.valid ? 'muted' : 'negative'}`} aria-live="polite">{split.message}</p>
                </section>

                <ErrorNotice error={saveError} />
                <button className="btn btn-primary btn-block" disabled={saving || !split.valid || !description.trim()}>
                    {saving ? 'Saving…' : isEdit ? 'Save changes' : `Add ${toPaise(amount) > 0 ? formatMoney(amount) : 'expense'}`}
                </button>
            </form>
        </main>
    );
}
