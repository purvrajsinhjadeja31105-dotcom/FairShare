import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Check, X, Clock, HelpCircle } from 'lucide-react';
import { apiCall } from '../api';

const AddExpense = () => {
    const { id, expenseId } = useParams();
    const isEdit = !!expenseId;
    const navigate = useNavigate();
    const location = useLocation();
    const initialDirection = location.state?.initialDirection || 'others_owe';
    const [group, setGroup] = useState(null);
    const [members, setMembers] = useState([]);
    
    // Form states
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [splitType, setSplitType] = useState('equal'); // 'equal' vs 'custom'
    const [customSplits, setCustomSplits] = useState({}); // { userId: { amount, reason } }
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [splitSearchQuery, setSplitSearchQuery] = useState('');
    const [isAutoSplitActive, setIsAutoSplitActive] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentUser = JSON.parse(localStorage.getItem('splitwise_user'));

    useEffect(() => {
        fetchInitialData();
    }, [id]);

    const fetchInitialData = async () => {
        try {
            const grpData = await apiCall(`/groups/${id}`);
            setGroup(grpData.group);
            
            // Redirect if no admin (unless personal)
            if (!grpData.group.admin_id && !grpData.group.is_personal) {
                alert("Cannot add/edit expense: This group has no admin. Please elect one first.");
                navigate(`/group/${id}`);
                return;
            }

            const memData = await apiCall(`/groups/${id}/members`);
            setMembers(memData.members);

            if (isEdit) {
                const expData = await apiCall(`/expenses/${id}/all`);
                const exp = expData.expenses.find(e => e.id == expenseId);
                if (exp) {
                    setDescription(exp.description);
                    setAmount(exp.amount.toString());
                    // Simple logic for loading splits: if only 1 split and it matches total, maybe treat as custom if user wants
                    // For now, just set description and amount.
                    if (exp.splits && exp.splits.length > 0) {
                        const newCustomSplits = {};
                        exp.splits.forEach(s => {
                            newCustomSplits[s.userId] = { amount: s.amount.toString(), reason: '' };
                        });
                        setCustomSplits(newCustomSplits);
                        setSelectedMemberIds(exp.splits.map(s => s.userId));
                        if (exp.splits.length < memData.members.length) {
                             setSplitType('custom');
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err);
            navigate(`/group/${id}`);
        }
    };

    // Auto-calculate divisions whenever amount or selection changes
    useEffect(() => {
        if (splitType === 'custom' && isAutoSplitActive && amount > 0 && selectedMemberIds.length > 0) {
            const perPerson = (parseFloat(amount) / selectedMemberIds.length).toFixed(2);
            const newSplits = {};
            selectedMemberIds.forEach(id => {
                newSplits[id] = { 
                    amount: perPerson, 
                    reason: customSplits[id]?.reason || '' 
                };
            });
            setCustomSplits(newSplits);
        }
    }, [amount, selectedMemberIds, splitType, isAutoSplitActive]);

    const toggleMemberSelection = (memberId) => {
        const isNowSelected = !selectedMemberIds.includes(memberId);
        setSelectedMemberIds(prev =>
            isNowSelected ? [...prev, memberId] : prev.filter(mid => mid !== memberId)
        );

        if (isNowSelected) {
            setCustomSplits(prev => ({
                ...prev,
                [memberId]: { amount: '', reason: '' }
            }));
        }
    };

    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);

        try {
            // Current user is always the payer
            const finalPayerId = currentUser.id;

            if (splitType === 'equal') {
                if (!amount || !description) throw new Error('Please enter description and amount');
                const splitAmount = (parseFloat(amount) / members.length).toFixed(2);
                const splits = members.map(m => ({ userId: m.id, amount_owed: splitAmount }));
                
                await apiCall(isEdit ? `/expenses/${expenseId}` : `/expenses/${id}`, isEdit ? 'PUT' : 'POST', {
                    amount,
                    description,
                    splits,
                    paidBy: finalPayerId
                });
            } else {
                const activeEntries = Object.entries(customSplits).filter(([userId, data]) =>
                    selectedMemberIds.includes(parseInt(userId)) && parseFloat(data.amount || 0) > 0
                );

                if (activeEntries.length === 0) throw new Error('Please select at least one person and enter their debt amount');

                if (isEdit) {
                     // For edit, we only support updating a single expense entry as defined by its ID.
                     // The multi-entry "custom" mode in the original AddExpense.jsx creates MULTIPLE expenses.
                     // We'll handle edit by updating just this one.
                     const data = activeEntries[0][1];
                     const uid = activeEntries[0][0];
                     await apiCall(`/expenses/${expenseId}`, 'PUT', {
                        amount: data.amount,
                        description: data.reason || description,
                        splits: [{ userId: parseInt(uid), amount_owed: data.amount }],
                        paidBy: finalPayerId
                     });
                } else {
                    for (const [userId, data] of activeEntries) {
                        const finalDebtDesc = data.reason || description || 'Individual Debt';
                        await apiCall(`/expenses/${id}`, 'POST', {
                            amount: data.amount,
                            description: finalDebtDesc,
                            splits: [{ userId: parseInt(userId), amount_owed: data.amount }],
                            paidBy: finalPayerId
                        });
                    }
                }
            }

            navigate(`/group/${id}`);
        } catch (err) {
            alert(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button className="btn-ghost" onClick={() => navigate(`/group/${id}`)} style={{ padding: '0.5rem' }}>
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-gradient" style={{ margin: 0 }}>{isEdit ? 'Edit Expense' : 'Add New Expense'}</h1>
                    <p style={{ margin: 0, opacity: 0.6, fontSize: '0.9rem' }}>{group?.name}</p>
                </div>
            </div>

            <form onSubmit={handleAddExpense} className="glass-card" style={{ padding: '2rem' }}>

                <div style={{ marginBottom: '2.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '1.25rem', fontWeight: '800', fontSize: '1.2rem', color: 'var(--text-primary)' }}>Expense details</label>
                    <div style={{ display: 'flex', gap: '0', background: 'rgba(255,255,255,0.04)', padding: '0.4rem', borderRadius: '16px', marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <button
                            type="button"
                            onClick={() => setSplitType('equal')}
                            style={{ 
                                flex: 1, padding: '0.9rem 1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', 
                                fontSize: '0.9rem', fontWeight: '700', transition: 'all 0.25s',
                                background: splitType === 'equal' ? 'var(--accent-primary)' : 'transparent',
                                color: splitType === 'equal' ? '#fff' : 'var(--text-secondary)',
                                boxShadow: splitType === 'equal' ? '0 4px 15px rgba(99,102,241,0.4)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                            }}
                        >
                            {splitType === 'equal' && <Check size={16} strokeWidth={3} />}
                            Split Equally
                        </button>
                        <button
                            type="button"
                            onClick={() => setSplitType('custom')}
                            style={{ 
                                flex: 1, padding: '0.9rem 1rem', borderRadius: '12px', border: 'none', cursor: 'pointer', 
                                fontSize: '0.9rem', fontWeight: '700', transition: 'all 0.25s',
                                background: splitType === 'custom' ? 'var(--accent-primary)' : 'transparent',
                                color: splitType === 'custom' ? '#fff' : 'var(--text-secondary)',
                                boxShadow: splitType === 'custom' ? '0 4px 15px rgba(99,102,241,0.4)' : 'none',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                            }}
                        >
                            {splitType === 'custom' && <Check size={16} strokeWidth={3} />}
                            Individual / Subset
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                         <div style={{ flex: 2 }}>
                            <input
                                type="text" placeholder="Description (e.g. Dinner, Rent)" className="input-field"
                                value={description} onChange={e => setDescription(e.target.value)}
                                style={{ padding: '1.1rem', fontSize: '1.1rem', borderRadius: '14px' }}
                                required
                            />
                         </div>
                         {splitType === 'equal' && (
                            <div style={{ flex: 1, position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '1.1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.2rem', opacity: 0.6 }}>₹</span>
                                <input
                                    type="number" step="0.01" placeholder="Amount" className="input-field"
                                    value={amount} onChange={e => setAmount(e.target.value)} required
                                    style={{ padding: '1.1rem 1rem 1.1rem 2.4rem', fontSize: '1.2rem', borderRadius: '14px' }}
                                />
                            </div>
                         )}
                    </div>

                    {splitType === 'custom' && (
                        <div style={{ animation: 'slideDown 0.4s ease-out', marginTop: '2rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', opacity: 0.8 }}>
                                    Add expense for each person
                                </h4>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        type="button" className="btn-ghost"
                                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem', borderRadius: '8px' }}
                                        onClick={() => setSelectedMemberIds(members.filter(m => m.id !== currentUser?.id).map(m => m.id))}
                                    >Select All</button>
                                    <button
                                        type="button" className="btn-ghost"
                                        style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem', borderRadius: '8px' }}
                                        onClick={() => { setSelectedMemberIds([]); setCustomSplits({}); }}
                                    >Clear</button>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {members
                                    .filter(m => m.id !== currentUser?.id)
                                    .map(m => {
                                        const isIncluded = selectedMemberIds.includes(m.id);
                                        return (
                                            <div key={m.id} style={{
                                                borderRadius: '18px',
                                                border: `1px solid ${isIncluded ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.07)'}`,
                                                background: isIncluded ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
                                                transition: 'all 0.25s',
                                                overflow: 'hidden'
                                            }}>
                                                {/* Card Header — name + toggle */}
                                                <div
                                                    style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.25rem', cursor: 'pointer' }}
                                                    onClick={() => toggleMemberSelection(m.id)}
                                                >
                                                    {/* Avatar */}
                                                    <div style={{
                                                        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                                                        background: isIncluded ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontWeight: '800', fontSize: '1rem', color: '#fff', transition: 'all 0.25s'
                                                    }}>
                                                        {m.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span style={{ flex: 1, fontWeight: isIncluded ? '700' : '500', fontSize: '0.95rem' }}>{m.username}</span>
                                                    {/* Toggle pill */}
                                                    <div style={{
                                                        width: 44, height: 24, borderRadius: '12px', position: 'relative',
                                                        background: isIncluded ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)',
                                                        transition: 'background 0.25s', flexShrink: 0
                                                    }}>
                                                        <div style={{
                                                            position: 'absolute', top: 3, width: 18, height: 18, borderRadius: '50%',
                                                            background: '#fff', transition: 'left 0.25s',
                                                            left: isIncluded ? 23 : 3
                                                        }} />
                                                    </div>
                                                </div>

                                                {/* Expanded fields when included */}
                                                {isIncluded && (
                                                    <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', gap: '0.75rem' }} onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            placeholder="Description (e.g. Beer, Taxi, Dinner)"
                                                            className="input-field"
                                                            style={{ flex: 2, marginBottom: 0, padding: '0.75rem 1rem', fontSize: '0.9rem', borderRadius: '12px' }}
                                                            value={customSplits[m.id]?.reason || ''}
                                                            onChange={e => setCustomSplits({ ...customSplits, [m.id]: { ...customSplits[m.id], reason: e.target.value } })}
                                                        />
                                                        <div style={{ position: 'relative', flex: 1 }}>
                                                            <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>₹</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                placeholder="0.00"
                                                                className="input-field"
                                                                style={{ marginBottom: 0, padding: '0.75rem 0.75rem 0.75rem 1.9rem', fontSize: '1rem', borderRadius: '12px', textAlign: 'right' }}
                                                                value={customSplits[m.id]?.amount || ''}
                                                                onChange={e => {
                                                                    setIsAutoSplitActive(false);
                                                                    setCustomSplits({ ...customSplits, [m.id]: { ...customSplits[m.id], amount: e.target.value } });
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                }
                            </div>

                            {/* Total */}
                            {selectedMemberIds.length > 0 && (
                                <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', borderRadius: '14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ opacity: 0.7, fontSize: '0.9rem' }}>{selectedMemberIds.length} person{selectedMemberIds.length > 1 ? 's' : ''} included · Total</span>
                                    <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent-primary)' }}>
                                        ₹{Object.entries(customSplits).filter(([uid]) => selectedMemberIds.includes(parseInt(uid))).reduce((acc, [_, d]) => acc + parseFloat(d.amount || 0), 0).toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '4rem' }}>
                    <button 
                        type="button" className="btn-ghost" style={{ flex: 1, padding: '1.2rem', borderRadius: '16px', fontWeight: 'bold' }}
                        onClick={() => navigate(`/group/${id}`)}
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" className="btn-primary" 
                        style={{ flex: 2.5, padding: '1.2rem', borderRadius: '16px', fontSize: '1.1rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', boxShadow: '0 15px 30px -10px rgba(99, 102, 241, 0.4)' }}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <>
                                <div className="spinner" style={{ width: 20, height: 20, border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1.5s linear infinite' }}></div>
                                Recording Everything...
                            </>
                        ) : (
                            <>
                                {!isEdit && <Plus size={22} strokeWidth={3} />}
                                {isEdit ? 'Save Changes' : (splitType === 'equal' ? 'Add Group Expense' : 'Record All Individual Debts')}
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AddExpense;
