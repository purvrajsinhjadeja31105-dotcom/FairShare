import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiCall } from '../api';
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, User } from 'lucide-react';

const OwedSummary = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [summary, setSummary] = useState({ youOwe: [], youAreOwed: [] });
    const [loading, setLoading] = useState(true);

    // Determine type from query param or state? Let's use path
    const isOwedByOthers = location.pathname.includes('owed-by-others');

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const data = await apiCall('/expenses/summary');
                setSummary(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, []);

    const data = isOwedByOthers ? summary.youAreOwed : summary.youOwe;
    const title = isOwedByOthers ? "People who owe you" : "People you owe";
    const total = data.reduce((sum, item) => sum + item.amount, 0);

    const handleQuickSettle = async (item, detail) => {
        const promptMsg = isOwedByOthers 
            ? `How much did ${item.username} pay you in "${detail.group}"?` 
            : `How much did you pay ${item.username} in "${detail.group}"?`;
            
        const amount = prompt(promptMsg, detail.amount.toFixed(2));
        if (amount === null) return;
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) return alert('Invalid amount');

        try {
            // For settlement, 'toUserId' is the person who is NOT the one recording the payment
            // If I owe Alice, I (from) pay Alice (to).
            // If Alice owes me, she (from) pays me (to). 
            // BUT our /settle endpoint always records the CURRENT USER as the payer.
            // So if Alice owes me, SHE must settle it. 
            // However, the user asked to "cut money" if someone paid THEM.
            // If Alice paid me 20, I should record an expense paid by ALICE where I owe her 20.
            // Actually, the easiest way to record "Alice paid me" is:
            // I paid Alice -20. (But amount must be positive).
            // Let's stick to the logic: The payer is the one entering the data for themselves, 
            // OR if I received money, I record that Alice paid me.
            
            // To keep it simple: Settle endpoint always assumes CURRENT USER is the one WHO GAVE MONEY.
            // So if I am "I owe others", I am the payer.
            // If I am "Others owe me", the OTHER person is the payer.
            
            // Let's adjust the endpoint to accept 'fromUserId' or just use a more flexible logic.
            // Actually, I'll just record it as an expense paid by the person who gave the cash.
            // If I received money from Alice, Alice is paid_by.
            
            await apiCall(`/expenses/${detail.groupId}/settle`, 'POST', { 
                toUserId: isOwedByOthers ? currentUser.id : item.userId,
                fromUserId: isOwedByOthers ? item.userId : currentUser.id,
                amount: val 
            });
            window.location.reload();
        } catch (err) {
            alert(err.message);
        }
    };

    const currentUser = JSON.parse(localStorage.getItem('splitwise_user'));

    return (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <button className="btn-ghost" onClick={() => navigate('/dashboard')} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowLeft size={18} /> Back to Dashboard
            </button>

            <div className="glass-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{
                        width: 50, height: 50, borderRadius: '12px',
                        background: isOwedByOthers ? 'var(--success)' : 'var(--danger)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                    }}>
                        {isOwedByOthers ? <ArrowDownLeft size={30} /> : <ArrowUpRight size={30} />}
                    </div>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{title}</h1>
                        <p style={{ margin: 0, fontWeight: 'bold' }} className={isOwedByOthers ? 'green-text' : 'red-text'}>
                            Total: ₹{total.toFixed(2)}
                        </p>
                    </div>
                </div>

                {loading ? <p>Loading details...</p> : (
                    <ul style={{ padding: 0 }}>
                        {data.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                                Clean slate! No outstanding amounts here.
                            </p>
                        ) : data.map((item, i) => (
                            <React.Fragment key={i}>
                                <li style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '12px',
                                    marginBottom: '0.75rem', border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: '50%',
                                            background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <User size={20} className="text-gradient" />
                                        </div>
                                        <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{item.username}</span>
                                    </div>
                                    <span className={isOwedByOthers ? 'green-text' : 'red-text'} style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                                        ₹{item.amount.toFixed(2)}
                                    </span>
                                </li>
                                {item.details && item.details.length > 0 && (
                                    <div style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', borderLeft: '2px solid var(--border-color)', marginLeft: '2.25rem' }}>
                                        {item.details.map((d, j) => (
                                            <div key={j} style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', paddingRight: '1rem', alignItems: 'center' }}>
                                                <span>in <strong>{d.group}</strong></span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <span>₹{d.amount.toFixed(2)}</span>
                                                    <button 
                                                        className="btn-ghost" 
                                                        style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                                        onClick={() => handleQuickSettle(item, d)}
                                                    >
                                                        Settle
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </React.Fragment>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default OwedSummary;
