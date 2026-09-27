import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../api';
import { useApiData } from '../hooks/useApiData';
import { useSocketEvents } from '../context/SocketContext';
import { EmptyState, ErrorNotice, Spinner } from '../components/ui';
import { timeAgo } from '../utils/format';

/** What changed and who did it: expenses added, payments made and confirmed. */
export default function Activity() {
    const { data, error, loading, reload } = useApiData(null, api.notifications);
    useSocketEvents(['update_notifications'], reload);

    // Opening this screen marks everything as read
    useEffect(() => {
        api.markNotificationsRead().catch(() => {});
    }, [data]);

    if (loading) return <main className="page"><Spinner /></main>;
    const notifications = data?.notifications || [];

    return (
        <main className="page">
            <h1>Activity</h1>
            <ErrorNotice error={error} onRetry={reload} />
            {notifications.length === 0 ? (
                <section className="card"><EmptyState icon={<Bell size={26} />} title="Nothing yet">Expenses and payments in your groups will show up here.</EmptyState></section>
            ) : (
                <ul className="list card">
                    {notifications.map(n => (
                        <li key={n.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, marginTop: 8, flexShrink: 0, background: n.is_read ? 'transparent' : 'var(--accent)' }} />
                            <div className="grow">
                                <p>{n.message}</p>
                                <p className="tiny muted">{timeAgo(n.created_at)}</p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}
