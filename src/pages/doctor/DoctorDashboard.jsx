import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ClinicalModal from '../../components/shared/ClinicalModal';
import {
    Calendar, Users, Clock, CheckCircle, TrendingUp, AlertCircle,
    ArrowRight, UserPlus, Bell, Search, Activity, Bookmark, Layout, CloudSun, User, Trash2, RefreshCw,
    Stethoscope, FileText, Microscope, Pill, ChevronRight, Lock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const DoctorDashboard = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [stats, setStats] = useState({ total: 0, waiting: 0, completed: 0, totalPatients: 0 });
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState({ open: false, appo: null });
    const [hospitalConfig, setHospitalConfig] = useState({ name: 'Moonview Medical Center', logo: '' });
    
    const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        
        supabase
            .from('system_config')
            .select('key, value')
            .in('key', ['hospital_name', 'hospital_logo'])
            .then(({ data }) => {
                if (!data) return;
                const config = Object.fromEntries(data.map(r => [r.key, r.value]));
                setHospitalConfig({
                    name: config.hospital_name || 'Moonview Medical Center',
                    logo: config.hospital_logo || '',
                });
            });

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (profile) {
            fetchTodayQueue();
            
            // LIVE SYNC: Listen for appointment changes (e.g. payment clearance)
            const channel = supabase
                .channel('doctor-updates')
                .on('postgres_changes', { event: '*', table: 'appointment' }, (payload) => {
                    console.log("[Realtime-Doctor] Queue Update:", payload);
                    fetchTodayQueue(true);
                })
                .subscribe((status) => {
                    console.log("[Realtime-Doctor] Subscription:", status);
                });

            // FALLBACK: Poll every 5 seconds
            const pollInterval = setInterval(() => fetchTodayQueue(true), 5000);

            return () => {
                supabase.removeChannel(channel);
                clearInterval(pollInterval);
            };
        }
    }, [profile?.id, profile?.docid]);

    const fetchTodayQueue = async (silent = false) => {
        const docIdInt = parseInt(profile?.docid);
        const isStaff = profile?.role === 'a' || profile?.role === 'r';
        
        if (!isStaff && isNaN(docIdInt)) {
            setLoading(false);
            return;
        }

        if (!silent) setLoading(true);
        try {
            const today = new Date().toISOString().split('T')[0];
            
            let query = supabase
                .from('appointment')
                .select(`
                    appoid, status, created_at,
                    patient:pid (pid, pname, patient_display_id, pgender)
                `)
                .eq('appodate', today);

            if (profile?.role !== 'a' && profile?.role !== 'r') {
                query = query.eq('docid', docIdInt);
            }

            const { data, error } = await query.order('created_at', { ascending: true });
                
            if (error) throw error;
            
            let statsQuery = supabase.from('appointment').select('pid');
            if (profile?.role !== 'a' && profile?.role !== 'r') {
                statsQuery = statsQuery.eq('docid', docIdInt);
            }
            const { data: allApps } = await statsQuery;
                
            const uniquePatientsCount = allApps ? new Set(allApps.map(a => a.pid)).size : 0;
            
            if (data) {
                const formattedQueue = data.map(appo => ({
                    appoid: appo.appoid,
                    status: appo.status,
                    created_at: appo.created_at,
                    pid: appo.patient?.pid,
                    pname: appo.patient?.pname || 'Unknown Patient',
                    patient_display_id: appo.patient?.patient_display_id || 'Unknown',
                    pgender: appo.patient?.pgender || 'N/A',
                    is_paid: true
                }));
                
                setAppointments(formattedQueue);
                
                const waiting = formattedQueue.filter(a => ['waiting', 'in_consultation', 'at_lab', 'results_ready'].includes(a.status)).length;
                const completed = formattedQueue.filter(a => a.status?.toLowerCase() === 'completed').length;
                setStats({ total: formattedQueue.length, waiting, completed, totalPatients: uniquePatientsCount });
            }
        } catch (err) {
            console.error("Failed to fetch today's queue", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete.appo) return;
        try {
            const { error } = await supabase
                .from('appointment')
                .delete()
                .eq('appoid', confirmDelete.appo.appoid);
                
            if (error) throw error;
            
            fetchTodayQueue();
            setConfirmDelete({ open: false, appo: null });
        } catch (err) {
            console.error(err);
        }
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const formattedTime = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const metrics = [
        { label: 'Active Queue', count: stats.waiting, icon: Clock, path: '/doctor/appointments', color: '#3b82f6', bg: '#eff6ff' },
        { label: 'Today Total', count: stats.total, icon: Calendar, path: '/doctor/appointments', color: '#8b5cf6', bg: '#f5f3ff' },
        { label: 'Completed', count: stats.completed, icon: CheckCircle, path: '/doctor/appointments', color: '#10b981', bg: '#f0fdf4' },
        { label: 'Patient Base', count: stats.totalPatients, icon: Users, path: '/doctor/patients', color: '#f59e0b', bg: '#fffbeb' },
    ];

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', background: '#f8fafc' }}>
            <div style={{ width: '64px', height: '64px', border: '6px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <h2 style={{ marginTop: '32px', fontWeight: '900', color: '#1e293b' }}>Syncing Clinical Hub...</h2>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );

    return (
        <div style={{ padding: '40px 60px', maxWidth: '1600px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
            <ClinicalModal 
                isOpen={confirmDelete.open}
                onClose={() => setConfirmDelete({ open: false, appo: null })}
                type="danger"
                title="Remove Appointment"
                message={`Are you sure you want to remove ${confirmDelete.appo?.pname} from the clinical queue?`}
                confirmText="Confirm Removal"
                onConfirm={handleDelete}
            />

            {/* Premium Header */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px' }}>
                <div>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: '900', letterSpacing: '-0.04em', color: '#0f172a', marginBottom: '4px' }}>
                        {getGreeting()}, <span style={{ color: '#3b82f6' }}>Dr. {profile?.docname || 'Practitioner'}</span>
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: '500' }}>Your clinical workspace is ready for today's sessions.</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{formattedTime}</div>
                    <div style={{ fontSize: '0.95rem', color: '#64748b', fontWeight: '600' }}>{todayDate}</div>
                </div>
            </header>

            {/* Hero Banner */}
            <div style={{
                backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.45)), url('/img/b8.jpg')`,
                backgroundSize: 'cover', backgroundPosition: 'center', borderRadius: '32px', padding: '48px',
                marginBottom: '40px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
            }}>
                <div style={{ flex: 1 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'rgba(255,255,255,0.2)', borderRadius: '100px', marginBottom: '24px', backdropFilter: 'blur(10px)', fontSize: '0.85rem', fontWeight: '800' }}>
                        <Activity size={14} /> LIVE CLINICAL STATUS
                    </div>
                    <h3 style={{ fontSize: '2.25rem', fontWeight: '800', marginBottom: '16px', lineHeight: 1.2 }}>
                        {stats.waiting > 0 ? `You have ${stats.waiting} patients waiting in the queue.` : "Your clinical queue is currently clear."}
                    </h3>
                    <p style={{ fontSize: '1.1rem', opacity: 0.9, fontWeight: '500', maxWidth: '600px', marginBottom: '32px' }}>
                        Access patient histories, authorize laboratory investigations, and dispense electronic prescriptions directly from your dashboard.
                    </p>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <button onClick={() => navigate('/doctor/appointments')} style={{ padding: '16px 32px', background: 'white', color: '#0f172a', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)' }}>
                            <Layout size={20} /> Enter Workflow
                        </button>
                        <button onClick={fetchTodayQueue} style={{ padding: '16px 24px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '16px', color: 'white', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <RefreshCw size={20} /> Sync Queue
                        </button>
                    </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.15)', padding: '32px', borderRadius: '24px', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.2)', textAlign: 'center' }}>
                        <div style={{ fontSize: '3.5rem', fontWeight: '900', lineHeight: 1, marginBottom: '8px' }}>{stats.waiting}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: '800', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Patients Waiting</div>
                    </div>
                </div>
            </div>

            {/* Metrics Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '48px' }}>
                {metrics.map((stat, idx) => (
                    <div key={idx} onClick={() => navigate(stat.path)}
                        style={{ background: 'white', padding: '32px', borderRadius: '28px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0,0,0,0.05)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.02)'; }}
                    >
                        <div>
                            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#0f172a', lineHeight: 1, marginBottom: '8px' }}>{stat.count}</div>
                            <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#64748b' }}>{stat.label}</div>
                        </div>
                        <div style={{ padding: '16px', background: stat.bg, borderRadius: '20px', color: stat.color }}><stat.icon size={28} /></div>
                    </div>
                ))}
            </div>

            {/* Workspace Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '40px' }}>
                {/* Active Queue Section */}
                <section style={{ background: 'white', borderRadius: '32px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
                    <div style={{ padding: '32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
                        <div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.02em' }}>Live Patient Queue</h3>
                            <p style={{ color: '#64748b', fontSize: '0.95rem', fontWeight: '500' }}>Active consultations synchronized with Registrar.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '50%', animation: 'pulse 2s infinite' }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#475569' }}>SYSTEM LIVE</span>
                            </div>
                        </div>
                    </div>
                    
                    <div style={{ padding: '0px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '16px 32px', fontSize: '0.75rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Patient Details</th>
                                    <th style={{ textAlign: 'left', padding: '16px 32px', fontSize: '0.75rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Time In</th>
                                    <th style={{ textAlign: 'left', padding: '16px 32px', fontSize: '0.75rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Status</th>
                                    <th style={{ textAlign: 'right', padding: '16px 32px', fontSize: '0.75rem', fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {appointments.filter(a => a.status?.toLowerCase() !== 'completed').map((appo, idx) => (
                                    <tr key={appo.appoid} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s' }}>
                                        <td style={{ padding: '20px 32px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{ width: '48px', height: '48px', background: '#eff6ff', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontWeight: '900' }}>{appo.pname.charAt(0)}</div>
                                                <div>
                                                    <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '1.05rem' }}>{appo.pname}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>PID: {appo.patient_display_id} • {appo.pgender === 'm' ? 'Male' : 'Female'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px 32px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '700' }}>
                                                <Clock size={16} color="#3b82f6" /> {new Date(appo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px 32px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ 
                                                    padding: '6px 12px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: '900', textTransform: 'uppercase',
                                                    background: appo.status === 'at_lab' ? '#fff7ed' : appo.status === 'results_ready' ? '#f0fdf4' : '#eff6ff',
                                                    color: appo.status === 'at_lab' ? '#c2410c' : appo.status === 'results_ready' ? '#15803d' : '#1d4ed8'
                                                }}>
                                                    {appo.status === 'at_lab' ? '🧪 At Laboratory' : appo.status === 'results_ready' ? '✅ Results Ready' : appo.status}
                                                </span>
                                                {!appo.is_paid && (
                                                    <span style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '900', background: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2' }}>
                                                        PAYMENT PENDING
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                                <button onClick={() => setConfirmDelete({ open: true, appo })} style={{ padding: '10px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '12px', cursor: 'pointer' }}><Trash2 size={18} /></button>
                                                <button 
                                                    onClick={async () => {
                                                        if (!appo.is_paid) return;
                                                        await supabase.from('appointment').update({ status: 'in_consultation' }).eq('appoid', appo.appoid);
                                                        navigate(`/doctor/consultation?appoid=${appo.appoid}`);
                                                    }} 
                                                    disabled={!appo.is_paid}
                                                    style={{ 
                                                        padding: '10px 20px', 
                                                        background: appo.is_paid ? '#0f172a' : '#f1f5f9', 
                                                        color: appo.is_paid ? 'white' : '#94a3b8', 
                                                        border: appo.is_paid ? 'none' : '1px solid #e2e8f0', 
                                                        borderRadius: '12px', 
                                                        fontWeight: '800', 
                                                        cursor: appo.is_paid ? 'pointer' : 'not-allowed', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '8px',
                                                        transition: '0.2s'
                                                    }}
                                                >
                                                    {appo.is_paid ? (
                                                        <>Session <ArrowRight size={16} /></>
                                                    ) : (
                                                        <>Locked <Lock size={14} /></>
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {appointments.filter(a => a.status?.toLowerCase() !== 'completed').length === 0 && (
                                    <tr><td colSpan="4" style={{ padding: '64px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>Your clinical queue is currently empty.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Quick Actions & Recent */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <section style={{ background: 'white', borderRadius: '32px', border: '1px solid #e2e8f0', padding: '32px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)' }}>
                        <h4 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#0f172a', marginBottom: '24px', letterSpacing: '-0.02em' }}>Clinical Toolbox</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                            <ToolButton icon={Users} label="Patient Directory" onClick={() => navigate('/doctor/patients')} color="#3b82f6" />
                            <ToolButton icon={FileText} label="Clinical Templates" onClick={() => {}} color="#8b5cf6" />
                            <ToolButton icon={Microscope} label="Investigation Log" onClick={() => {}} color="#10b981" />
                            <ToolButton icon={Pill} label="Drug Formulary" onClick={() => {}} color="#f59e0b" />
                        </div>
                    </section>

                    <section style={{ background: '#0f172a', borderRadius: '32px', padding: '32px', color: 'white', boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{ padding: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px' }}><Bookmark size={20} /></div>
                            <h4 style={{ fontSize: '1.1rem', fontWeight: '800' }}>Recent Completions</h4>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {appointments.filter(a => a.status?.toLowerCase() === 'completed').slice(0, 3).map((appo, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div style={{ fontWeight: '700' }}>{appo.pname}</div>
                                    <button onClick={() => navigate(`/doctor/patient/${appo.pid}`)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontWeight: '800', fontSize: '0.85rem' }}>View Log</button>
                                </div>
                            ))}
                            {appointments.filter(a => a.status?.toLowerCase() === 'completed').length === 0 && (
                                <p style={{ fontSize: '0.85rem', opacity: 0.6, textAlign: 'center' }}>No sessions completed today yet.</p>
                            )}
                        </div>
                    </section>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse { 0% { opacity: 0.4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.4; transform: scale(1); } }
            `}</style>
        </div>
    );
};

const ToolButton = ({ icon: Icon, label, onClick, color }) => (
    <button onClick={onClick} style={{ width: '100%', padding: '16px 20px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', transition: '0.2s' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = color; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
    >
        <div style={{ color: color }}><Icon size={20} /></div>
        <span style={{ fontWeight: '800', color: '#1e293b', flex: 1, textAlign: 'left', fontSize: '0.95rem' }}>{label}</span>
        <ChevronRight size={18} color="#94a3b8" />
    </button>
);

export default DoctorDashboard;
