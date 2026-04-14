import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, Calendar, Tag, CreditCard, Plus, X, Trash2, PlusCircle } from 'lucide-react';
import { apiCall } from '../api';

const PersonalHistory = () => {
    const navigate = useNavigate();
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalSpent, setTotalSpent] = useState(0);

    const [showAddForm, setShowAddForm] = useState(false);
    const [items, setItems] = useState([{ description: '', amount: '' }]);
    const [adding, setAdding] = useState(false);

    const addExpenseRow = () => setItems([...items, { description: '', amount: '' }]);
    const removeExpenseRow = (index) => {
        if (items.length > 1) {
            setItems(items.filter((_, i) => i !== index));
        }
    };
    const updateExpenseItem = (index, field, value) => {
        const newItems = [...items];
        newItems[index][field] = value;
        setItems(newItems);
    };

    useEffect(() => {
        fetchPersonalHistory();
    }, []);

    const fetchPersonalHistory = async () => {
        try {
            const groupsData = await apiCall('/groups');
            const personalGroup = groupsData.groups.find(g => g.is_personal);
            
            if (personalGroup) {
                const recentData = await apiCall('/expenses/recent');
                const personalExps = recentData.recentExpenses.filter(e => e.group_id === personalGroup.id);
                setExpenses(personalExps);
                
                const total = personalExps.reduce((sum, e) => sum + parseFloat(e.amount), 0);
                setTotalSpent(total);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickAdd = async (e) => {
        e.preventDefault();
        const validItems = items.filter(item => item.description && item.amount);
        if (validItems.length === 0) return;
        
        setAdding(true);
        try {
            const groupsData = await apiCall('/groups');
            let personalGroup = groupsData.groups.find(g => g.is_personal);
            
            if (!personalGroup) {
                const res = await apiCall('/groups', 'POST', { name: 'Personal Tracker', is_personal: true });
                personalGroup = { id: res.groupId };
            }

            const user = JSON.parse(localStorage.getItem('splitwise_user'));
            for (const item of validItems) {
                await apiCall(`/expenses/${personalGroup.id}`, 'POST', {
                    description: item.description,
                    amount: item.amount,
                    splits: [{ userId: user.id, amount_owed: item.amount }]
                });
            }

            setItems([{ description: '', amount: '' }]);
            setShowAddForm(false);
            fetchPersonalHistory();
        } catch (err) {
            alert(err.message);
        } finally {
            setAdding(false);
        }
    };

    return (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="btn-ghost" onClick={() => navigate('/dashboard')} style={{ padding: '0.5rem' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="text-gradient" style={{ margin: 0 }}>Spending History</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button 
                        className="btn-primary" 
                        onClick={() => setShowAddForm(!showAddForm)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', borderRadius: '10px' }}
                    >
                        {showAddForm ? <X size={18} /> : <Plus size={18} />}
                        {showAddForm ? 'Cancel' : 'Track Spent'}
                    </button>
                    <div className="glass-card" style={{ padding: '0.75rem 1.5rem', marginBottom: 0 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Tracked</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-primary)' }}>₹{totalSpent.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            {showAddForm && (
                <div className="glass-card" style={{ marginBottom: '2rem', padding: '1.5rem', border: '2px solid var(--accent-primary)' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Quick Track New Spent</h3>
                    <form onSubmit={handleQuickAdd}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                            {items.map((item, index) => (
                                <div key={index} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <input 
                                        type="text" placeholder="What did you spend on?" className="input-field" 
                                        style={{ flex: 2, marginBottom: 0 }} value={item.description} onChange={e => updateExpenseItem(index, 'description', e.target.value)} required
                                    />
                                    <input 
                                        type="number" step="0.01" placeholder="Amount" className="input-field" 
                                        style={{ flex: 1, marginBottom: 0 }} value={item.amount} onChange={e => updateExpenseItem(index, 'amount', e.target.value)} required
                                    />
                                    {items.length > 1 && (
                                        <button type="button" className="btn-ghost" onClick={() => removeExpenseRow(index)} style={{ padding: '0.4rem', border: 'none', color: 'var(--danger)' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button type="button" className="btn-ghost" onClick={addExpenseRow} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                                <PlusCircle size={16} /> Add Another Item
                            </button>
                            <button type="submit" className="btn-primary" disabled={adding} style={{ padding: '0.75rem 2rem' }}>
                                {adding ? 'Saving...' : `Save ${items.length} Expenses`}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="glass-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <Wallet size={20} className="text-gradient" />
                    <h2 style={{ margin: 0 }}>Your Individual Expenses</h2>
                </div>

                {loading ? (
                    <p>Loading your spending history...</p>
                ) : expenses.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                        <CreditCard size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <p style={{ color: 'var(--text-secondary)' }}>You haven't tracked any personal expenses yet.</p>
                        <button className="btn-primary" onClick={() => navigate('/dashboard')} style={{ marginTop: '1rem' }}>
                            Add your first expense
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {expenses.map(exp => (
                            <div key={exp.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '1.25rem', background: 'var(--bg-secondary)', borderRadius: '12px',
                                border: '1px solid var(--border-color)', transition: 'all 0.2s'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                    <div style={{ 
                                        width: 45, height: 45, borderRadius: '12px', background: 'var(--bg-primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <Tag size={20} className="text-gradient" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{exp.description}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                <Calendar size={14} /> {new Date(exp.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>₹{parseFloat(exp.amount).toFixed(2)}</div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: '600' }}>Self Paid</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PersonalHistory;
