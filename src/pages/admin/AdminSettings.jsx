// =============================================================
// FILE: AdminSettings.jsx
// PURPOSE: React component / entry point for the eDoc Hospital
//          frontend. Part of the Vite + React SPA.
// =============================================================
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { getSystemConfig, updateSystemConfig, getPasswordChangeRequests, updatePasswordChangeRequestStatus, updateCurrentUserProfile, getCurrentUser } from '../../lib/api';
import { 
    Settings, Save, Globe, Landmark, Percent, HardDrive, 
    Shield, Bell, Stethoscope, Mail, Phone, MapPin, 
    Clock, DollarSign, AlertCircle, CheckCircle
} from 'lucide-react';

const AdminSettings = () => {
    const [activeTab, setActiveTab] = useState('account');
    const [config, setConfig] = useState({ 
        hospital_name: '', 
        hospital_tagline: '',
        hospital_address: '',
        hospital_phone: '',
        hospital_email: '',
        currency: 'KSh', 
        vat_rate: '16', 
        consultation_fee: '1000',
        registration_fee: '500',
        followup_days: '7',
        system_status: 'Online', 
        hospital_logo: '',
        session_timeout: '12',
        maintenance_message: 'The system is currently undergoing scheduled maintenance. Please check back later.'
    });
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);
    const [requests, setRequests] = useState([]);
    const [usernameRequests, setUsernameRequests] = useState([]);
    const [adminCreds, setAdminCreds] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    useEffect(() => {
        getSystemConfig()
            .then(({ data, error }) => {
                if (!error && data?.length) {
                    const configData = data.reduce((acc, item) => ({ ...acc, [item.key]: item.value }), {});
                    setConfig(prev => ({ ...prev, ...configData }));
                }
            })
            .catch(console.error);
            
        getCurrentUser()
            .then(user => {
                if (user) {
                    setAdminCreds(prev => ({
                        ...prev,
                        email: user.email,
                        username: user.user_metadata?.full_name || ''
                    }));
                }
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (activeTab === 'authorizations') {
            getPasswordChangeRequests()
                .then(({ data, error }) => {
                    if (!error) setRequests(data || []);
                })
                .catch(console.error);

            supabase
                .from('password_change_requests')
                .select('*')
                .order('created_at', { ascending: false })
                .then(({ data, error }) => {
                    if (!error) setUsernameRequests(data || []);
                })
                .catch(console.error);

            // Real-time updates for requests
            const subscription = supabase
                .channel('password_change_requests_channel')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'password_change_requests' }, payload => {
                    getPasswordChangeRequests().then(({ data }) => {
                        if (data) setRequests(data);
                    });
                })
                .subscribe();

            const userSubscription = supabase
                .channel('password_change_requests_channel_2')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'password_change_requests' }, payload => {
                    supabase.from('password_change_requests').select('*').order('created_at', { ascending: false }).then(({ data }) => {
                        if (data) setUsernameRequests(data);
                    });
                })
                .subscribe();

            return () => {
                supabase.removeChannel(subscription);
                supabase.removeChannel(userSubscription);
            };
        }
    }, [activeTab]);

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const updates = {
                hospital_name: config.hospital_name,
                hospital_tagline: config.hospital_tagline,
                hospital_address: config.hospital_address,
                hospital_phone: config.hospital_phone,
                hospital_email: config.hospital_email,
                currency: config.currency,
                vat_rate: config.vat_rate,
                consultation_fee: config.consultation_fee,
                registration_fee: config.registration_fee,
                followup_days: config.followup_days,
                system_status: config.system_status,
                hospital_logo: config.hospital_logo,
                session_timeout: config.session_timeout,
                maintenance_message: config.maintenance_message,
            };
            await updateSystemConfig(updates);
            showToast('Global configuration updated successfully');
        } catch (err) {
            showToast('Connection error', 'error');
        }
        setLoading(false);
    };

    const handleAuthorize = async (id, email, newPassword) => {
        try {
            await updatePasswordChangeRequestStatus(id, 'authorized');
            showToast('Password change authorized successfully');
            const { data } = await getPasswordChangeRequests();
            setRequests(data || []);
        } catch (err) {
            showToast('Error authorizing password change', 'error');
        }
    };

    const handleRevoke = async (id) => {
        try {
            await updatePasswordChangeRequestStatus(id, 'revoked');
            showToast('Password change request revoked');
            const { data } = await getPasswordChangeRequests();
            setRequests(data || []);
        } catch (err) {
            showToast('Error revoking password change', 'error');
        }
    };

    const handleApproveUsername = async (id, email, newUsername) => {
        try {
            // 1. Update profiles table
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ username: newUsername })
                .eq('email', email);
                
            if (profileError) throw profileError;
            
            // 2. Update request status
            await supabase
                .from('username_change_requests')
                .update({ status: 'approved' })
                .eq('id', id);
                
            showToast('Username change approved and updated!');
            
            // Refresh list
            const { data } = await supabase.from('password_change_requests').select('*').order('created_at', { ascending: false });
            if (data) setUsernameRequests(data);
        } catch (err) {
            showToast('Error approving username change: ' + err.message, 'error');
        }
    };

    const handleDenyUsername = async (id) => {
        try {
            await supabase
                .from('password_change_requests')
                .update({ status: 'denied' })
                .eq('id', id);
                
            showToast('Username change denied');
            
            // Refresh list
            const { data } = await supabase.from('password_change_requests').select('*').order('created_at', { ascending: false });
            if (data) setUsernameRequests(data);
        } catch (err) {
            showToast('Error denying username change', 'error');
        }
    };

    const handleUpdateAdminCreds = async () => {
        if (adminCreds.password && adminCreds.password !== adminCreds.confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }
        try {
            setLoading(true);
            const res = await updateCurrentUserProfile({
                full_name: adminCreds.username,
                email: adminCreds.email,
                password: adminCreds.password
            });
            if (res.error) {
                showToast(res.error.message, 'error');
            } else {
                showToast('Admin profile updated successfully');
                setAdminCreds({ ...adminCreds, password: '', confirmPassword: '' });
            }
        } catch (err) {
            showToast('Error updating profile', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setConfig({ ...config, hospital_logo: reader.result });
            };
            reader.readAsDataURL(file);
        }
    };

    const TabButton = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            style={{
                padding: '12px 20px',
                borderRadius: '12px',
                border: 'none',
                background: activeTab === id ? 'var(--primary)' : 'transparent',
                color: activeTab === id ? 'white' : '#64748b',
                fontWeight: '700',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                transition: '0.2s all'
            }}
        >
            <Icon size={18} />
            {label}
        </button>
    );

    return (
        <div style={{ padding: '48px 64px', maxWidth: '1600px', margin: '0 auto', background: '#f1f5f9', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
            {toast && (
                <div style={{ 
                    position: 'fixed', top: 32, right: 32, zIndex: 9999, 
                    background: toast.type === 'error' ? '#ef4444' : '#10b981', 
                    color: 'white', padding: '16px 32px', borderRadius: '16px', 
                    fontWeight: '700', boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                    display: 'flex', alignItems: 'center', gap: 12,
                    animation: 'slideIn 0.3s ease-out'
                }}>
                    {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    {toast.msg}
                </div>
            )}

                <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.04em', marginBottom: '8px' }}>System Control Portal</h1>
                        <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Configure global hospital parameters and operational logic.</p>
                    </div>
                    <button 
                        onClick={handleSave} 
                        disabled={loading}
                        style={{ 
                            padding: '14px 28px', background: 'var(--primary)', color: 'white', border: 'none', 
                            borderRadius: '14px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 20px rgba(37, 99, 235, 0.2)'
                        }}
                    >
                        <Save size={20} /> {loading ? 'Syncing...' : 'Save All Changes'}
                    </button>
                </header>

                <div style={{ display: 'flex', gap: '8px', background: 'white', padding: '8px', borderRadius: '16px', marginBottom: '32px', width: 'fit-content', border: '1px solid #e2e8f0' }}>
                    <TabButton id="account" icon={Settings} label="Admin Account" />
                    <TabButton id="authorizations" icon={Bell} label="Authorizations" />
                </div>

                <div style={{ maxWidth: '900px' }}>
                    {activeTab === 'account' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Security & Access (System Settings) */}
                            <div style={{ background: 'white', padding: '40px', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Shield size={22} color="#f59e0b" /> Security & Access
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Maintenance Mode</label>
                                        <select style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }} value={config.system_status} onChange={e => setConfig({...config, system_status: e.target.value})}>
                                            <option>Online</option>
                                            <option>Maintenance Mode</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Maintenance Notification Message</label>
                                        <textarea rows={2} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem', resize: 'none' }} value={config.maintenance_message} onChange={e => setConfig({...config, maintenance_message: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            {/* Admin Account Settings */}
                            <div style={{ background: 'white', padding: '40px', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Settings size={22} color="#64748b" /> Admin Account Settings
                                </h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Username (Full Name)</label>
                                        <input type="text" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }} value={adminCreds.username} onChange={e => setAdminCreds({...adminCreds, username: e.target.value})} placeholder="Admin Name" />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Email</label>
                                        <input type="email" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }} value={adminCreds.email} onChange={e => setAdminCreds({...adminCreds, email: e.target.value})} placeholder="admin@example.com" />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>New Password</label>
                                        <input type="password" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }} value={adminCreds.password} onChange={e => setAdminCreds({...adminCreds, password: e.target.value})} placeholder="Leave blank to keep current" />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#475569', marginBottom: '8px' }}>Confirm Password</label>
                                        <input type="password" style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '1rem' }} value={adminCreds.confirmPassword} onChange={e => setAdminCreds({...adminCreds, confirmPassword: e.target.value})} placeholder="Confirm new password" />
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <button 
                                            onClick={handleUpdateAdminCreds}
                                            style={{ padding: '12px 24px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
                                        >
                                            Update Admin Account
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'authorizations' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Staff Password Change Requests */}
                            <div style={{ background: 'white', padding: '40px', borderRadius: '32px', border: '1px solid #e2e8f0' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Bell size={22} color="#3b82f6" /> Staff Password Change Requests
                                </h3>
                                {requests.length === 0 ? (
                                    <p style={{ color: '#64748b', textAlign: 'center' }}>No pending requests.</p>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#475569' }}>Staff Email</th>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#475569' }}>Current Password</th>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#475569' }}>New Password</th>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#475569' }}>Status</th>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#475569' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {requests.map(req => (
                                                    <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                        <td style={{ padding: '12px' }}>{req.user_email}</td>
                                                        <td style={{ padding: '12px' }}>{req.current_password || '********'}</td>
                                                        <td style={{ padding: '12px' }}>{req.new_password}</td>
                                                        <td style={{ padding: '12px' }}>
                                                            <span style={{ 
                                                                padding: '4px 8px', 
                                                                borderRadius: '8px', 
                                                                fontSize: '0.8rem', 
                                                                fontWeight: '700',
                                                                background: req.status === 'pending' ? '#fef3c7' : req.status === 'authorized' ? '#d1fae5' : '#fee2e2',
                                                                color: req.status === 'pending' ? '#d97706' : req.status === 'authorized' ? '#059669' : '#dc2626'
                                                            }}>
                                                                {req.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px' }}>
                                                            {req.status === 'pending' && (
                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <button 
                                                                        onClick={() => handleAuthorize(req.id, req.user_email, req.new_password)}
                                                                        style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                                                                    >
                                                                        Authorize
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleRevoke(req.id)}
                                                                        style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                                                                    >
                                                                        Revoke
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Staff Username Change Requests */}
                            <div style={{ background: 'white', padding: '40px', borderRadius: '32px', border: '1px solid #e2e8f0', marginTop: '24px' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Bell size={22} color="#8b5cf6" /> Staff Username Change Requests
                                </h3>
                                {usernameRequests.length === 0 ? (
                                    <p style={{ color: '#64748b', textAlign: 'center' }}>No pending requests.</p>
                                ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead>
                                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#475569' }}>Staff Email</th>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#475569' }}>Current Username</th>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#475569' }}>New Username</th>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#475569' }}>Status</th>
                                                    <th style={{ textAlign: 'left', padding: '12px', color: '#475569' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {usernameRequests.map(req => (
                                                    <tr key={req.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                        <td style={{ padding: '12px' }}>{req.user_email}</td>
                                                        <td style={{ padding: '12px' }}>{req.current_username || 'N/A'}</td>
                                                        <td style={{ padding: '12px' }}>{req.new_username}</td>
                                                        <td style={{ padding: '12px' }}>
                                                            <span style={{ 
                                                                padding: '4px 8px', 
                                                                borderRadius: '8px', 
                                                                fontSize: '0.8rem', 
                                                                fontWeight: '700',
                                                                background: req.status === 'pending' ? '#fef3c7' : req.status === 'approved' ? '#d1fae5' : '#fee2e2',
                                                                color: req.status === 'pending' ? '#d97706' : req.status === 'approved' ? '#059669' : '#dc2626'
                                                            }}>
                                                                {req.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px' }}>
                                                            {req.status === 'pending' && (
                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <button 
                                                                        onClick={() => handleApproveUsername(req.id, req.user_email, req.new_username)}
                                                                        style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                                                                    >
                                                                        Approve
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => handleDenyUsername(req.id)}
                                                                        style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                                                                    >
                                                                        Deny
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}} />
        </div>
    );
};

export default AdminSettings;
