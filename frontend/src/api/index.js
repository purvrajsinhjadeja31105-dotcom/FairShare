// One function per backend endpoint, so pages never build URLs themselves.
import { request } from './client';

export const api = {
    // auth
    login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
    register: (username, email, password) => request('/auth/register', { method: 'POST', body: { username, email, password } }),
    resendVerification: (email) => request('/auth/resend-verification', { method: 'POST', body: { email } }),
    forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
    resetPassword: (token, newPassword) => request('/auth/reset-password', { method: 'POST', body: { token, newPassword } }),

    // account
    updateProfile: (profile) => request('/users/profile', { method: 'PUT', body: profile }),

    // home
    overview: () => request('/expenses/overview'),

    // groups
    createGroup: (name) => request('/groups', { method: 'POST', body: { name } }),
    group: (groupId) => request(`/groups/${groupId}`),
    members: (groupId) => request(`/groups/${groupId}/members`),
    addMemberByEmail: (groupId, email) => request(`/groups/${groupId}/members`, { method: 'POST', body: { email } }),
    leaveGroup: (groupId) => request(`/groups/${groupId}/leave`, { method: 'POST' }),
    deleteGroup: (groupId) => request(`/groups/${groupId}`, { method: 'DELETE' }),

    // invites
    inviteCode: (groupId) => request(`/groups/${groupId}/invite`),
    resetInvite: (groupId) => request(`/groups/${groupId}/invite/reset`, { method: 'POST' }),
    previewInvite: (code) => request(`/groups/invite/${code}`),
    joinInvite: (code) => request(`/groups/invite/${code}/join`, { method: 'POST' }),

    // expenses
    expenses: (groupId) => request(`/expenses/${groupId}/all`),
    balances: (groupId) => request(`/expenses/${groupId}/settlements`),
    addExpense: (groupId, expense) => request(`/expenses/${groupId}`, { method: 'POST', body: expense }),
    updateExpense: (expenseId, changes) => request(`/expenses/${expenseId}`, { method: 'PUT', body: changes }),
    deleteExpense: (expenseId) => request(`/expenses/${expenseId}`, { method: 'DELETE' }),
    history: (expenseId) => request(`/expenses/${expenseId}/history`),

    // settling up
    settle: (groupId, { fromUserId, toUserId, amount }) => request(`/expenses/${groupId}/settle`, { method: 'POST', body: { fromUserId, toUserId, amount } }),
    respondToPayment: (settlementId, action) => request(`/expenses/${settlementId}/settlement`, { method: 'POST', body: { action } }),

    // notifications
    notifications: () => request('/notifications'),
    markNotificationsRead: () => request('/notifications/read', { method: 'POST' })
};
