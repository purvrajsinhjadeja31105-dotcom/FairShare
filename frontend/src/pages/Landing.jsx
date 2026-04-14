import React from 'react';
import { Link } from 'react-router-dom';
import { PieChart, Users, Receipt, ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

const Landing = () => {
    return (
        <div style={{ paddingBottom: '4rem', animation: 'fadeIn 0.5s ease-out' }}>
            {/* Hero Section */}
            <div className="flex-center" style={{ textAlign: 'center', padding: '4rem 1rem', minHeight: '70vh' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '999px', marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                    <Zap size={16} className="text-gradient" />
                    <span>The ultimate way to manage shared expenses</span>
                </div>
                <h1 style={{ fontSize: 'clamp(3rem, 6vw, 5rem)', marginBottom: '1.5rem', lineHeight: '1.1', fontWeight: '800' }}>
                    Less stress when <br/>
                    <span className="text-gradient">sharing expenses.</span>
                </h1>
                <p style={{ fontSize: '1.2rem', marginBottom: '2.5rem', maxWidth: '600px', color: 'var(--text-secondary)' }}>
                    Keep track of your shared expenses and balances with housemates, trips, groups, friends, and family. We do the math, so you don't have to.
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Link to="/register" style={{ textDecoration: 'none' }}>
                        <button className="btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '0.5rem' }}>
                            Get Started Now <ArrowRight size={20} />
                        </button>
                    </Link>
                    <Link to="/login" style={{ textDecoration: 'none' }}>
                        <button className="btn-ghost" style={{ padding: '1rem 2rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            Log In
                        </button>
                    </Link>
                </div>
            </div>

            {/* Why Use It Section (Features) */}
            <div style={{ marginTop: '4rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Why choose SplitWise?</h2>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto' }}>Designed for simplicity and power, making it incredibly easy to track any shared cost.</p>
                </div>
                <div className="grid-2 mobile-stack" style={{ gap: '2rem', maxWidth: '1000px', margin: '0 auto', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', display: 'grid' }}>
                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2.5rem 2rem' }}>
                        <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>
                            <Receipt size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Track Every Expense</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Add expenses on the go before you forget who paid. Keep all your receipts in one organized place.</p>
                    </div>
                    
                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2.5rem 2rem' }}>
                        <div style={{ background: 'rgba(52, 211, 153, 0.1)', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem', color: 'var(--success)' }}>
                            <PieChart size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Smart Calculations</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>We automatically tally who owes who, minimizing the number of transactions needed to settle up.</p>
                    </div>

                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2.5rem 2rem' }}>
                        <div style={{ background: 'rgba(167, 139, 250, 0.1)', padding: '1rem', borderRadius: '16px', marginBottom: '1.5rem', color: 'var(--accent-secondary)' }}>
                            <Users size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Group Organization</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Create groups for apartments, trips, or events to keep related expenses neatly categorized together.</p>
                    </div>
                </div>
            </div>

            {/* How to use it Section */}
            <div style={{ marginTop: '8rem', padding: '4rem 2rem', background: 'var(--bg-secondary)', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'var(--bg-gradient)', opacity: 0.5, pointerEvents: 'none' }}></div>
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '2.5rem', marginBottom: '3rem', textAlign: 'center' }}>How it works</h2>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', width: '100%' }}>
                        {[
                            { step: '1', title: 'Create a group', desc: 'Start by making a group for your trip, house, or night out. Add your friends by their email.' },
                            { step: '2', title: 'Add your expenses', desc: 'Whenever someone pays for something, quickly add it to the app. You can split it equally or exactly.' },
                            { step: '3', title: 'Let us do the math', desc: 'We keep a running total of everyone\'s balances over time, so you always know where you stand.' },
                            { step: '4', title: 'Settle up easily', desc: 'When you are ready to pay someone back, use the settle up feature to clear your debts instantly.' }
                        ].map((item) => (
                            <div key={item.step} style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', background: 'var(--card-bg)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                                <div style={{ minWidth: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem', fontWeight: 'bold', flexShrink: 0 }}>
                                    {item.step}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>{item.title}</h3>
                                    <p style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom CTA */}
            <div style={{ marginTop: '8rem', textAlign: 'center', paddingBottom: '2rem' }}>
                <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Ready to stop arguing over money?</h2>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <Link to="/register" style={{ textDecoration: 'none' }}><button className="btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1.2rem' }}>Join Now for Free</button></Link>
                </div>
                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '2rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShieldCheck size={18}/> Secure Data</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckCircle2 size={18}/> Free to use</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Zap size={18}/> Lightning fast</span>
                </div>
            </div>
            
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default Landing;
