import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../api';
import { X, Search, UserPlus, ArrowLeft, Users, Check } from 'lucide-react';

const CreateGroup = () => {
    const navigate = useNavigate();
    const [newGroupName, setNewGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    
    const user = JSON.parse(localStorage.getItem('splitwise_user'));

    useEffect(() => {
        if (searchTerm.trim().length > 1) {
            const fetchUsers = async () => {
                try {
                    const data = await apiCall(`/users/search?q=${searchTerm}`);
                    setSearchResults(data.users.filter(u => 
                        u.id !== user?.id && !selectedMembers.find(m => m.id === u.id)
                    ));
                } catch (err) {
                    console.error(err);
                }
            };
            const timer = setTimeout(fetchUsers, 300);
            return () => clearTimeout(timer);
        } else {
            setSearchResults([]);
        }
    }, [searchTerm, selectedMembers, user?.id]);

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        
        if (selectedMembers.length === 0) {
            return alert('A group must have at least one member added.');
        }

        try {
            await apiCall('/groups', 'POST', { 
                name: newGroupName,
                members: selectedMembers.map(m => m.id)
            });
            navigate('/dashboard');
        } catch (err) {
            alert(err.message);
        }
    };

    const addMember = (u) => {
        setSelectedMembers([...selectedMembers, u]);
        setSearchTerm('');
        setSearchResults([]);
    };

    const removeMember = (userId) => {
        setSelectedMembers(selectedMembers.filter(m => m.id !== userId));
    };

    return (
        <div style={{ maxWidth: 650, margin: '0 auto', padding: '1rem' }}>
            <button 
                className="btn-ghost" 
                onClick={() => navigate(-1)} 
                style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 1rem', borderRadius: '12px' }}
            >
                <ArrowLeft size={20} /> <span style={{ fontWeight: '500' }}>Back to Dashboard</span>
            </button>

            <div className="glass-card" style={{ padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{ 
                        width: 60, height: 60, borderRadius: '18px', background: 'var(--accent-primary)', 
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                        marginBottom: '1rem', boxShadow: '0 8px 16px rgba(99, 102, 241, 0.2)'
                    }}>
                        <Users size={32} />
                    </div>
                    <h1 className="text-gradient" style={{ margin: 0, fontSize: '1.75rem' }}>Create New Group</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Start a shared space to track split expenses</p>
                </div>

                <form onSubmit={handleCreateGroup}>
                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                            Group Name
                        </label>
                        <input 
                            type="text" placeholder="e.g. Summer Trip 2024" 
                            className="input-field" value={newGroupName} 
                            style={{ 
                                padding: '1rem 1.25rem', fontSize: '1rem', borderRadius: '14px', 
                                border: '2px solid var(--border-color)', marginBottom: 0 
                            }}
                            onChange={e => setNewGroupName(e.target.value)} required 
                        />
                    </div>
                    
                    <div style={{ position: 'relative', marginBottom: '2.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                            Add Your Friends
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Search size={20} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-secondary)' }} />
                            <input 
                                type="text" placeholder="Search by name or email..." 
                                className="input-field" value={searchTerm} 
                                style={{ 
                                    paddingLeft: '3rem', paddingRight: '1rem', paddingTop: '0.85rem', paddingBottom: '0.85rem',
                                    borderRadius: '14px', border: '2px solid var(--border-color)', marginBottom: 0 
                                }}
                                onChange={e => setSearchTerm(e.target.value)} 
                            />
                        </div>
                        
                        {searchResults.length > 0 && (
                            <div className="glass-card" style={{ 
                                position: 'absolute', width: '100%', zIndex: 100,
                                padding: '0.5rem', marginTop: '0.5rem', boxShadow: '0 15px 35px rgba(0, 0, 0, 0.25)',
                                border: '1px solid var(--border-color)', borderRadius: '14px'
                            }}>
                                {searchResults.map(u => (
                                    <div key={u.id} className="search-item" onClick={() => addMember(u)} style={{ 
                                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', 
                                        borderRadius: '10px', cursor: 'pointer' 
                                    }}>
                                        <div style={{ 
                                            width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-secondary)', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)'
                                        }}>
                                            {u.username.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{u.username}</div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{u.email}</div>
                                        </div>
                                        <Check size={16} style={{ color: 'var(--success)', opacity: 0.5 }} />
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.25rem' }}>
                            {selectedMembers.map(m => (
                                <div key={m.id} style={{ 
                                    background: 'var(--bg-secondary)', 
                                    color: 'var(--text-primary)', padding: '6px 14px', borderRadius: '12px', fontSize: '0.85rem',
                                    display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontWeight: '500'
                                }}>
                                    {m.username}
                                    <button 
                                        onClick={(e) => { e.preventDefault(); removeMember(m.id); }}
                                        style={{ 
                                            background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', 
                                            border: 'none', borderRadius: '6px', padding: '2px', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            {selectedMembers.length === 0 && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                    * Select friends to split bills with
                                </div>
                            )}
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="btn-primary" 
                        style={{ 
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', 
                            padding: '1.15rem', borderRadius: '16px', fontSize: '1rem', fontWeight: '700',
                            boxShadow: '0 8px 20px rgba(99, 102, 241, 0.3)', marginTop: '1rem'
                        }}
                    >
                        <UserPlus size={20} /> Create Group
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateGroup;
