// Small presentational building blocks shared by every screen.
import { useEffect, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { formatMoney } from '../utils/format';

const AVATAR_COLORS = ['#0f766e', '#7c3aed', '#c2410c', '#2563eb', '#be185d', '#4d7c0f', '#b45309', '#0e7490'];

const colorFor = (seed = '') => {
    let hash = 0;
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

export const Avatar = ({ name = '?', id, size, group = false }) => (
    <span
        className={`avatar${size === 'sm' ? ' avatar-sm' : ''}${group ? ' avatar-group' : ''}`}
        style={{ background: colorFor(id || name) }}
        aria-hidden="true"
    >
        {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
);

/** Signed amount shown in plain words: positive = owed to you, negative = you owe. */
export const BalanceText = ({ amount, owedLabel = 'owes you', oweLabel = 'you owe', settledLabel = 'settled up' }) => {
    const paise = Math.round((Number(amount) || 0) * 100);
    if (paise === 0) return <span className="neutral small">{settledLabel}</span>;
    const positive = paise > 0;
    return (
        <span className={positive ? 'positive' : 'negative'}>
            <span className="tiny" style={{ display: 'block', fontWeight: 600 }}>{positive ? owedLabel : oweLabel}</span>
            <strong className="num">{formatMoney(amount)}</strong>
        </span>
    );
};

export const Spinner = ({ label = 'Loading' }) => (
    <div className="center" role="status">
        <div className="spinner" />
        <span className="sr-only">{label}</span>
    </div>
);

export const ErrorNotice = ({ error, onRetry }) => {
    if (!error) return null;
    return (
        <div className="notice notice-error" role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div className="grow">{error.message || String(error)}</div>
            {onRetry && <button className="btn btn-sm btn-secondary" onClick={onRetry}>Retry</button>}
        </div>
    );
};

export const EmptyState = ({ icon, title, children, action }) => (
    <div className="empty">
        {icon && <div className="empty-icon">{icon}</div>}
        <h2>{title}</h2>
        {children && <p className="muted small">{children}</p>}
        {action}
    </div>
);

/** Bottom sheet on phones, centered dialog on larger screens. Closes on Escape or backdrop click. */
export const Sheet = ({ title, onClose, children }) => {
    const panelRef = useRef(null);

    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose();
        document.addEventListener('keydown', onKey);
        const previouslyFocused = document.activeElement;
        panelRef.current?.querySelector('input, select, button:not(.sheet-close)')?.focus();
        const { overflow } = document.body.style;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = overflow;
            previouslyFocused?.focus?.();
        };
    }, [onClose]);

    return (
        <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={panelRef}>
                <div className="sheet-header">
                    <h2>{title}</h2>
                    <button className="btn btn-ghost icon-btn sheet-close" onClick={onClose} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};
