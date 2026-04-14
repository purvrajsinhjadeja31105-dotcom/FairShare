import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiCall } from '../api';
import { useSocket } from '../context/SocketContext';
import { X, Search, UserPlus, User, PlusCircle, CheckCircle, Users, ArrowRight, DollarSign, Activity, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, MoreVertical, Trash2, LogOut, ExternalLink, Wallet } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [summary, setSummary] = useState({ youOwe: [], youAreOwed: [] });
  const [loading, setLoading] = useState(true);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSummary, setActiveSummary] = useState(null); // 'received' or 'pay'
  const summaryRef = React.useRef(null);
  const socket = useSocket();

  // Personal Expense States (Quick Action)
  const [showPersonalExpense, setShowPersonalExpense] = useState(false);
  const [personalItems, setPersonalItems] = useState([{ description: '', amount: '' }]);
  const [addingExpense, setAddingExpense] = useState(false);

  const addExpenseRow = () => setPersonalItems([...personalItems, { description: '', amount: '' }]);
  const removeExpenseRow = (index) => {
    if (personalItems.length > 1) {
      setPersonalItems(personalItems.filter((_, i) => i !== index));
    }
  };
  const updateExpenseItem = (index, field, value) => {
    const newItems = [...personalItems];
    newItems[index][field] = value;
    setPersonalItems(newItems);
  };

  const user = JSON.parse(localStorage.getItem('splitwise_user'));
  const [personalTotal, setPersonalTotal] = useState(0);

  const fetchPersonalTotal = async (allGroups) => {
    try {
      const personalGrp = allGroups.find(g => g.is_personal);
      if (personalGrp) {
        const recentData = await apiCall('/expenses/recent');
        const personalExps = recentData.recentExpenses.filter(e => e.group_id === personalGrp.id);
        const total = personalExps.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        setPersonalTotal(total);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchGroups().then(data => {
      if (data?.groups) fetchPersonalTotal(data.groups);
    });
    fetchSummary();
    fetchRecent();

    // Close summary dropdown on click outside
    const handleClickOutside = (e) => {
      if (summaryRef.current && !summaryRef.current.contains(e.target)) {
        setActiveSummary(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Real-time socket listeners
  useEffect(() => {
    if (socket) {
      socket.on('update_groups', () => {
        fetchGroups().then(data => {
          if (data?.groups) fetchPersonalTotal(data.groups);
        });
      });
      socket.on('update_expenses', () => {
        fetchRecent();
      });
      socket.on('update_summary', () => {
        fetchSummary();
      });

      return () => {
        socket.off('update_groups');
        socket.off('update_expenses');
        socket.off('update_summary');
      };
    }
  }, [socket]);


  const fetchRecent = async () => {
    try {
      const data = await apiCall('/expenses/recent');
      setRecentExpenses(data.recentExpenses);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGroups = async () => {
    try {
      const data = await apiCall('/groups');
      setGroups(data.groups);
      return data;
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const data = await apiCall('/expenses/summary');
      setSummary(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickPersonalExpense = async (e) => {
    e.preventDefault();
    const validItems = personalItems.filter(item => item.description && item.amount);
    if (validItems.length === 0) return;
    
    setAddingExpense(true);

    try {
      let personalGroup = groups.find(g => g.is_personal);
      if (!personalGroup) {
        const res = await apiCall('/groups', 'POST', { name: 'Personal Tracker', is_personal: true });
        personalGroup = { id: res.groupId };
      }

      // Process each item
      for (const item of validItems) {
        await apiCall(`/expenses/${personalGroup.id}`, 'POST', {
          description: item.description,
          amount: item.amount,
          splits: [{ userId: user.id, amount_owed: item.amount }]
        });
      }

      setPersonalItems([{ description: '', amount: '' }]);
      setShowPersonalExpense(false);
      alert(`${validItems.length} personal expense(s) added!`);

      const updatedGroups = await fetchGroups();
      if (updatedGroups?.groups) {
        fetchPersonalTotal(updatedGroups.groups);
      }
      fetchSummary();
      fetchRecent();
    } catch (err) {
      alert(err.message);
    } finally {
      setAddingExpense(false);
    }
  };

  const totalOwedToYou = summary.youAreOwed.reduce((sum, item) => sum + item.amount, 0);
  const totalYouOwe = summary.youOwe.reduce((sum, item) => sum + item.amount, 0);

  const [openMenuId, setOpenMenuId] = useState(null);

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to PERMANENTLY delete this group for everyone?')) return;
    try {
      await apiCall(`/groups/${groupId}`, 'DELETE');
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleExitGroup = async (groupId) => {
    if (!window.confirm('Are you sure you want to exit this group?')) return;
    try {
      await apiCall(`/groups/${groupId}/leave`, 'POST');
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <h1 className="text-gradient" style={{ margin: 0, fontSize: '2rem' }}>Dashboard</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="btn-primary"
            onClick={() => setShowPersonalExpense(!showPersonalExpense)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.6rem', 
              padding: '0.8rem 1.5rem', borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
            }}
          >
            <PlusCircle size={20} /> Personal Expense
          </button>
          <button
            className="btn-ghost"
            onClick={() => navigate('/create-group')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.6rem', 
              padding: '0.8rem 1.5rem', borderRadius: '12px',
              borderWidth: '2px'
            }}
          >
            <UserPlus size={20} /> Create Group
          </button>
        </div>
      </div>

      {showPersonalExpense && (
        <div className="glass-card" style={{ marginBottom: '2rem', padding: '1.5rem', border: '2px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} className="text-gradient" /> Quick Track Expense
            </h3>
            <button className="btn-ghost" style={{ padding: '0.25rem', border: 'none', background: 'transparent' }} onClick={() => setShowPersonalExpense(false)}>
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleQuickPersonalExpense}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {personalItems.map((item, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 40px', gap: '1rem', alignItems: 'center' }}>
                  <input
                    type="text" placeholder="What did you spend on?" className="input-field"
                    value={item.description} onChange={e => updateExpenseItem(index, 'description', e.target.value)} required
                    style={{ marginBottom: 0 }}
                  />
                  <input
                    type="number" step="0.01" placeholder="Amount (₹)" className="input-field"
                    value={item.amount} onChange={e => updateExpenseItem(index, 'amount', e.target.value)} required
                    style={{ marginBottom: 0 }}
                  />
                  {personalItems.length > 1 ? (
                    <button type="button" className="btn-ghost" onClick={() => removeExpenseRow(index)} style={{ padding: '0.5rem', border: 'none', color: 'var(--danger)' }}>
                      <Trash2 size={18} />
                    </button>
                  ) : <div />}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn-ghost" onClick={addExpenseRow} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <PlusCircle size={16} /> Add Another Item
              </button>
              <button type="submit" className="btn-primary" disabled={addingExpense} style={{ minWidth: '150px' }}>
                {addingExpense ? 'Saving...' : `Save ${personalItems.length} Expenses`}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="layout-split" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Left Side: Groups List (ONLY) */}
        <div style={{ flex: '3', minWidth: '350px' }}>
          <div className="glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Users size={22} /> Your Groups
              </h2>
              <div style={{ position: 'relative', width: '450px' }}>
                <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input 
                  type="text" 
                  placeholder="Search groups..." 
                  className="input-field"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ marginBottom: 0, paddingLeft: '32px', paddingTop: '0.4rem', paddingBottom: '0.4rem', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {loading ? <p>Loading groups...</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {groups
                  .filter(g => !g.is_personal) // Hide personal tracker from this list
                  .filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map(g => (
                    <div key={g.id} className="search-item" style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'var(--bg-secondary)', padding: '0.65rem 1rem', borderRadius: '14px',
                      border: '1px solid var(--border-color)', transition: 'all 0.2s', position: 'relative',
                      zIndex: openMenuId === g.id ? 100 : 1
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/group/${g.id}`)}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '10px',
                        background: g.is_personal ? 'var(--success)' : 'var(--accent-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
                      }}>
                        {g.is_personal ? <User size={18} /> : <Users size={18} />}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{g.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Users size={12} /> {g.member_count} {g.member_count === 1 ? 'Member' : 'Members'}
                          {!!g.is_personal && <span style={{ opacity: 0.6 }}>• Personal</span>}
                        </div>
                      </div>
                    </div>
                    
                    {/* 3-Dot Menu */}
                    <div style={{ position: 'relative' }}>
                      <button 
                        className="btn-ghost" 
                        style={{ padding: '0.4rem', borderRadius: '0', border: 'none' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === g.id ? null : g.id);
                        }}
                      >
                        <MoreVertical size={20} />
                      </button>

                      {openMenuId === g.id && (
                        <div className="glass-card" style={{
                          position: 'absolute', right: 0, top: '100%', zIndex: 100,
                          width: '180px', padding: '0.5rem', marginTop: '0.5rem',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: '1px solid var(--border-color)'
                        }}>
                          <div 
                            className="search-item" 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}
                            onClick={() => { setOpenMenuId(null); navigate(`/group/${g.id}`); }}
                          >
                            <ExternalLink size={16} /> More Details
                          </div>
                          <div 
                            className="search-item" 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem', fontSize: '0.9rem', cursor: 'pointer' }}
                            onClick={() => { setOpenMenuId(null); handleExitGroup(g.id); }}
                          >
                            <LogOut size={16} /> Exit Group
                          </div>
                          <div 
                            className="search-item" 
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem', fontSize: '0.9rem', cursor: 'pointer', color: 'var(--danger)' }}
                            onClick={() => { setOpenMenuId(null); handleDeleteGroup(g.id); }}
                          >
                            <Trash2 size={16} /> Delete Group
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {groups.filter(g => !g.is_personal).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>You don't have any groups yet.</p>
                    <button className="btn-primary" onClick={() => navigate('/create-group')}>Create your first group</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Financial Summary and Activity */}
        <div style={{ flex: '1.5', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Personal Spending Summary */}
          <div 
            className="glass-card" 
            onClick={() => personalTotal > 0 ? navigate('/personal-history') : setShowPersonalExpense(true)}
            style={{ 
              padding: '1rem', background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-primary))',
              border: personalTotal === 0 ? '2px dashed var(--accent-primary)' : '1px solid var(--accent-primary)', 
              cursor: 'pointer', transition: 'transform 0.2s',
              opacity: personalTotal === 0 ? 0.8 : 1
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: '10px', background: personalTotal === 0 ? 'var(--text-secondary)' : 'var(--accent-primary)', color: 'white' }}>
                {personalTotal === 0 ? <PlusCircle size={18} /> : <Wallet size={18} />}
              </div>
              <ArrowRight size={16} style={{ color: 'var(--accent-primary)' }} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Personal Spending
              </div>
              {personalTotal === 0 ? (
                <div style={{ marginTop: '0.25rem' }}>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>No spending added</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', marginTop: '0.1rem', fontWeight: '600' }}>
                    Click to add!
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: '0.25rem' }}>₹{personalTotal.toFixed(2)}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', marginTop: '0.25rem', fontWeight: '600' }}>
                    View history →
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Financial Summary Vertical Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Total Balance Card */}
            <div className="glass-card" style={{ padding: '0.9rem 1.25rem', borderLeft: '4px solid var(--accent-primary)', cursor: 'default' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ padding: '0.4rem', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)' }}>
                  <DollarSign size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Overall Balance</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: '800' }}>
                    ₹{(totalOwedToYou - totalYouOwe).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Clickable Card: Money Coming In */}
            <div style={{ position: 'relative' }}>
              <div 
                className="glass-card" 
                onClick={() => setActiveSummary(activeSummary === 'received' ? null : 'received')}
                style={{ 
                  padding: '0.9rem 1.25rem', borderLeft: '4px solid var(--success)', cursor: 'pointer', transition: 'all 0.2s',
                  background: activeSummary === 'received' ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-secondary)',
                  transform: activeSummary === 'received' ? 'translateX(5px)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.4rem', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                      <TrendingUp size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>You will get back</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--success)' }}>
                        ₹{totalOwedToYou.toFixed(0)}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} color="var(--success)" style={{ transform: activeSummary === 'received' ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s' }} />
                </div>
              </div>

              {activeSummary === 'received' && (
                <div className="glass-card" style={{ 
                  marginTop: '0.5rem', padding: '1rem', zIndex: 50,
                  border: '1px solid rgba(16, 185, 129, 0.2)', animation: 'slideDown 0.3s ease-out'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {summary.youAreOwed.length === 0 ? <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>Nobody owes you!</p> :
                      summary.youAreOwed.map((item, idx) => (
                        <div key={idx} style={{ paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{item.username}</span>
                            <span style={{ fontWeight: '800', color: 'var(--success)' }}>₹{item.amount.toFixed(0)}</span>
                          </div>
                          {item.details?.map((d, j) => (
                            <div key={j} style={{ fontSize: '0.75rem', opacity: 0.6, display: 'flex', justifyContent: 'space-between' }}>
                              <span>in {d.group}</span>
                              <span>₹{d.amount.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>

            {/* Clickable Card: Money You Owe */}
            <div style={{ position: 'relative' }}>
              <div 
                className="glass-card" 
                onClick={() => setActiveSummary(activeSummary === 'pay' ? null : 'pay')}
                style={{ 
                  padding: '0.9rem 1.25rem', borderLeft: '4px solid var(--danger)', cursor: 'pointer', transition: 'all 0.2s',
                  background: activeSummary === 'pay' ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-secondary)',
                  transform: activeSummary === 'pay' ? 'translateX(5px)' : 'none'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ padding: '0.4rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                      <TrendingDown size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>You have to pay</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--danger)' }}>
                        ₹{totalYouOwe.toFixed(0)}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={16} color="var(--danger)" style={{ transform: activeSummary === 'pay' ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s' }} />
                </div>
              </div>

              {activeSummary === 'pay' && (
                <div className="glass-card" style={{ 
                  marginTop: '0.5rem', padding: '1rem', zIndex: 50,
                  border: '1px solid rgba(239, 68, 68, 0.2)', animation: 'slideDown 0.3s ease-out'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {summary.youOwe.length === 0 ? <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>You owe nothing!</p> :
                      summary.youOwe.map((item, idx) => (
                        <div key={idx} style={{ paddingBottom: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{item.username}</span>
                            <span style={{ fontWeight: '800', color: 'var(--danger)' }}>₹{item.amount.toFixed(0)}</span>
                          </div>
                          {item.details?.map((d, j) => (
                            <div key={j} style={{ fontSize: '0.75rem', opacity: 0.6, display: 'flex', justifyContent: 'space-between' }}>
                              <span>in {d.group}</span>
                              <span>₹{d.amount.toFixed(0)}</span>
                            </div>
                          ))}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity Card */}
          <div className="glass-card" style={{ padding: '1.1rem' }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
              <Activity size={16} /> Recent Activity
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentExpenses.length > 0 ? recentExpenses.map(exp => (
                <div key={exp.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
                  <div style={{ fontWeight: '600', fontSize: '0.85rem' }}>{exp.description}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    <span style={{ fontWeight: '500' }}>{exp.paid_by_name}</span> paid <span style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>₹{parseFloat(exp.amount).toFixed(2)}</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '0.2rem' }}>
                    in {exp.group_name} • {new Date(exp.created_at).toLocaleDateString()}
                  </div>
                </div>
              )) : (
                <p style={{ fontSize: '0.8rem', textAlign: 'center', padding: '0.75rem 0' }}>No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;


