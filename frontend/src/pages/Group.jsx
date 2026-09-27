import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, UserPlus, Plus, MoreVertical, LogOut, Trash2, Receipt } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { useSocketEvents } from '../context/SocketContext';
import { Avatar, EmptyState, ErrorNotice, Sheet, Spinner } from '../components/ui';
import { ExpenseRow } from '../components/ExpenseRow';
import { ExpenseDetailSheet } from '../components/ExpenseDetailSheet';
import { InviteSheet } from '../components/InviteSheet';
import { SettleSheet } from '../components/SettleSheet';
import { PendingPayments } from '../components/PendingPayments';
import { pendingPayments } from '../utils/entries';
import { formatMoney, monthLabel } from '../utils/format';

const LIVE_EVENTS = ['update_expenses', 'update_summary', 'update_groups'];

const loadGroup = async (groupId) => {
    const [{ group }, { members }, { expenses }, { balances, simplifiedDebts }] = await Promise.all([
        api.group(groupId), api.members(groupId), api.expenses(groupId), api.balances(groupId)
    ]);
    return { group, members, expenses, balances, simplifiedDebts };
};

/** Activity grouped under month headings, newest first. */
const byMonth = (entries) => {
    const sorted = [...entries].sort((a, b) =>
        (b.expense_date || '').localeCompare(a.expense_date || '') || new Date(b.created_at) - new Date(a.created_at));
    const months = [];
    for (const entry of sorted) {
        const key = (entry.expense_date || '').slice(0, 7);
        if (months.at(-1)?.key !== key) months.push({ key, label: entry.expense_date ? monthLabel(entry.expense_date) : 'Earlier', entries: [] });
        months.at(-1).entries.push(entry);
    }
    return months;
};

