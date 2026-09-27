import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import Landing from './pages/Landing';
import Home from './pages/Home';
import Group from './pages/Group';
import ExpenseForm from './pages/ExpenseForm';
import Join from './pages/Join';
import Activity from './pages/Activity';
import Account from './pages/Account';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/auth/AuthPages';

/** Signed-out visitors go to login, and come back here afterwards. */
const RequireAuth = ({ children }) => {
    const { isSignedIn } = useAuth();
    const location = useLocation();
    return isSignedIn ? children : <Navigate to="/login" replace state={{ from: location.pathname }} />;
};

// Old URLs (bookmarks, links in old emails) keep working
const LegacyGroupRedirect = () => <Navigate to={`/groups/${useParams().id}`} replace />;

export default function App() {
    return (
        <BrowserRouter>
            <AppShell>
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/join/:code" element={<Join />} />

                    <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
                    <Route path="/groups/:groupId" element={<RequireAuth><Group /></RequireAuth>} />
                    <Route path="/groups/:groupId/expenses/new" element={<RequireAuth><ExpenseForm /></RequireAuth>} />
                    <Route path="/groups/:groupId/expenses/:expenseId/edit" element={<RequireAuth><ExpenseForm /></RequireAuth>} />
                    <Route path="/activity" element={<RequireAuth><Activity /></RequireAuth>} />
                    <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />

                    <Route path="/dashboard" element={<Navigate to="/home" replace />} />
                    <Route path="/group/:id" element={<LegacyGroupRedirect />} />
                    <Route path="/notifications" element={<Navigate to="/activity" replace />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <footer className="footer">© {new Date().getFullYear()} FairShare</footer>
            </AppShell>
        </BrowserRouter>
    );
}
