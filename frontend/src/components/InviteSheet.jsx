import { useEffect, useState } from 'react';
import { Copy, Check, MessageCircle, Share2, RotateCcw } from 'lucide-react';
import { Sheet, ErrorNotice, Spinner } from './ui';
import { api } from '../api';

/** Share the group's invite link (WhatsApp, copy, native share) or add someone by email. */
export const InviteSheet = ({ group, isCreator, onClose, onMemberAdded }) => {
    const [code, setCode] = useState(null);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [email, setEmail] = useState('');
    const [emailStatus, setEmailStatus] = useState(null);

    useEffect(() => {
        api.inviteCode(group.id).then(r => setCode(r.code)).catch(setError);
    }, [group.id]);

    const link = code ? `${window.location.origin}/join/${code}` : '';
    const message = `Join "${group.name}" on FairShare so we can split expenses: ${link}`;

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError(new Error('Could not copy automatically. Select the link and copy it.'));
        }
    };

    const reset = async () => {
        if (!window.confirm('Reset the link? The old link will stop working for anyone who has not joined yet.')) return;
        try {
            setCode((await api.resetInvite(group.id)).code);
        } catch (err) {
            setError(err);
        }
    };

    const addByEmail = async (e) => {
        e.preventDefault();
        setEmailStatus(null);
        try {
            await api.addMemberByEmail(group.id, email.trim());
            setEmailStatus({ ok: true, text: `${email.trim()} was added to the group.` });
            setEmail('');
            onMemberAdded?.();
        } catch (err) {
            setEmailStatus({ ok: false, text: err.message });
        }
    };

    return (
        <Sheet title={`Invite to ${group.name}`} onClose={onClose}>
            <div className="stack">
                <ErrorNotice error={error} />
                {!code && !error ? <Spinner /> : code && (
                    <>
                        <p className="muted small">Anyone with this link can join the group after signing in.</p>
                        <input className="input small" readOnly value={link} onFocus={e => e.target.select()} aria-label="Invite link" />
                        <a className="btn btn-primary btn-block" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                            <MessageCircle size={18} /> Share on WhatsApp
                        </a>
                        <div className="row">
                            <button className="btn btn-secondary grow" onClick={copy}>
                                {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy link</>}
                            </button>
                            {navigator.share && (
                                <button className="btn btn-secondary grow" onClick={() => navigator.share({ title: group.name, text: message }).catch(() => {})}>
                                    <Share2 size={16} /> Share
                                </button>
                            )}
                        </div>
                        {isCreator && (
                            <button className="btn btn-ghost btn-sm" onClick={reset} style={{ alignSelf: 'center' }}>
                                <RotateCcw size={14} /> Reset link
                            </button>
                        )}
                    </>
                )}

                <form className="stack" onSubmit={addByEmail} style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <label className="field">
                        <span className="label">Or add someone who already has an account</span>
                        <div className="row">
                            <input className="input" type="email" placeholder="friend@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                            <button className="btn btn-secondary" type="submit">Add</button>
                        </div>
                    </label>
                    {emailStatus && <p className={emailStatus.ok ? 'positive small' : 'error-text'}>{emailStatus.text}</p>}
                </form>
            </div>
        </Sheet>
    );
};
