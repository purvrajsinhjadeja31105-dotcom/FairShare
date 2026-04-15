import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, TrendingUp, TrendingDown, Receipt, CheckCircle, Calendar } from 'lucide-react';
import { apiCall } from '../api';

const DebtDetail = () => {
  const { groupId, userId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [targetUser, setTargetUser] = useState(null);
  const [group, setGroup] = useState(null);
  const [details, setDetails] = useState([]);
  const [netBalance, setNetBalance] = useState(0);

  const currentUser = JSON.parse(localStorage.getItem('fairshare_user'));

  useEffect(() => {
    fetchData();
  }, [groupId, userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const grpData = await apiCall(`/groups/${groupId}`);
      setGroup(grpData.group);

      const memData = await apiCall(`/groups/${groupId}/members`);
      const user = memData.members.find(m => m.id == userId);
      setTargetUser(user);

      const balData = await apiCall(`/expenses/${groupId}/settlements`);
      const allDetails = balData.details || [];
      
      // Filter details for transactions between current user and target user
      const filtered = allDetails.filter(d => 
        (d.payer_id == currentUser.id && d.debtor_id == userId) || 
        (d.debtor_id == currentUser.id && d.payer_id == userId)
      ).sort((a,b) => new Date(b.date) - new Date(a.date));

      setDetails(filtered);

      // Re-calculate net balance for validation
      let net = 0;
      filtered.forEach(d => {
        if (d.payer_id == currentUser.id) net += d.amount;
        else net -= d.amount;
      });
      setNetBalance(net);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
      <div className="loader"></div>
    </div>
  );

  const isOwed = netBalance > 0;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '1rem' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn-ghost" onClick={() => navigate(`/group/${groupId}`)} style={{ padding: '0.5rem' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-gradient" style={{ margin: 0, fontSize: '1.5rem' }}>Relationship History</h1>
          <p style={{ margin: 0, opacity: 0.6, fontSize: '0.9rem' }}>{group?.name}</p>
        </div>
      </div>

      {/* ── Settlement Action Banner ── */}
      <div className="glass-card mobile-stack" style={{ 
        padding: '1.25rem 1.5rem', marginBottom: '2.5rem',
        background: `linear-gradient(90deg, ${isOwed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'} 0%, transparent 100%)`,
        borderLeft: `5px solid ${isOwed ? 'var(--success)' : 'var(--danger)'}`,
        borderRadius: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1.5rem', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)'
      }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              {/* Relationship Visual */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-color)', zIndex: 2 }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: '800' }}>{currentUser.username[0].toUpperCase()}</span>
                  </div>
                  <div style={{ width: 25, height: 2, background: 'var(--border-color)', margin: '0 -4px', zIndex: 1, opacity: 0.5 }}></div>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-color)', zIndex: 2 }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: '800' }}>{targetUser?.username?.[0]?.toUpperCase()}</span>
                  </div>
                  <div style={{ 
                      position: 'absolute', top: -14, 
                      left: isOwed ? 'auto' : '10px', 
                      right: isOwed ? '10px' : 'auto',
                      color: isOwed ? 'var(--success)' : 'var(--danger)',
                      background: 'var(--bg-primary)', borderRadius: '50%', padding: '2px'
                  }}>
                      {isOwed ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  </div>
              </div>
              
              <div>
                  <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.2rem 0', fontWeight: '800', opacity: 0.9 }}>
                      Settlement Action
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {isOwed ? (
                          <>To balance up, <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{targetUser?.username}</span> needs to pay you</>
                      ) : (
                          <>To balance up, <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>You</span> need to pay {targetUser?.username}</>
                      )}
                  </p>
              </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ 
                  fontSize: '1.8rem', fontWeight: '900', 
                  color: isOwed ? 'var(--success)' : 'var(--danger)',
                  lineHeight: 1
              }}>
                ₹{Math.abs(netBalance).toFixed(0)}
              </div>
              <div style={{ fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '0.3rem', fontWeight: '700' }}>
                  Current Debt
              </div>
          </div>
      </div>

      {/* ── Transaction List ── */}
      <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '1.1rem' }}>
        <Receipt size={18} style={{ opacity: 0.6 }} /> Transaction Breakdown
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {details.length === 0 ? (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', opacity: 0.6 }}>
            <CheckCircle size={40} style={{ margin: '0 auto 1rem', display: 'block' }} />
            <p>No transactions found between you two.</p>
          </div>
        ) : details.map((d, i) => {
          const amIPayer = d.payer_id == currentUser.id;
          const isSettlement = d.description?.toLowerCase().includes('settlement');
          
          return (
            <div key={i} className="glass-card" style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
              padding: '1rem 1.25rem', border: '1px solid var(--border-color)',
              background: amIPayer ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.01)'
            }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ 
                  width: 40, height: 40, borderRadius: '12px', 
                  background: amIPayer ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: amIPayer ? 'var(--success)' : 'var(--danger)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {isSettlement ? <CheckCircle size={20} /> : <Receipt size={20} />}
                </div>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '0.95rem', marginBottom: '0.15rem' }}>{d.description}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', opacity: 0.5 }}>
                    <Calendar size={12} /> {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  fontWeight: '800', fontSize: '1rem', 
                  color: amIPayer ? 'var(--success)' : 'var(--danger)'
                }}>
                  {amIPayer ? '+' : '-'} ₹{d.amount.toFixed(0)}
                </div>
                <div style={{ fontSize: '0.7rem', opacity: 0.4 }}>
                  {amIPayer ? 'You paid' : `${targetUser?.username} paid`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ height: '4rem' }}></div>
    </div>
  );
};

export default DebtDetail;