export default function Group() {
    const { groupId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { data, error, loading, reload } = useApiData(`group_${groupId}`, () => loadGroup(groupId));
    useSocketEvents(LIVE_EVENTS, (payload) => { if (!payload?.groupId || payload.groupId === groupId) reload(); });

    const [openEntry, setOpenEntry] = useState(null);
    const [settle, setSettle] = useState(null);
    const [showMenu, setShowMenu] = useState(false);
    const [menuError, setMenuError] = useState(null);
    const showInvite = searchParams.get('invite') === '1';
    const setShowInvite = (open) => setSearchParams(open ? { invite: '1' } : {}, { replace: true });

    if (loading) return <main className="page"><Spinner /></main>;
    if (!data) {
        return (
            <main className="page">
                <ErrorNotice error={error} onRetry={error?.status >= 500 || error?.status === 0 ? reload : undefined} />
                <Link to="/home" className="btn btn-secondary">Back to home</Link>
            </main>
        );
    }

    const { group, expenses, balances, simplifiedDebts } = data;
    const members = [...data.members].sort((a, b) => (b.id === user.id) - (a.id === user.id)); // you first
    const memberById = Object.fromEntries(members.map(m => [m.id, m]));
    const myBalance = balances[user.id] || 0;
    const myPayments = simplifiedDebts.filter(d => d.fromUserId === user.id || d.toUserId === user.id);
    const otherPayments = simplifiedDebts.filter(d => d.fromUserId !== user.id && d.toUserId !== user.id);
    const paise = Math.round(myBalance * 100);
    const tone = paise > 0 ? 'positive' : paise < 0 ? 'negative' : 'neutral';
    const waiting = pendingPayments(expenses, user.id, group.name);
    // Who a payment is already on its way to (or from), so we don't invite paying twice
    const awaitingFrom = new Set(waiting.forYou.map(p => p.fromUserId));
    const awaitingTo = new Set(waiting.byYou.map(p => p.toUserId));

    const leaveOrDelete = async (action) => {
        setMenuError(null);
        const ok = action === 'delete'
            ? window.confirm(`Delete "${group.name}" for everyone? This cannot be undone.`)
            : window.confirm(`Leave "${group.name}"?`);
        if (!ok) return;
        try {
            if (action === 'delete') await api.deleteGroup(groupId);
            else await api.leaveGroup(groupId);
            navigate('/home');
        } catch (err) {
            setMenuError(err);
        }
    };

    return (
        <main className="page">
            <div className="page-header">
                <Link to="/home" className="btn btn-ghost icon-btn" aria-label="Back to home"><ArrowLeft size={20} /></Link>
                <h1>{group.name}</h1>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowInvite(true)}><UserPlus size={16} /> Invite</button>
                <button className="btn btn-ghost icon-btn" aria-label="Group options" onClick={() => setShowMenu(true)}><MoreVertical size={20} /></button>
            </div>

            <div className="row" style={{ gap: '0.35rem' }} aria-label="Members">
                {members.slice(0, 8).map(m => <Avatar key={m.id} name={m.username} id={m.id} size="sm" />)}
                <span className="small muted" style={{ marginLeft: '0.25rem' }}>
                    {members.map(m => (m.id === user.id ? 'You' : m.username)).join(', ')}
                </span>
            </div>

            <ErrorNotice error={error} onRetry={reload} />

            <section className={`card hero ${tone}`}>
                <p className="hero-label">{paise > 0 ? 'You are owed' : paise < 0 ? 'You owe' : 'In this group'}</p>
                <p className="hero-amount num">{paise === 0 ? 'Settled up' : formatMoney(myBalance)}</p>
            </section>

            {/* Payments waiting for the receiver stay here until confirmed, however old they are */}
            <PendingPayments {...waiting} onChange={reload} showGroup={false} />

            {simplifiedDebts.length > 0 && (
                <section>
                    <h2 className="section-title">Suggested payments</h2>
                    <ul className="list card">
                        {[...myPayments, ...otherPayments].map(d => {
                            const iPay = d.fromUserId === user.id;
                            const iReceive = d.toUserId === user.id;
                            return (
                                <li key={`${d.fromUserId}-${d.toUserId}`} className="list-item">
                                    <div className="grow">
                                        <span className="list-item-title">
                                            {iPay ? 'You' : d.fromUserName} → {iReceive ? 'you' : d.toUserName}
                                        </span>
                                        <span className={`num ${iPay ? 'negative' : iReceive ? 'positive' : 'muted'}`} style={{ marginLeft: '0.5rem', fontWeight: 700 }}>
                                            {formatMoney(d.amount)}
                                        </span>
                                    </div>
                                    {iPay && awaitingTo.has(d.toUserId) && (
                                        <span className="pill pill-pending">Waiting for {d.toUserName}</span>
                                    )}
                                    {iReceive && awaitingFrom.has(d.fromUserId) && (
                                        <span className="pill pill-pending">Confirm above</span>
                                    )}
                                    {iPay && !awaitingTo.has(d.toUserId) && (
                                        <button className="btn btn-primary btn-sm" onClick={() => setSettle({ other: memberById[d.toUserId] || { id: d.toUserId, username: d.toUserName }, direction: 'pay', amount: -d.amount })}>
                                            Settle up
                                        </button>
                                    )}
                                    {iReceive && !awaitingFrom.has(d.fromUserId) && (
                                        <button className="btn btn-secondary btn-sm" onClick={() => setSettle({ other: memberById[d.fromUserId] || { id: d.fromUserId, username: d.fromUserName }, direction: 'receive', amount: d.amount })}>
                                            Record payment
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            {expenses.length === 0 ? (
                <section className="card">
                    {members.length === 1 ? (
                        <EmptyState icon={<UserPlus size={26} />} title="Invite your friends" action={<button className="btn btn-primary" onClick={() => setShowInvite(true)}>Share invite link</button>}>
                            Send the link on WhatsApp. Once they join you can split expenses together.
                        </EmptyState>
                    ) : (
                        <EmptyState icon={<Receipt size={26} />} title="No expenses yet" action={<Link className="btn btn-primary" to={`/groups/${groupId}/expenses/new`}>Add the first expense</Link>}>
                            Add a bill and FairShare works out who owes whom.
                        </EmptyState>
                    )}
                </section>
            ) : (
                byMonth(expenses).map(month => (
                    <section key={month.key}>
                        <h2 className="section-title">{month.label}</h2>
                        <ul className="list card">
                            {month.entries.map(entry => (
                                <ExpenseRow key={entry.id} entry={entry} meId={user.id} onOpen={setOpenEntry} />
                            ))}
                        </ul>
                    </section>
                ))
            )}

            <Link className="btn btn-primary fab" to={`/groups/${groupId}/expenses/new`}><Plus size={20} /> Add expense</Link>

            {openEntry && (
                <ExpenseDetailSheet entry={openEntry} groupId={groupId} meId={user.id} onClose={() => setOpenEntry(null)} onChanged={reload} />
            )}
            {showInvite && (
                <InviteSheet group={group} isCreator={group.created_by === user.id} onClose={() => setShowInvite(false)} onMemberAdded={reload} />
            )}
            {settle && (
                <SettleSheet
                    groupId={groupId}
                    groupName={group.name}
                    me={user}
                    other={settle.other}
                    direction={settle.direction}
                    suggestedAmount={settle.amount}
                    onClose={() => setSettle(null)}
                    onDone={reload}
                />
            )}
            {showMenu && (
                <Sheet title={group.name} onClose={() => { setShowMenu(false); setMenuError(null); }}>
                    <div className="stack">
                        <p className="muted small">You can leave or delete a group once everyone involved is settled up.</p>
                        <ErrorNotice error={menuError} />
                        <button className="btn btn-secondary btn-block" onClick={() => leaveOrDelete('leave')}><LogOut size={16} /> Leave group</button>
                        {group.created_by === user.id && (
                            <button className="btn btn-danger btn-block" onClick={() => leaveOrDelete('delete')}><Trash2 size={16} /> Delete group</button>
                        )}
                    </div>
                </Sheet>
            )}
        </main>
    );
}
