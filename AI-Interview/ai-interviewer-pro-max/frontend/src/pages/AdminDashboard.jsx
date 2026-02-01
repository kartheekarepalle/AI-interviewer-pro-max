/**
 * Admin Dashboard - Complete Admin Panel
 * 
 * Admin-only page for managing the system.
 * Features:
 * - User management
 * - System health monitoring
 * - Error logs
 * - API request logs
 * - Settings & maintenance mode
 * - Bug reports
 * - Third-party integrations
 * - Usage statistics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield, Users, Search, Filter, MoreVertical, UserCheck, UserX,
    ShieldCheck, ShieldOff, Trash2, Eye, RefreshCw, TrendingUp,
    Clock, FileText, ChevronLeft, ChevronRight, AlertCircle, X,
    Check, Loader2, LogOut, Moon, Sun, Server, AlertTriangle,
    Activity, Bug, Link2, BarChart3, Wrench, Key, Terminal, Zap
} from 'lucide-react';
import { getStoredUser, getToken, authApi } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import {
    SystemHealthPanel,
    ErrorLogsPanel,
    APILogsPanel,
    AILogsPanel,
    SettingsMaintenancePanel,
    BugReportsPanel,
    IntegrationsPanel,
    UsageStatsPanel,
    APIKeyManagementPanel,
    ConsolePanel,
    BroadcastPanel
} from '../components/admin';
import '../styles/admin.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function AdminDashboard() {
    const navigate = useNavigate();
    const currentUser = getStoredUser();
    const { isDark, toggleTheme } = useTheme();

    // Check if current user is admin
    useEffect(() => {
        if (!currentUser?.is_admin) {
            navigate('/dashboard', { replace: true });
        }
    }, [currentUser, navigate]);

    // Logout handler
    const handleLogout = async () => {
        try {
            await authApi.logout();
        } catch (error) {
            console.warn('Logout error:', error);
        } finally {
            navigate('/login', { replace: true });
        }
    };

    // State
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    // Active tab state
    const [activeTab, setActiveTab] = useState('users');

    // Pagination & Filters
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');

    // Modal states
    const [selectedUser, setSelectedUser] = useState(null);
    const [showUserModal, setShowUserModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);

    // Dropdown menu
    const [openMenu, setOpenMenu] = useState(null);

    /**
     * Fetch admin stats
     */
    const fetchStats = async () => {
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    navigate('/dashboard', { replace: true });
                    return;
                }
                throw new Error('Failed to fetch stats');
            }

            const data = await response.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    /**
     * Fetch users with pagination and filters
     */
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const token = getToken();
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '15',
                sort_by: sortBy,
                sort_order: sortOrder
            });

            if (search) params.append('search', search);
            if (statusFilter !== 'all') params.append('status', statusFilter);

            const response = await fetch(`${API_BASE}/api/admin/users?${params}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 403) {
                    navigate('/dashboard', { replace: true });
                    return;
                }
                throw new Error('Failed to fetch users');
            }

            const data = await response.json();
            if (data.success) {
                setUsers(data.users);
                setTotalPages(data.pagination.total_pages);
                setTotalUsers(data.pagination.total);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page, search, statusFilter, sortBy, sortOrder, navigate]);

    /**
     * Fetch user details
     */
    const fetchUserDetails = async (userId) => {
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setSelectedUser(data.user);
                    setShowUserModal(true);
                }
            }
        } catch (err) {
            console.error('Error fetching user details:', err);
        }
    };

    /**
     * Toggle user active status
     */
    const toggleUserStatus = async (userId) => {
        setActionLoading(userId);
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/users/${userId}/toggle-status`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    // Update local state
                    setUsers(users.map(u =>
                        u.id === userId ? { ...u, is_active: data.user.is_active } : u
                    ));
                }
            }
        } catch (err) {
            console.error('Error toggling user status:', err);
        } finally {
            setActionLoading(null);
            setOpenMenu(null);
        }
    };

    /**
     * Toggle admin status
     */
    const toggleAdminStatus = async (userId) => {
        setActionLoading(userId);
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/users/${userId}/toggle-admin`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setUsers(users.map(u =>
                        u.id === userId ? { ...u, is_admin: data.user.is_admin } : u
                    ));
                }
            }
        } catch (err) {
            console.error('Error toggling admin status:', err);
        } finally {
            setActionLoading(null);
            setOpenMenu(null);
        }
    };

    /**
     * Delete user
     */
    const deleteUser = async () => {
        if (!userToDelete) return;

        setActionLoading(userToDelete.id);
        try {
            const token = getToken();
            const response = await fetch(`${API_BASE}/api/admin/users/${userToDelete.id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                // Remove from local state
                setUsers(users.filter(u => u.id !== userToDelete.id));
                setTotalUsers(prev => prev - 1);
                fetchStats(); // Refresh stats
            }
        } catch (err) {
            console.error('Error deleting user:', err);
        } finally {
            setActionLoading(null);
            setShowDeleteConfirm(false);
            setUserToDelete(null);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchStats();
    }, []);

    // Fetch users when filters change
    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClick = () => setOpenMenu(null);
        if (openMenu) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [openMenu]);

    /**
     * Format date
     */
    const formatDate = (dateString) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!currentUser?.is_admin) {
        return null;
    }

    return (
        <div className="admin-container" data-theme={document.documentElement.getAttribute('data-theme')}>
            {/* Admin-only Header */}
            <header className="admin-topbar">
                <div className="admin-topbar-left">
                    <Shield size={28} className="admin-logo-icon" />
                    <span className="admin-logo-text">Admin Panel</span>
                </div>
                <div className="admin-topbar-right">
                    <span className="admin-user-info">
                        <ShieldCheck size={16} />
                        {currentUser?.name || 'Admin'}
                    </span>
                    <button className="admin-topbar-btn" onClick={toggleTheme} title={isDark ? 'Light Mode' : 'Dark Mode'}>
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button className="admin-topbar-btn logout" onClick={handleLogout} title="Logout">
                        <LogOut size={18} />
                        <span>Logout</span>
                    </button>
                </div>
            </header>

            <div className="admin-layout">
                {/* Sidebar Navigation */}
                <aside className="admin-sidebar">
                    <div className="sidebar-section">
                        <span className="section-label">// CORE</span>
                    </div>
                    <nav className="admin-nav">
                        {/* 1. Users */}
                        <button
                            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
                            onClick={() => setActiveTab('users')}
                        >
                            <Users size={18} />
                            <span>users</span>
                            <span className="nav-shortcut">01</span>
                        </button>
                        {/* 2. API Keys */}
                        <button
                            className={`nav-item ${activeTab === 'api-keys' ? 'active' : ''}`}
                            onClick={() => setActiveTab('api-keys')}
                        >
                            <Key size={18} />
                            <span>api_keys</span>
                            <span className="nav-shortcut">02</span>
                        </button>
                        {/* 3. System Health */}
                        <button
                            className={`nav-item ${activeTab === 'health' ? 'active' : ''}`}
                            onClick={() => setActiveTab('health')}
                        >
                            <Server size={18} />
                            <span>sys_health</span>
                            <span className="nav-shortcut">03</span>
                        </button>
                        {/* 4. Console */}
                        <button
                            className={`nav-item ${activeTab === 'console' ? 'active' : ''}`}
                            onClick={() => setActiveTab('console')}
                        >
                            <Terminal size={18} />
                            <span>console</span>
                            <span className="nav-shortcut">04</span>
                        </button>
                    </nav>

                    <div className="sidebar-section">
                        <span className="section-label">// LOGS</span>
                    </div>
                    <nav className="admin-nav">
                        {/* 5. Error Logs */}
                        <button
                            className={`nav-item ${activeTab === 'errors' ? 'active' : ''}`}
                            onClick={() => setActiveTab('errors')}
                        >
                            <AlertTriangle size={18} />
                            <span>error_logs</span>
                            <span className="nav-shortcut">05</span>
                        </button>
                        {/* 6. API Logs */}
                        <button
                            className={`nav-item ${activeTab === 'api-logs' ? 'active' : ''}`}
                            onClick={() => setActiveTab('api-logs')}
                        >
                            <Activity size={18} />
                            <span>api_logs</span>
                            <span className="nav-shortcut">06</span>
                        </button>
                        {/* 7. AI Logs (Gemini & Groq) */}
                        <button
                            className={`nav-item ${activeTab === 'ai-logs' ? 'active' : ''}`}
                            onClick={() => setActiveTab('ai-logs')}
                        >
                            <Zap size={18} />
                            <span>ai_logs</span>
                            <span className="nav-shortcut">07</span>
                        </button>
                        {/* 8. Usage Stats */}
                        <button
                            className={`nav-item ${activeTab === 'usage' ? 'active' : ''}`}
                            onClick={() => setActiveTab('usage')}
                        >
                            <BarChart3 size={18} />
                            <span>usage_stats</span>
                            <span className="nav-shortcut">08</span>
                        </button>
                        {/* 9. Bug Reports */}
                        <button
                            className={`nav-item ${activeTab === 'bugs' ? 'active' : ''}`}
                            onClick={() => setActiveTab('bugs')}
                        >
                            <Bug size={18} />
                            <span>bug_reports</span>
                            <span className="nav-shortcut">09</span>
                        </button>
                    </nav>

                    <div className="sidebar-section">
                        <span className="section-label">// CONFIG</span>
                    </div>
                    <nav className="admin-nav">
                        {/* 9. Maintenance Mode */}
                        <button
                            className={`nav-item ${activeTab === 'maintenance' ? 'active' : ''}`}
                            onClick={() => setActiveTab('maintenance')}
                        >
                            <Wrench size={18} />
                            <span>maintenance</span>
                            <span className="nav-shortcut">09</span>
                        </button>
                        {/* 10. Webhook Monitoring */}
                        <button
                            className={`nav-item ${activeTab === 'webhooks' ? 'active' : ''}`}
                            onClick={() => setActiveTab('webhooks')}
                        >
                            <Zap size={18} />
                            <span>webhooks</span>
                            <span className="nav-shortcut">10</span>
                        </button>
                        {/* 11. Integrations */}
                        <button
                            className={`nav-item ${activeTab === 'integrations' ? 'active' : ''}`}
                            onClick={() => setActiveTab('integrations')}
                        >
                            <Link2 size={18} />
                            <span>integrations</span>
                            <span className="nav-shortcut">11</span>
                        </button>
                    </nav>

                    <div className="sidebar-footer">
                        <div className="system-status">
                            <span className="status-indicator online"></span>
                            <span>SYS_ONLINE</span>
                        </div>
                    </div>
                </aside>

                <main className="admin-main">
                    {/* Render active tab content */}
                    {activeTab === 'health' && <SystemHealthPanel />}
                    {activeTab === 'errors' && <ErrorLogsPanel />}
                    {activeTab === 'api-logs' && <APILogsPanel />}
                    {activeTab === 'ai-logs' && <AILogsPanel />}
                    {activeTab === 'usage' && <UsageStatsPanel />}
                    {activeTab === 'api-keys' && <APIKeyManagementPanel />}
                    {activeTab === 'bugs' && <BugReportsPanel />}
                    {activeTab === 'integrations' && <IntegrationsPanel />}
                    {activeTab === 'console' && <ConsolePanel />}
                    {activeTab === 'maintenance' && <SettingsMaintenancePanel />}
                    {activeTab === 'webhooks' && <BroadcastPanel />}

                    {/* Users Tab - Original content */}
                    {activeTab === 'users' && (
                        <>
                            {/* Header */}
                            <header className="admin-header">
                                <div className="header-content">
                                    <div className="header-title">
                                        <div className="header-icon-wrapper">
                                            <Users size={28} />
                                        </div>
                                        <div>
                                            <h1>User Management</h1>
                                            <p>View and manage all registered users</p>
                                        </div>
                                    </div>
                                    <button className="btn btn-secondary" onClick={() => { fetchStats(); fetchUsers(); }}>
                                        <RefreshCw size={18} />
                                        Refresh
                                    </button>
                                </div>
                            </header>

                            {/* Stats Cards */}
                            {stats && (
                                <div className="stats-grid">
                                    <div className="stat-card">
                                        <div className="stat-icon users">
                                            <Users size={24} />
                                        </div>
                                        <div className="stat-content">
                                            <span className="stat-value">{stats.total_users}</span>
                                            <span className="stat-label">Total Users</span>
                                        </div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-icon active">
                                            <UserCheck size={24} />
                                        </div>
                                        <div className="stat-content">
                                            <span className="stat-value">{stats.active_users}</span>
                                            <span className="stat-label">Active Users</span>
                                        </div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-icon new">
                                            <TrendingUp size={24} />
                                        </div>
                                        <div className="stat-content">
                                            <span className="stat-value">{stats.new_users_this_week}</span>
                                            <span className="stat-label">New This Week</span>
                                        </div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-icon interviews">
                                            <Clock size={24} />
                                        </div>
                                        <div className="stat-content">
                                            <span className="stat-value">{stats.total_interviews}</span>
                                            <span className="stat-label">Total Interviews</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Users Table Section */}
                            <section className="users-section">
                                <div className="section-header">
                                    <h2><Users size={20} /> User Management</h2>
                                    <span className="user-count">{totalUsers} users</span>
                                </div>

                                {/* Filters */}
                                <div className="filters-bar">
                                    <div className="search-box">
                                        <Search size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search by name or email..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                        />
                                        {search && (
                                            <button className="clear-search" onClick={() => setSearch('')}>
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="filter-group">
                                        <Filter size={18} />
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                                        >
                                            <option value="all">All Status</option>
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                        </select>
                                    </div>
                                    <div className="filter-group">
                                        <select
                                            value={`${sortBy}-${sortOrder}`}
                                            onChange={(e) => {
                                                const [field, order] = e.target.value.split('-');
                                                setSortBy(field);
                                                setSortOrder(order);
                                            }}
                                        >
                                            <option value="created_at-desc">Newest First</option>
                                            <option value="created_at-asc">Oldest First</option>
                                            <option value="name-asc">Name A-Z</option>
                                            <option value="name-desc">Name Z-A</option>
                                            <option value="email-asc">Email A-Z</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Error State */}
                                {error && (
                                    <div className="error-banner">
                                        <AlertCircle size={20} />
                                        <span>{error}</span>
                                        <button onClick={fetchUsers}>Retry</button>
                                    </div>
                                )}

                                {/* Loading State */}
                                {loading ? (
                                    <div className="loading-state">
                                        <Loader2 size={32} className="spin" />
                                        <p>Loading users...</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Users Table */}
                                        <div className="users-table-container">
                                            <table className="users-table">
                                                <thead>
                                                    <tr>
                                                        <th>User</th>
                                                        <th>Status</th>
                                                        <th>Role</th>
                                                        <th>Interviews</th>
                                                        <th>Joined</th>
                                                        <th>Last Login</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {users.map((user) => (
                                                        <tr key={user.id} className={!user.is_active ? 'inactive' : ''}>
                                                            <td className="user-cell">
                                                                <div className="user-avatar">
                                                                    {user.name?.charAt(0)?.toUpperCase() || 'U'}
                                                                </div>
                                                                <div className="user-info">
                                                                    <span className="user-name">{user.name}</span>
                                                                    <span className="user-email">{user.email}</span>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                                                                    {user.is_active ? 'Active' : 'Inactive'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className={`role-badge ${user.is_admin ? 'admin' : 'user'}`}>
                                                                    {user.is_admin ? (
                                                                        <><ShieldCheck size={14} /> Admin</>
                                                                    ) : (
                                                                        'User'
                                                                    )}
                                                                </span>
                                                            </td>
                                                            <td className="interview-count">
                                                                {user.interview_count || 0}
                                                            </td>
                                                            <td className="date-cell">
                                                                {formatDate(user.created_at)}
                                                            </td>
                                                            <td className="date-cell">
                                                                {formatDate(user.last_login_at)}
                                                            </td>
                                                            <td className="actions-cell">
                                                                <div className="action-menu">
                                                                    <button
                                                                        className="action-trigger"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setOpenMenu(openMenu === user.id ? null : user.id);
                                                                        }}
                                                                    >
                                                                        {actionLoading === user.id ? (
                                                                            <Loader2 size={18} className="spin" />
                                                                        ) : (
                                                                            <MoreVertical size={18} />
                                                                        )}
                                                                    </button>
                                                                    {openMenu === user.id && (
                                                                        <div className="action-dropdown">
                                                                            <button onClick={() => fetchUserDetails(user.id)}>
                                                                                <Eye size={16} /> View Details
                                                                            </button>
                                                                            {user.id !== currentUser.id && (
                                                                                <>
                                                                                    <button onClick={() => toggleUserStatus(user.id)}>
                                                                                        {user.is_active ? (
                                                                                            <><UserX size={16} /> Deactivate</>
                                                                                        ) : (
                                                                                            <><UserCheck size={16} /> Activate</>
                                                                                        )}
                                                                                    </button>
                                                                                    <button onClick={() => toggleAdminStatus(user.id)}>
                                                                                        {user.is_admin ? (
                                                                                            <><ShieldOff size={16} /> Remove Admin</>
                                                                                        ) : (
                                                                                            <><ShieldCheck size={16} /> Make Admin</>
                                                                                        )}
                                                                                    </button>
                                                                                    <hr />
                                                                                    <button
                                                                                        className="danger"
                                                                                        onClick={() => {
                                                                                            setUserToDelete(user);
                                                                                            setShowDeleteConfirm(true);
                                                                                            setOpenMenu(null);
                                                                                        }}
                                                                                    >
                                                                                        <Trash2 size={16} /> Delete User
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Pagination */}
                                        {totalPages > 1 && (
                                            <div className="pagination">
                                                <button
                                                    disabled={page === 1}
                                                    onClick={() => setPage(p => p - 1)}
                                                >
                                                    <ChevronLeft size={18} />
                                                </button>
                                                <span className="page-info">
                                                    Page {page} of {totalPages}
                                                </span>
                                                <button
                                                    disabled={page === totalPages}
                                                    onClick={() => setPage(p => p + 1)}
                                                >
                                                    <ChevronRight size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </section>
                        </>
                    )}
                </main>
            </div>

            {/* User Details Modal */}
            {showUserModal && selectedUser && (
                <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>User Details</h3>
                            <button className="modal-close" onClick={() => setShowUserModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="user-detail-header">
                                <div className="user-avatar large">
                                    {selectedUser.name?.charAt(0)?.toUpperCase() || 'U'}
                                </div>
                                <div>
                                    <h4>{selectedUser.name}</h4>
                                    <p>{selectedUser.email}</p>
                                </div>
                            </div>
                            <div className="detail-grid">
                                <div className="detail-item">
                                    <span className="label">Status</span>
                                    <span className={`status-badge ${selectedUser.is_active ? 'active' : 'inactive'}`}>
                                        {selectedUser.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="detail-item">
                                    <span className="label">Role</span>
                                    <span className={`role-badge ${selectedUser.is_admin ? 'admin' : 'user'}`}>
                                        {selectedUser.is_admin ? 'Admin' : 'User'}
                                    </span>
                                </div>
                                <div className="detail-item">
                                    <span className="label">Interviews</span>
                                    <span className="value">{selectedUser.interview_count || 0}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="label">Resumes</span>
                                    <span className="value">{selectedUser.resume_count || 0}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="label">Joined</span>
                                    <span className="value">{formatDate(selectedUser.created_at)}</span>
                                </div>
                                <div className="detail-item">
                                    <span className="label">Last Login</span>
                                    <span className="value">{formatDate(selectedUser.last_login_at)}</span>
                                </div>
                            </div>

                            {selectedUser.recent_interviews?.length > 0 && (
                                <div className="recent-interviews">
                                    <h5>Recent Interviews</h5>
                                    <div className="interview-list">
                                        {selectedUser.recent_interviews.map((interview) => (
                                            <div key={interview.id} className="interview-item">
                                                <div className="interview-info">
                                                    <span className="role">{interview.target_role || 'Interview'}</span>
                                                    <span className="date">{formatDate(interview.created_at)}</span>
                                                </div>
                                                <div className="interview-meta">
                                                    <span className={`status-tag ${interview.status}`}>
                                                        {interview.status}
                                                    </span>
                                                    {interview.overall_score && (
                                                        <span className="score">{interview.overall_score}%</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && userToDelete && (
                <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header danger">
                            <Trash2 size={24} />
                            <h3>Delete User</h3>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to permanently delete this user?</p>
                            <div className="user-preview">
                                <strong>{userToDelete.name}</strong>
                                <span>{userToDelete.email}</span>
                            </div>
                            <p className="warning">
                                <AlertCircle size={16} />
                                This action cannot be undone. All user data will be lost.
                            </p>
                        </div>
                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowDeleteConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={deleteUser}
                                disabled={actionLoading === userToDelete.id}
                            >
                                {actionLoading === userToDelete.id ? (
                                    <><Loader2 size={18} className="spin" /> Deleting...</>
                                ) : (
                                    <><Trash2 size={18} /> Delete User</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminDashboard;
