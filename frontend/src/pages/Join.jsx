import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import { api } from '../api';
import { useAuth, pendingInvite } from '../auth/AuthContext';
import { EmptyState, ErrorNotice, Spinner } from '../components/ui';

/** /join/:code: the page an invite link opens. Signed-out visitors are sent to log in or sign up first. */
export default function Join() {
    const { code } = useParams();
    const { isSignedIn } = useAuth();
    const navigate = useNavigate();
    const [preview, setPreview] = useState(null);
    const [error, setError] = useState(null);
    const [joining, setJoining] = useState(false);

    useEffect(() => {
        if (!isSignedIn) {
            pendingInvite.save(code); // picked up again right after login
            return;
        }
        api.previewInvite(code)
            .then(res => (res.alreadyMember ? navigate(`/groups/${res.group.id}`, { replace: true }) : setPreview(res.group)))
            .catch(setError);
    }, [code, isSignedIn, navigate]);

    const join = async () => {
        setJoining(true);
        try {
            const { groupId } = await api.joinInvite(code);
            navigate(`/groups/${groupId}`, { replace: true });
        } catch (err) {
            setError(err);
            setJoining(false);
        }
    };

    if (!isSignedIn) {
        return (
            <main className="page page-narrow">
                <section className="card">
                    <EmptyState icon={<Users size={26} />} title="You've been invited to a group">
                        Log in or create a free account to join and start splitting expenses.
                    </EmptyState>
                    <div className="stack card-pad" style={{ paddingTop: 0 }}>
                        <Link className="btn btn-primary btn-block" to="/register">Create an account</Link>
                        <Link className="btn btn-secondary btn-block" to="/login">I already have an account</Link>
                    </div>
                </section>
            </main>
        );
    }

    if (error) {
        return (
            <main className="page page-narrow">
                <ErrorNotice error={error} />
                <Link className="btn btn-secondary" to="/home">Go to home</Link>
            </main>
        );
    }
    if (!preview) return <main className="page"><Spinner /></main>;

    return (
        <main className="page page-narrow">
            <section className="card">
                <EmptyState icon={<Users size={26} />} title={`Join "${preview.name}"`}>
                    {preview.created_by_name} invited you · {preview.member_count} {preview.member_count === 1 ? 'member' : 'members'}
                </EmptyState>
                <div className="card-pad" style={{ paddingTop: 0 }}>
                    <button className="btn btn-primary btn-block" onClick={join} disabled={joining}>{joining ? 'Joining…' : 'Join group'}</button>
                </div>
            </section>
        </main>
    );
}
