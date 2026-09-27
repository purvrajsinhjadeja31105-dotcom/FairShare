import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Users, ChevronRight } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { useSocketEvents } from '../context/SocketContext';
import { Avatar, BalanceText, EmptyState, ErrorNotice, Sheet, Spinner } from '../components/ui';
import { PendingPayments } from '../components/PendingPayments';
import { SettleSheet } from '../components/SettleSheet';
import { formatMoney } from '../utils/format';

const LIVE_EVENTS = ['update_summary', 'update_expenses', 'update_groups'];

const Hero = ({ total }) => {
    const paise = Math.round(total * 100);
    const tone = paise > 0 ? 'positive' : paise < 0 ? 'negative' : 'neutral';
    return (
        <section className={`card hero ${tone}`} aria-live="polite">
            <p className="hero-label">{paise > 0 ? 'Overall, you are owed' : paise < 0 ? 'Overall, you owe' : 'Overall'}</p>
            <p className="hero-amount num">{paise === 0 ? 'All settled up' : formatMoney(total)}</p>
        </section>
    );
};

const groupSummary = (groups) => groups
    .map(g => `${g.groupName}: ${g.amount > 0 ? 'owes you' : 'you owe'} ${formatMoney(g.amount)}`)
    .join(' · ');

export default function Home() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { data, error, loading, reload } = useApiData('overview', api.overview);
    useSocketEvents(LIVE_EVENTS, reload);

    const [settlePerson, setSettlePerson] = useState(null);   // person chosen from the list
    const [settleTarget, setSettleTarget] = useState(null);   // { person, group } being settled
    const [showNewGroup, setShowNewGroup] = useState(false);
    const [showPickGroup, setShowPickGroup] = useState(false);

    if (loading) return <main className="page"><Spinner /></main>;
    if (!data) return <main className="page"><ErrorNotice error={error} onRetry={reload} /></main>;

    const openSettle = (person) => {
        if (person.groups.length === 1) setSettleTarget({ person, group: person.groups[0] });
        else setSettlePerson(person);
    };

    const addExpense = () => {
        if (data.groups.length === 0) setShowNewGroup(true);
        else if (data.groups.length === 1) navigate(`/groups/${data.groups[0].id}/expenses/new`);
        else setShowPickGroup(true);
    };

    return (
        <main className="page">
            <ErrorNotice error={error} onRetry={reload} />
            <Hero total={data.total} />

            <PendingPayments forYou={data.pendingForYou} byYou={data.pendingByYou} onChange={reload} />

            {data.groups.length === 0 ? (
                <section className="card">
                    <EmptyState
                        icon={<Users size={26} />}
                        title="Split your first bill"
                        action={<button className="btn btn-primary" onClick={() => setShowNewGroup(true)}><Plus size={18} /> Create a group</button>}
                    >
                        Make a group for a trip, your flat or any outing, invite friends with a link, and start adding expenses.
                    </EmptyState>
                </section>
            ) : (
                <>
                    {data.people.length > 0 && (
                        <section>
                            <h2 className="section-title">People</h2>
                            <ul className="list card">
                                {data.people.map(person => (
                                    <li key={person.userId}>
                                        <button className="list-item" onClick={() => openSettle(person)}>
                                            <Avatar name={person.username} id={person.userId} />
                                            <div className="grow">
                                                <div className="list-item-title truncate">{person.username}</div>
                                                <div className="list-item-meta truncate">{groupSummary(person.groups)}</div>
                                            </div>
                                            <div className="list-item-end"><BalanceText amount={person.balance} /></div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <section>
                        <div className="row-between">
                            <h2 className="section-title">Groups</h2>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowNewGroup(true)}><Plus size={16} /> New group</button>
                        </div>
                        <ul className="list card">
                            {data.groups.map(group => (
                                <li key={group.id}>
                                    <Link className="list-item" to={`/groups/${group.id}`}>
                                        <Avatar name={group.name} id={group.id} group />
                                        <div className="grow">
                                            <div className="list-item-title truncate">{group.name}</div>
                                            <div className="list-item-meta">{group.member_count} {group.member_count === 1 ? 'member' : 'members'}</div>
                                        </div>
                                        <div className="list-item-end"><BalanceText amount={group.my_balance} owedLabel="you are owed" /></div>
                                        <ChevronRight size={18} className="muted" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                </>
            )}

            <button className="btn btn-primary fab" onClick={addExpense}><Plus size={20} /> Add expense</button>

            {settlePerson && (
                <Sheet title={`Settle with ${settlePerson.username}`} onClose={() => setSettlePerson(null)}>
                    <p className="muted small" style={{ marginBottom: '0.75rem' }}>Payments are recorded per group.</p>
                    <ul className="list card">
                        {settlePerson.groups.map(g => (
                            <li key={g.groupId}>
                                <button className="list-item" onClick={() => { setSettleTarget({ person: settlePerson, group: g }); setSettlePerson(null); }}>
                                    <div className="grow list-item-title">{g.groupName}</div>
                                    <BalanceText amount={g.amount} />
                                </button>
                            </li>
                        ))}
                    </ul>
                </Sheet>
            )}

            {settleTarget && (
                <SettleSheet
                    groupId={settleTarget.group.groupId}
                    groupName={settleTarget.group.groupName}
                    me={user}
                    other={{ id: settleTarget.person.userId, username: settleTarget.person.username }}
                    direction={settleTarget.group.amount < 0 ? 'pay' : 'receive'}
                    suggestedAmount={settleTarget.group.amount}
                    onClose={() => setSettleTarget(null)}
                    onDone={reload}
                />
            )}

            {showPickGroup && (
                <Sheet title="Add expense to…" onClose={() => setShowPickGroup(false)}>
                    <ul className="list card">
                        {data.groups.map(g => (
                            <li key={g.id}>
                                <Link className="list-item" to={`/groups/${g.id}/expenses/new`}>
                                    <Avatar name={g.name} id={g.id} group size="sm" />
                                    <span className="grow list-item-title">{g.name}</span>
                                    <ChevronRight size={18} className="muted" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Sheet>
            )}

            {showNewGroup && <NewGroupSheet onClose={() => setShowNewGroup(false)} onCreated={(id) => navigate(`/groups/${id}?invite=1`)} />}
        </main>
    );
}

export const NewGroupSheet = ({ onClose, onCreated }) => {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const { groupId } = await api.createGroup(name.trim());
            onCreated(groupId);
        } catch (err) {
            setError(err);
            setSaving(false);
        }
    };

    return (
        <Sheet title="New group" onClose={onClose}>
            <form className="stack" onSubmit={submit}>
                <label className="field">
                    <span className="label">Group name</span>
                    <input className="input" placeholder="Goa trip, Flat 4B, Office lunch…" value={name} onChange={e => setName(e.target.value)} maxLength={100} required />
                </label>
                <ErrorNotice error={error} />
                <button className="btn btn-primary btn-block" disabled={saving || !name.trim()}>{saving ? 'Creating…' : 'Create and invite friends'}</button>
            </form>
        </Sheet>
    );
};
