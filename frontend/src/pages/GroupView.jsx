import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, X, UserPlus, Users, LogOut, ArrowLeft, Activity, TrendingUp, TrendingDown, Clock, MoreVertical, Trash2, Plus, Vote, CheckCircle, AlertTriangle, Edit3, Wallet } from 'lucide-react';
import { apiCall } from '../api';
import { useSocket } from '../context/SocketContext';

const GroupView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [balances, setBalances] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [userGroupSummary, setUserGroupSummary] = useState({ youAreOwed: 0, youOwe: 0 });
  const [showAddMember, setShowAddMember] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [activeOweList, setActiveOweList] = useState(null);
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);
  const [activityMenuOpen, setActivityMenuOpen] = useState(false);
  const [activeEntryMenuId, setActiveEntryMenuId] = useState(null);
  const optionsRef = useRef(null);
  const oweListRef = useRef(null);
  const activityActionsRef = useRef(null);
  const [settlementsDetails, setSettlementsDetails] = useState([]);
  const [activePoll, setActivePoll] = useState(null);
  const [isVoting, setIsVoting] = useState(false);
  const [activeActivityTab, setActiveActivityTab] = useState('mine'); // 'mine' or 'others'
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const socket = useSocket();


  // Settle states
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleWithUser, setSettleWithUser] = useState(null);
  const [settleSuccess, setSettleSuccess] = useState(false);

  const [deleteModalInfo, setDeleteModalInfo] = useState({ show: false, expenseId: null });

  // Add member search states
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const memberSearchTimeout = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem('splitwise_user'));

  useEffect(() => {
    fetchGroupData();
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target)) {
        setShowOptions(false);
      }
      if (oweListRef.current && !oweListRef.current.contains(event.target)) {
        setActiveOweList(null);
      }
      if (activityActionsRef.current && !activityActionsRef.current.contains(event.target)) {
        setActivityMenuOpen(false);
        setActiveEntryMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Real-time socket listeners
  useEffect(() => {
    if (socket) {
      socket.on('update_groups', (data) => {
        if (data.groupId == id) {
          fetchGroupData();
        }
      });
      socket.on('update_expenses', (data) => {
        if (data.groupId == id) {
          fetchGroupData();
        }
      });
      socket.on('update_poll', (data) => {
        if (data.groupId == id) {
          fetchGroupData();
        }
      });

      return () => {
        socket.off('update_groups');
        socket.off('update_expenses');
        socket.off('update_poll');
      };
    }
  }, [socket, id]);


  const fetchGroupData = async () => {
    try {
      const grpData = await apiCall(`/groups/${id}`);
      setGroup(grpData.group);

      const memData = await apiCall(`/groups/${id}/members`);
      setMembers(memData.members);

      const expData = await apiCall(`/expenses/${id}/all`);
      setExpenses(expData.expenses);

      const balData = await apiCall(`/expenses/${id}/settlements`);
      setBalances(balData.balances);
      setSettlementsDetails(balData.details || []);

      // Fetch active poll
      const pollData = await apiCall(`/groups/${id}/active-poll`);
      setActivePoll(pollData.poll);

      // Compute net totals from details (same logic as dropdown, avoids int/string key mismatch)
      const details = balData.details || [];
      let totalOwed = 0; // sum others owe you
      let totalOwe = 0;  // sum you owe others
      const netPerPerson = {};
      for (const d of details) {
        if (d.payer_id == currentUser.id && d.debtor_id != currentUser.id) {
          if (!netPerPerson[d.debtor_id]) netPerPerson[d.debtor_id] = 0;
          netPerPerson[d.debtor_id] += d.amount;
        }
        if (d.debtor_id == currentUser.id && d.payer_id != currentUser.id) {
          if (!netPerPerson[d.payer_id]) netPerPerson[d.payer_id] = 0;
          netPerPerson[d.payer_id] -= d.amount;
        }
      }
      for (const net of Object.values(netPerPerson)) {
        if (net > 0) totalOwed += net;
        else if (net < 0) totalOwe += Math.abs(net);
      }
      setUserGroupSummary({ youAreOwed: totalOwed, youOwe: totalOwe });

    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('WARNING: This will permanently delete the group and all expenses for EVERYONE. Proceed?')) return;
    try {
      await apiCall(`/groups/${id}`, 'DELETE');
      navigate('/dashboard');
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Are you sure you want to exit this group?')) return;
    try {
      await apiCall(`/groups/${id}/leave`, 'POST');
      navigate('/dashboard');
    } catch (err) {
      alert(err.message);
    }
  };

  // Live member search
  const handleMemberSearchChange = (e) => {
    const q = e.target.value;
    setMemberSearchQuery(q);
    clearTimeout(memberSearchTimeout.current);

    if (!q.trim()) {
      setMemberSearchResults([]);
      return;
    }

    memberSearchTimeout.current = setTimeout(async () => {
      setMemberSearching(true);
      try {
        const data = await apiCall(`/users/search?q=${encodeURIComponent(q)}`);
        // Filter out users already in the group
        const filtered = data.users.filter(
          u => !members.find(m => m.id === u.id)
        );
        setMemberSearchResults(filtered);
      } catch (err) {
        console.error(err);
      } finally {
        setMemberSearching(false);
      }
    }, 400);
  };

  const handleAddMemberFromSearch = async (user) => {
    try {
      await apiCall(`/groups/${id}/members`, 'POST', { email: user.email });
      setMemberSearchQuery('');
      setMemberSearchResults([]);
      fetchGroupData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteExpense = (expenseId) => {
    setDeleteModalInfo({ show: true, expenseId });
  };

  const executeDelete = async (type) => {
    const { expenseId } = deleteModalInfo;
    try {
      if (type === 'me') {
        await apiCall(`/expenses/${expenseId}/hide`, 'POST');
      } else {
        await apiCall(`/expenses/${expenseId}`, 'DELETE');
      }
      setDeleteModalInfo({ show: false, expenseId: null });
      fetchGroupData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMarkWrong = async (expenseId, isWrong) => {
    try {
      await apiCall(`/expenses/${expenseId}/mark-wrong`, 'POST', { isWrong });
      setActiveEntryMenuId(null);
      fetchGroupData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStartPoll = async () => {
    if (!window.confirm('Start a new poll to elect a group admin? Any existing active poll will be replaced.')) return;
    try {
      await apiCall(`/groups/${id}/poll`, 'POST');
      fetchGroupData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleVote = async (candidateId) => {
    setIsVoting(true);
    try {
      const data = await apiCall(`/groups/${id}/vote`, 'POST', { pollId: activePoll.id, candidateId });
      if (data.promoted) {
        alert("Success! Majority reached. New admin has been elected.");
      }
      fetchGroupData();
    } catch (err) {
      alert(err.message);
    } finally {
      setIsVoting(false);
    }
  };


  const getUniquePayers = () => {
    const payerMap = {};
    expenses.forEach(exp => {
      if (!payerMap[exp.paid_by]) payerMap[exp.paid_by] = exp.paid_by_name;
    });
    return Object.entries(payerMap);
  };

  const handleSettle = async (e) => {
    e.preventDefault();
    if (!settleAmount || settleAmount <= 0) return;
    try {
      await apiCall(`/expenses/${id}/settle`, 'POST', { toUserId: settleWithUser.id, amount: settleAmount });
      
      // Fetch new data to update balances for "amount left" display
      await fetchGroupData();
      
      setSettleSuccess(true);
      setSettleAmount('');
    } catch (err) {
      alert(err.message);
    }
  };

  const closeSettleModal = () => {
    setShowSettleModal(false);
    setSettleWithUser(null);
    setSettleAmount('');
    setSettleSuccess(false);
  };

  const getUserName = (userId) => {
    const u = members.find(m => m.id == userId);
    return u ? u.username : 'Unknown';
  };

  const getNetBalanceWithUser = (targetUserId) => {
    let net = 0;
    for (const d of settlementsDetails) {
      if (d.payer_id == currentUser.id && d.debtor_id == targetUserId) {
        net += d.amount;
      }
      if (d.debtor_id == currentUser.id && d.payer_id == targetUserId) {
        net -= d.amount;
      }
    }
    return net;
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-ghost" onClick={() => navigate('/dashboard')} style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-gradient" style={{ margin: 0 }}>{group ? group.name : 'Group Details'}</h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {/* Informational Debt Buttons */}
          <div style={{ display: 'flex', gap: '0.6rem', position: 'relative' }} ref={oweListRef}>
            <button
               className="btn-ghost"
               onClick={() => setActiveOweList(activeOweList === 'owed' ? null : 'owed')}
               style={{
                 padding: '0.45rem 1rem', borderRadius: '12px',
                 background: activeOweList === 'owed' ? 'var(--success)' : 'rgba(16, 185, 129, 0.1)',
                 border: `1px solid ${activeOweList === 'owed' ? 'var(--success)' : 'var(--success)'}`,
                 display: 'flex', alignItems: 'center', gap: '0.5rem',
                 fontSize: '0.8rem', fontWeight: 'bold',
                 color: activeOweList === 'owed' ? '#fff' : 'var(--success)',
                 transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                 transform: activeOweList === 'owed' ? 'scale(1.02)' : 'scale(1)',
                 boxShadow: activeOweList === 'owed' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none'
               }}
            >
              <TrendingUp size={14} /> You will receive: ₹{userGroupSummary.youAreOwed.toFixed(0)}
            </button>
            <button
               className="btn-ghost"
               onClick={() => setActiveOweList(activeOweList === 'owing' ? null : 'owing')}
               style={{
                 padding: '0.45rem 1rem', borderRadius: '12px',
                 background: activeOweList === 'owing' ? 'var(--danger)' : 'rgba(239, 68, 68, 0.1)',
                 border: `1px solid ${activeOweList === 'owing' ? 'var(--danger)' : 'var(--danger)'}`,
                 display: 'flex', alignItems: 'center', gap: '0.5rem',
                 fontSize: '0.8rem', fontWeight: 'bold',
                 color: activeOweList === 'owing' ? '#fff' : 'var(--danger)',
                 transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                 transform: activeOweList === 'owing' ? 'scale(1.02)' : 'scale(1)',
                 boxShadow: activeOweList === 'owing' ? '0 4px 12px rgba(239, 68, 68, 0.3)' : 'none'
               }}
            >
              <TrendingDown size={14} /> You need to pay: ₹{userGroupSummary.youOwe.toFixed(0)}
            </button>

            {/* Dropdown List */}
            {activeOweList && (() => {
              // Compute net balance per person relative to current user, including details
              const netPerPerson = {};
              for (const d of settlementsDetails) {
                if (d.payer_id == currentUser.id && d.debtor_id != currentUser.id) {
                  // Current user paid — debtor owes current user
                  if (!netPerPerson[d.debtor_id]) netPerPerson[d.debtor_id] = { username: d.debtor_name, net: 0, items: [] };
                  netPerPerson[d.debtor_id].net += d.amount;
                  netPerPerson[d.debtor_id].items.push({ description: d.description, amount: d.amount, type: 'receive' });
                }
                if (d.debtor_id == currentUser.id && d.payer_id != currentUser.id) {
                  // Current user owes the payer
                  if (!netPerPerson[d.payer_id]) netPerPerson[d.payer_id] = { username: d.payer_name, net: 0, items: [] };
                  netPerPerson[d.payer_id].net -= d.amount;
                  netPerPerson[d.payer_id].items.push({ description: d.description, amount: d.amount, type: 'pay' });
                }
              }
              // willReceive: others who net-owe the current user
              const willReceive = Object.entries(netPerPerson).filter(([, v]) => v.net > 0.005);
              // needToPay: others who the current user net-owes
              const needToPay = Object.entries(netPerPerson).filter(([, v]) => v.net < -0.005).map(([k, v]) => [k, { ...v, net: Math.abs(v.net) }]);
              const items = activeOweList === 'owed' ? willReceive : needToPay;
              const isOwed = activeOweList === 'owed';

              return (
                <div className="glass-card" style={{
                  position: 'absolute', top: '120%', right: 0, width: '320px',
                  padding: '1rem', zIndex: 101, boxShadow: '0 15px 35px rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-color)', animation: 'slideDown 0.3s ease-out'
                }}>
                  <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.85rem', opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {isOwed ? 'You will receive from' : 'You need to pay to'}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {items.length === 0
                      ? <p style={{ fontSize: '0.8rem', opacity: 0.5, margin: 0 }}>All settled up! 🎉</p>
                      : items.map(([userId, userBalance]) => (
                          <div 
                            key={userId} 
                            onClick={() => navigate(`/group/${id}/debt/${userId}`)}
                            style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '0.75rem 0.9rem', background: 'rgba(255,255,255,0.04)', borderRadius: '12px',
                              border: `1px solid ${isOwed ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'}`,
                              cursor: 'pointer', transition: 'all 0.2s', position: 'relative'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                                background: isOwed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                color: isOwed ? 'var(--success)' : 'var(--danger)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: '800', fontSize: '0.8rem'
                              }}>
                                {userBalance.username.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>{userBalance.username}</span>
                                <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>View Details ›</span>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: '800', color: isOwed ? 'var(--success)' : 'var(--danger)', fontSize: '0.95rem' }}>
                                ₹{userBalance.net.toFixed(0)}
                              </span>
                            </div>
                          </div>
                        ))
                    }
                  </div>
                </div>
              );
            })()}
          </div>

          <div style={{ position: 'relative' }} ref={optionsRef}>
            <button
              className="btn-ghost"
              onClick={() => setShowOptions(!showOptions)}
              style={{ padding: '0.4rem', border: 'none', background: 'transparent' }}
            >
              <MoreVertical size={20} />
            </button>

            {showOptions && (
              <div className="glass-card" style={{
                position: 'absolute', right: 0, top: '110%', width: '180px',
                padding: '0.5rem', zIndex: 100, boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.25rem'
              }}>
                <button
                  className="btn-ghost"
                  onClick={() => { setShowOptions(false); handleLeaveGroup(); }}
                  style={{ justifyContent: 'flex-start', border: 'none', width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}
                >
                  <LogOut size={16} /> Exit Group
                </button>

                {group?.created_by === currentUser?.id && (
                  <button
                    className="btn-ghost"
                    onClick={() => { setShowOptions(false); handleDeleteGroup(); }}
                    style={{
                      justifyContent: 'flex-start', border: 'none', width: '100%',
                      display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--danger)', fontSize: '0.9rem'
                    }}
                  >
                    <Trash2 size={16} /> Delete Group
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Spacer instead of large cards */}
      <div style={{ height: '0.5rem' }}></div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 350px', gap: '1.5rem' }} className="mobile-stack">
        {/* ── Left: Members Sidebar ── */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Users size={20} /> Members
            </h2>
            <button
              className="btn-ghost"
              style={{
                width: 28, height: 28, borderRadius: '50%', padding: 0,
                border: '2px solid var(--success)', background: 'transparent',
                color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
              onClick={() => setShowAddMember(!showAddMember)}
            >
              <Plus size={18} strokeWidth={3} />
            </button>
          </div>

          {showAddMember && (
            <div style={{ marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{
                  position: 'absolute', left: '0.75rem',
                  top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)', pointerEvents: 'none'
                }} />
                <input
                  type="text"
                  placeholder="Search by username or email..."
                  className="input-field"
                  style={{ paddingLeft: '2.2rem', marginBottom: 0 }}
                  value={memberSearchQuery}
                  onChange={handleMemberSearchChange}
                  autoFocus
                />
              </div>

              {(memberSearchResults.length > 0 || memberSearching) && (
                <div className="search-dropdown" style={{
                  position: 'absolute', width: 'calc(100% - 4rem)', zIndex: 100,
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)',
                  marginTop: '0.25rem', borderRadius: '12px'
                }}>
                  {memberSearching && (
                    <p style={{ padding: '0.75rem', margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      Searching...
                    </p>
                  )}
                  {memberSearchResults.map(u => (
                    <div
                      key={u.id}
                      onClick={() => {
                        handleAddMemberFromSearch(u);
                        setShowAddMember(false);
                      }}
                      className="search-item"
                      style={{ display: 'flex', flexDirection: 'column' }}
                    >
                      <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.username}</span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <ul style={{ padding: 0, margin: 0 }}>
            {members.map(m => (
              <li key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.5rem 0', borderBottom: '1px solid var(--border)'
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent-primary-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--accent-primary)'
                }}>
                  {m.username[0].toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.username}
                    {m.id === currentUser?.id && (
                      <span style={{ fontSize: '0.7rem', marginLeft: '0.4rem', color: 'var(--accent-secondary)' }}>(you)</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                  {group?.admin_id === m.id && (
                    <div style={{ 
                      display: 'inline-flex', alignItems: 'center', gap: '0.3rem', 
                      fontSize: '0.65rem', color: 'var(--accent-primary)', fontWeight: 'bold',
                      background: 'rgba(99, 102, 241, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px',
                      marginTop: '0.2rem'
                    }}>
                      <CheckCircle size={10} /> GROUP ADMIN
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Poll Section */}
          <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.9rem', margin: 0, opacity: 0.8, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Vote size={16} /> Admin Election
              </h3>
              {!activePoll && (
                <button 
                  className="btn-ghost" 
                  style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', border: '1px solid var(--border)' }}
                  onClick={handleStartPoll}
                >
                  Start Poll
                </button>
              )}
            </div>

            {activePoll ? (
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: '0.8rem', margin: '0 0 0.8rem 0', opacity: 0.7 }}>
                  Select a member to vote for admin. Majority {Math.floor(members.length / 2) + 1} votes required.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {members.map(m => {
                    const voteInfo = activePoll.votes.find(v => v.candidate_id === m.id);
                    const voteCount = voteInfo ? voteInfo.votes : 0;
                    const isMyVote = activePoll.myVote === m.id;
                    const percentage = (voteCount / members.length) * 100;

                    return (
                      <button
                        key={m.id}
                        disabled={isVoting}
                        onClick={() => handleVote(m.id)}
                        className="btn-ghost"
                        style={{
                          width: '100%', padding: '0.6rem 0.8rem', justifyContent: 'space-between',
                          border: `1px solid ${isMyVote ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)'}`,
                          background: isMyVote ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                          position: 'relative', overflow: 'hidden'
                        }}
                      >
                        {/* Progress bar background */}
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${percentage}%`,
                          background: 'rgba(99, 102, 241, 0.08)', zIndex: 0, transition: 'width 0.3s ease'
                        }}></div>
                        
                        <span style={{ fontSize: '0.85rem', fontWeight: isMyVote ? 'bold' : 'normal', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {m.username} {isMyVote && <CheckCircle size={12} />}
                        </span>
                        <span style={{ fontSize: '0.8rem', opacity: 0.6, zIndex: 1 }}>{voteCount} votes</span>
                      </button>
                    );
                  })}
                </div>
                <button 
                  className="btn-ghost" 
                  style={{ width: '100%', marginTop: '0.8rem', fontSize: '0.7rem', opacity: 0.5 }}
                  onClick={handleStartPoll}
                >
                  Restart Poll
                </button>
              </div>
            ) : (
              <p style={{ fontSize: '0.8rem', opacity: 0.5, fontStyle: 'italic' }}>
                {group?.admin_id ? 'You can start a new poll to change the admin.' : 'No active election. Start one to enable expenses.'}
              </p>
            )}
          </div>
        </div>

        {/* ── Center: Activity Feed ── */}
        <div className="glass-card" ref={activityActionsRef} style={{ display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Activity size={20} /> Group Activity
            </h2>
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)} 
              className="input-field" 
              style={{ width: 'auto', marginBottom: 0, padding: '0.4rem 0.8rem', fontSize: '0.9rem', cursor: 'pointer' }}
              title="Filter by Month"
            />
          </div>

          {(() => {
            const renderExpenseRow = (exp, index, total) => {
              const isSettlement = exp.description.toLowerCase().includes('settlement');
              const dt = new Date(exp.created_at);
              const dateStr = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
              const debtors = (exp.splits || []).filter(s => s.userId != exp.paid_by);
              const otherMembersCount = members.length - 1;
              let paidForLabel;
              if (isSettlement) paidForLabel = null;
              else if (debtors.length === 0) paidForLabel = 'for themselves';
              else if (debtors.length >= otherMembersCount) paidForLabel = 'for the group';
              else if (debtors.length === 1) paidForLabel = `for ${debtors[0].username}`;
              else { const ns = debtors.map(d => d.username); const last = ns.pop(); paidForLabel = `for ${ns.join(', ')} & ${last}`; }

              const isExpanded = expandedExpenseId === exp.id;
              const accentColor = isSettlement ? 'var(--success)' : 'var(--accent-primary)';
              const accentBg = isSettlement ? 'rgba(16,185,129,0.1)' : 'rgba(99,102,241,0.1)';

              return (
                <div key={exp.id} style={{
                  position: 'relative',
                  borderRadius: '14px',
                  border: `1px solid ${isExpanded ? (isSettlement ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.25)') : 'rgba(255,255,255,0.05)'}`,
                  background: isExpanded ? accentBg : 'transparent',
                  transition: 'all 0.25s', overflow: 'visible',
                  zIndex: activeEntryMenuId === exp.id ? 9999 : 1,
                  marginBottom: '0.5rem'
                }}>

                  {/* ── Compact Row (always visible, clickable) ── */}
                  <div
                    onClick={() => setExpandedExpenseId(isExpanded ? null : exp.id)}
                    style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 0.9rem', cursor: 'pointer' }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '9px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: accentBg, color: accentColor, fontSize: '0.9rem', fontWeight: '800'
                    }}>
                      {isSettlement ? '✓' : '₹'}
                    </div>

                    {/* Main info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {exp.description}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                        <span style={{ color: accentColor, fontWeight: '600' }}>{exp.paid_by_name}</span>
                        {paidForLabel ? ` · ${paidForLabel}` : ''}
                        <span style={{ opacity: 0.5, marginLeft: '0.4rem' }}>· {dateStr}</span>
                        {exp.is_wrong && (
                          <span style={{ 
                            marginLeft: '0.6rem', color: 'var(--danger)', fontWeight: 'bold', fontSize: '0.65rem',
                            padding: '0.1rem 0.4rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px',
                            display: 'inline-flex', alignItems: 'center', gap: '0.2rem'
                          }}>
                            <AlertTriangle size={10} /> WRONG ENTRY
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <span style={{ fontWeight: '800', fontSize: '0.88rem', color: accentColor }}>
                        ₹{parseFloat(exp.amount).toFixed(0)}
                      </span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.4, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                    </div>

                    {(exp.paid_by == currentUser.id || group?.admin_id == currentUser.id) && (
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          className="btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveEntryMenuId(activeEntryMenuId === exp.id ? null : exp.id);
                            setActivityMenuOpen(false);
                          }}
                          style={{ padding: '0.3rem', border: 'none', background: 'transparent' }}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {activeEntryMenuId === exp.id && (
                          <div style={{
                            position: 'absolute', right: 0, top: '110%', 
                            width: '235px',
                            padding: '0.75rem', zIndex: 99999, boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                            border: '1px solid var(--border-color)', borderRadius: '14px', background: 'rgba(255,255,255,0.94)', color: 'var(--text-primary)'
                          }}>
                            {exp.paid_by == currentUser.id && (
                              <button
                                className="btn-ghost"
                                onClick={(e) => { e.stopPropagation(); handleDeleteExpense(exp.id); }}
                                style={{ justifyContent: 'flex-start', width: '100%', padding: '0.65rem 0.75rem', border: 'none', fontSize: '0.85rem', color: 'var(--danger)' }}
                              >
                                <Trash2 size={14} style={{ marginRight: '0.6rem' }} /> Delete entry
                              </button>
                            )}
                            {(exp.paid_by == currentUser.id || group?.admin_id == currentUser.id) && !exp.is_wrong && (
                              <button
                                className="btn-ghost"
                                onClick={(e) => { e.stopPropagation(); navigate(`/group/${id}/edit-expense/${exp.id}`); }}
                                style={{ justifyContent: 'flex-start', width: '100%', padding: '0.65rem 0.75rem', border: 'none', fontSize: '0.85rem' }}
                              >
                                <Edit3 size={14} style={{ marginRight: '0.6rem', opacity: 0.6 }} /> Edit entry
                              </button>
                            )}
                            
                            {group?.admin_id == currentUser.id && (
                              <button
                                className="btn-ghost"
                                onClick={(e) => { e.stopPropagation(); handleMarkWrong(exp.id, !exp.is_wrong); }}
                                style={{ 
                                  justifyContent: 'flex-start', width: '100%', padding: '0.65rem 0.75rem', 
                                  border: 'none', fontSize: '0.85rem', color: exp.is_wrong ? 'var(--success)' : 'var(--danger)',
                                  borderTop: '1px solid rgba(0,0,0,0.06)'
                                }}
                              >
                                <AlertTriangle size={14} style={{ marginRight: '0.6rem' }} /> 
                                {exp.is_wrong ? 'Mark as Correct' : 'Mark as Wrong'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Expanded Detail Panel ── */}
                  {isExpanded && (
                    <div style={{ padding: '0 0.9rem 1rem', borderTop: `1px solid ${isSettlement ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)'}` }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.85rem', marginBottom: '0.85rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '0.6rem 0.8rem' }}>
                          <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.2rem' }}>DATE & TIME</div>
                          <div style={{ fontSize: '0.82rem', fontWeight: '600' }}>{dateStr}</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{timeStr}</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '0.6rem 0.8rem' }}>
                          <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.2rem' }}>PAID BY</div>
                          <div style={{ fontSize: '0.82rem', fontWeight: '700', color: accentColor }}>{exp.paid_by_name}</div>
                          <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>₹{parseFloat(exp.amount).toFixed(2)} total</div>
                        </div>
                      </div>

                      {debtors.length > 0 && (
                        <div>
                          <div style={{ fontSize: '0.65rem', opacity: 0.5, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Breakdown</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {debtors.map((s, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '9px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: accentBg, color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: '800' }}>
                                    {s.username.charAt(0).toUpperCase()}
                                  </div>
                                  <span style={{ fontSize: '0.82rem', fontWeight: '600' }}>{s.username}</span>
                                </div>
                                <span style={{ fontWeight: '700', fontSize: '0.82rem', color: accentColor }}>owes ₹{s.amount.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            };

            const filteredExpenses = expenses.filter(e => {
                const dt = new Date(e.created_at);
                const monthStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
                return monthStr === selectedMonth;
            });

            const myExpenses = filteredExpenses.filter(e => e.paid_by == currentUser.id);
            const othersExpenses = filteredExpenses.filter(e => e.paid_by != currentUser.id);

            return (
              <>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '0.25rem', marginBottom: '1.5rem', width: 'fit-content' }}>
                  <button
                    onClick={() => setActiveActivityTab('mine')}
                    style={{
                      padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700', border: 'none',
                      background: activeActivityTab === 'mine' ? 'var(--accent-primary)' : 'transparent',
                      color: activeActivityTab === 'mine' ? '#fff' : 'var(--text-secondary)',
                      transition: 'all 0.3s ease', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                    }}
                  >
                    <Clock size={14} /> My Activity
                  </button>
                  {!group?.is_personal && (
                    <button
                      onClick={() => setActiveActivityTab('others')}
                      style={{
                        padding: '0.5rem 1.25rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '700', border: 'none',
                        background: activeActivityTab === 'others' ? 'var(--accent-primary)' : 'transparent',
                        color: activeActivityTab === 'others' ? '#fff' : 'var(--text-secondary)',
                        transition: 'all 0.3s ease', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem'
                      }}
                    >
                      <Users size={14} /> Others
                    </button>
                  )}
                </div>

                <div style={{ 
                  display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '650px', 
                  overflowY: 'auto', paddingRight: '0.5rem', paddingBottom: '160px' 
                }}>
                  {activeActivityTab === 'mine' ? (
                    myExpenses.length === 0 ? (
                      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0', fontSize: '0.85rem', fontStyle: 'italic' }}>No expenses added by you in this month.</p>
                    ) : (
                      myExpenses.map((exp, i) => renderExpenseRow(exp, i, myExpenses.length))
                    )
                  ) : (
                    othersExpenses.length === 0 ? (
                      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0', fontSize: '0.85rem', fontStyle: 'italic' }}>No activity from other members in this month.</p>
                    ) : (
                      othersExpenses.map((exp, i) => renderExpenseRow(exp, i, othersExpenses.length))
                    )
                  )}
                </div>
              </>
            );
          })()}
        </div>

        {/* ── Right: Financial Tools ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Add Expense Trigger */}
          <div className="glass-card" style={{
            padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
            border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '1rem'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Manage Finances</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.6 }}>Record a new bill or individual debt for the group.</p>
            {!group?.admin_id && !group?.is_personal ? (
              <div style={{ 
                padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', 
                borderRadius: '8px', fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem'
              }}>
                <AlertTriangle size={14} /> Admin required to add expenses.
              </div>
            ) : (
              <>
                <button
                  className="btn-primary"
                  style={{ width: '100%', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 'bold' }}
                  onClick={() => navigate(`/group/${id}/add-expense`)}
                >
                  <Plus size={18} /> Add New Expense
                </button>
                <button
                  className="btn-ghost"
                  style={{ 
                    width: '100%', padding: '0.85rem', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', gap: '0.5rem', fontWeight: 'bold', marginTop: '0.5rem',
                    border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)'
                  }}
                  onClick={() => {
                    setSettleWithUser(null);
                    setSettleAmount('');
                    setSettleSuccess(false);
                    setShowSettleModal(true);
                  }}
                >
                  <Wallet size={18} /> Settlement
                </button>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Settlement Modal */}
      {showSettleModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-card" style={{ width: 420, maxWidth: '90%', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{settleSuccess ? 'Success!' : 'Settle Debt'}</h2>
              <button className="btn-ghost" style={{ padding: '0.25rem', border: 'none' }} onClick={closeSettleModal}>
                <X size={20} />
              </button>
            </div>

            {settleSuccess ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  width: 60, height: 60, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', 
                  color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 1.5rem'
                }}>
                  <CheckCircle size={32} />
                </div>
                <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--success)' }}>Payment Recorded</h3>
                <p style={{ margin: '0 0 2rem 0', fontSize: '0.9rem', opacity: 0.7 }}>
                  Now you have ₹{Math.abs(getNetBalanceWithUser(settleWithUser.id)).toFixed(2)} {getNetBalanceWithUser(settleWithUser.id) > 0 ? 'left to pay' : 'left to receive'} from {settleWithUser.username}.
                </p>
                <button className="btn-primary" style={{ width: '100%' }} onClick={closeSettleModal}>
                  Great, Thanks!
                </button>
              </div>
            ) : (
              <form onSubmit={handleSettle}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    Select Group Member:
                  </label>
                  <select
                    className="input-field"
                    value={settleWithUser?.id || ''}
                    onChange={(e) => {
                      const member = members.find(m => m.id == e.target.value);
                      setSettleWithUser(member);
                      const bal = getNetBalanceWithUser(e.target.value);
                      setSettleAmount(Math.abs(bal).toFixed(2));
                    }}
                    required
                  >
                    <option value="">Choose someone...</option>
                    {members.filter(m => m.id != currentUser?.id).map(m => (
                      <option key={m.id} value={m.id}>{m.username}</option>
                    ))}
                  </select>
                </div>

                {settleWithUser && (() => {
                  const bal = getNetBalanceWithUser(settleWithUser.id);
                  // Restrict to only when "I owe them" (bal < 0). 
                  // If bal > 0 (they owe me) or bal == 0, show settled message as requested.
                  if (bal >= -0.01) {
                    return (
                      <div style={{ 
                        padding: '1.25rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', 
                        borderRadius: '12px', marginBottom: '1.5rem', border: '1px dotted var(--success)'
                      }}>
                        <CheckCircle size={24} style={{ color: 'var(--success)', marginBottom: '0.4rem' }} />
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--success)' }}>All Settled Up!</div>
                        <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', opacity: 0.6 }}>No pending payments to {settleWithUser.username}.</p>
                      </div>
                    );
                  }
                  return (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <div style={{ 
                        padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', 
                        border: '1px solid var(--border-color)', marginBottom: '1.25rem'
                      }}>
                        <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '0.25rem' }}>Current Status:</div>
                        <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--danger)' }}>
                          {`You have to pay ₹${Math.abs(bal).toFixed(2)}`}
                        </div>
                      </div>

                      <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                        How much do you want to pay?
                      </label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>₹</span>
                        <input
                          type="number" step="0.01" className="input-field"
                          style={{ paddingLeft: '1.75rem', marginBottom: 0 }}
                          value={settleAmount} onChange={e => setSettleAmount(e.target.value)}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>
                  );
                })()}

                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ width: '100%', padding: '0.85rem' }}
                  disabled={!settleWithUser || getNetBalanceWithUser(settleWithUser.id) >= -0.01}
                >
                  Confirm Payment
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Delete Choice Modal */}
      {deleteModalInfo.show && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="glass-card" style={{ width: 450, maxWidth: '90%', padding: '2rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ 
                width: 60, height: 60, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', 
                color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <Trash2 size={30} />
              </div>
              <h2 style={{ margin: '0 0 0.5rem 0' }}>Delete Expense</h2>
              <p style={{ margin: 0, opacity: 0.6, fontSize: '0.9rem' }}>How would you like to handle this deletion?</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button 
                className="btn-ghost" 
                style={{ 
                  flexDirection: 'column', alignItems: 'flex-start', padding: '1rem', 
                  border: '1px solid var(--border-color)', height: 'auto', textAlign: 'left'
                }}
                onClick={() => executeDelete('me')}
              >
                <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.2rem' }}>Delete from Me</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Hide this entry from your activity feed. Debt balances will NOT be affected for others.</div>
              </button>

              <button 
                className="btn-ghost" 
                style={{ 
                  flexDirection: 'column', alignItems: 'flex-start', padding: '1rem', 
                  border: '1px solid rgba(239, 68, 68, 0.2)', height: 'auto', textAlign: 'left',
                  background: 'rgba(239, 68, 68, 0.03)'
                }}
                onClick={() => executeDelete('everyone')}
              >
                <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.2rem', color: 'var(--danger)' }}>Delete from Everyone</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Permanently remove this entry for all members. Associated debt balances will be reversed.</div>
              </button>
            </div>

            <button 
              className="btn-ghost" 
              style={{ width: '100%', marginTop: '1.5rem', border: 'none', color: 'var(--text-secondary)' }}
              onClick={() => setDeleteModalInfo({ show: false, expenseId: null })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupView;
