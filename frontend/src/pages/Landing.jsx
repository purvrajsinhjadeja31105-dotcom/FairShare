import { Link, Navigate } from 'react-router-dom';
import { Receipt, Scale, Smartphone } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const STEPS = [
    { icon: <Receipt size={22} />, title: 'Add a bill in seconds', text: 'Anyone in the group adds what they paid. Split equally, by amounts or by percent.' },
    { icon: <Scale size={22} />, title: 'See who owes whom', text: 'Balances update live for everyone, simplified to the fewest payments.' },
    { icon: <Smartphone size={22} />, title: 'Settle with one UPI tap', text: 'Pay with Google Pay, PhonePe or Paytm. The receiver confirms, so balances stay trusted.' }
];

export default function Landing() {
    const { isSignedIn } = useAuth();
    if (isSignedIn) return <Navigate to="/home" replace />;

    return (
        <main className="page">
            <section className="landing-hero">
                <h1>Split bills with friends in seconds.</h1>
                <p className="muted" style={{ maxWidth: '40ch' }}>
                    For trips, flatmates and nights out. Add expenses, see who owes whom, and settle up with one UPI scan. Free, no limits.
                </p>
                <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link className="btn btn-primary" to="/register">Get started, it&apos;s free</Link>
                    <Link className="btn btn-secondary" to="/login">Log in</Link>
                </div>
            </section>

            <section className="landing-steps">
                {STEPS.map(step => (
                    <div key={step.title} className="card card-pad stack" style={{ gap: '0.5rem' }}>
                        <span className="empty-icon" style={{ width: 42, height: 42, borderRadius: 12 }}>{step.icon}</span>
                        <h2>{step.title}</h2>
                        <p className="muted small">{step.text}</p>
                    </div>
                ))}
            </section>
        </main>
    );
}
