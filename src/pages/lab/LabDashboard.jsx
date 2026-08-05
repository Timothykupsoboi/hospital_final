// =============================================================
// FILE: LabDashboard.jsx
// PURPOSE: React component / entry point for the eDoc Hospital
//          frontend. Part of the Vite + React SPA.
// =============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { Microscope, ClipboardList, CheckCircle, AlertCircle, TrendingUp, CloudSun, RefreshCw, Activity, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function LabDashboard() {
    const [stats, setStats] = useState({ pending: 0, urgent: 0, completedToday: 0, requestedToday: 0 });
    const [requests, setRequests] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const { profile } = useAuth();
    const navigate = useNavigate();
    const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = useCallback(async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // 1. Fetch raw lab requests
            const { data: rawData, error: labError } = await supabase
                .from('lab_requests')
                .select('id, test_name, status, created_at, appointment_id, pid, docid, test_id, category')
                .order('created_at', { ascending: false });
                
            if (labError) throw labError;
            
            // 2. Fetch related appointments and patients manually
            const appoids = [...new Set((rawData || []).map(r => r.appointment_id).filter(Boolean))];
            let appos = [];
            if (appoids.length > 0) {
                const { data: appoData, error: appoError } = await supabase
                    .from('appointment')
                    .select(`
                        appoid, 
                        appodate,
                        patient:pid(pid, pname, pgender),
                        doctor:docid(docname)
                    `)
                    .in('appoid', appoids);
                if (appoError) console.warn("Appointment fetch failed", appoError);
                else appos = appoData || [];
            }

            const allReqs = (rawData || []).map(r => {
                const appo = appos.find(a => a.appoid === r.appointment_id);
                return {
                    ...r,
                    appointment: appo
                };
            });
            
            const pendingReqs = allReqs.filter(r => r.status !== 'completed').map(r => ({
                ...r,
                pname: r.appointment?.patient?.pname || 'Unknown',
                pgender: r.appointment?.patient?.pgender || 'Unknown',
                docname: 'Clinical Staff' // Simplified
            }));
            
            setRequests(pendingReqs);
            
            let pendingCount = 0;
            let urgentCount = 0;
            let completedTodayCount = 0;
            let requestedTodayCount = 0;
            
            allReqs.forEach(r => {
                const isToday = r.created_at && r.created_at.startsWith(today);
                
                if (r.status !== 'completed') {
                    pendingCount++;
                    if (r.urgency === 'Urgent') urgentCount++;
                } else {
                    if (isToday) completedTodayCount++;
                }
                
                if (isToday) requestedTodayCount++;
            });
            
            setStats({
                pending: pendingCount,
                urgent: urgentCount,
                completedToday: completedTodayCount,
                requestedToday: requestedTodayCount
            });
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // REALTIME SUBSCRIPTION FOR LIVE UPDATES
    useEffect(() => {
        const labChannel = supabase
            .channel('lab_dashboard_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_requests' }, () => {
                console.log('[Realtime] Lab requests changed, refreshing dashboard...');
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(labChannel);
        };
    }, [fetchData]);

    const getGreeting = () => {
        const h = currentTime.getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const timeStr = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const [t, period] = timeStr.split(' ');

    const statCards = [
        { label: "Today's Requests", value: stats.requestedToday, icon: ClipboardList, color: '#3b82f6', bg: '#eff6ff' },
        { label: 'Pending Queue', value: stats.pending, icon: Microscope, color: '#f59e0b', bg: '#fffbeb' },
        { label: 'Urgent Cases', value: stats.urgent, icon: AlertCircle, color: '#ef4444', bg: '#fef2f2' },
        { label: 'Completed Today', value: stats.completedToday, icon: CheckCircle, color: '#10b981', bg: '#ecfdf5' },
    ];

    return (
        <div style={{ padding: '40px 56px', maxWidth: '1600px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>

                {/* Modern Dynamic Welcome Hero */}
                <div style={{
                    backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.45)), url('/img/b8.jpg')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRadius: '24px',
                    padding: '40px',
                    marginBottom: '40px',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '12px' }}>
                            {getGreeting()},<br />
                            <span style={{ color: '#60a5fa' }}>{profile?.labname || 'Laboratory Technician'}</span>
                        </h2>
                        <p style={{ fontSize: '1.1rem', opacity: 1, fontWeight: '600', marginBottom: '32px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                            You have <span style={{ color: '#60a5fa', fontWeight: '800' }}>{stats.pending}</span> total pending laboratory requests in your queue. <Microscope size={16} style={{ verticalAlign: 'middle', marginLeft: '4px' }} />
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => navigate('/lab/workbench')} style={{ padding: '12px 24px', background: '#3b82f6', border: 'none', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.2)' }}>
                                <Microscope size={18} /> Open Lab Workbench
                            </button>
                            <button onClick={() => navigate('/lab/analytics')} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '12px', color: 'white', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <TrendingUp size={18} /> Lab Intelligence
                            </button>
                        </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '20px' }}>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '3rem', fontWeight: '800', lineHeight: 1 }}>24°C</div>
                                <div style={{ fontSize: '1rem', opacity: 0.9, fontWeight: '500' }}>Partly Cloudy</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '16px', borderRadius: '50%', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                                <CloudSun size={48} />
                            </div>
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: '600', opacity: 0.9 }}>Clinical Laboratory HQ</div>
                    </div>
                </div>

                {/* Main Content (Full Width) */}
                <div style={{ background: 'white', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                        <h3 style={{ fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                            <TrendingUp size={20} color="#3b82f6" /> Active Lab Queue
                        </h3>
                        
                        <div style={{ position: 'relative', flex: 1, maxWidth: '500px' }}>
                            <input 
                                type="text" 
                                placeholder="Search by patient name..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', padding: '12px 16px 12px 40px', borderRadius: '14px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.9rem', fontWeight: 600, outline: 'none', transition: '0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                            />
                            <Search size={20} color="#94a3b8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                        </div>

                        <button onClick={fetchData} style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.8rem', transition: '0.2s' }}>
                            <RefreshCw size={18} /> Sync Queue
                        </button>
                    </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        {['Patient', 'Investigations & Instructions', 'Payment', 'Status', 'Priority', 'Actions'].map(h => (
                                            <th key={h} style={{ textAlign: 'left', padding: '16px 20px', fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.values(requests.filter(r => r.pname.toLowerCase().includes(searchTerm.toLowerCase())).reduce((acc, r) => {
                                        const key = r.appointment_id || r.id;
                                        if (!acc[key]) {
                                            acc[key] = { 
                                                ...r, 
                                                allTests: [{ name: r.test_name, paid: r.is_paid }], 
                                                testCount: 1, 
                                                indications: [r.clinical_indication].filter(Boolean), 
                                                unpaidCount: r.is_paid ? 0 : 1 
                                            };
                                        } else {
                                            acc[key].allTests.push({ name: r.test_name, paid: r.is_paid });
                                            acc[key].testCount++;
                                            if (!r.is_paid) acc[key].unpaidCount++;
                                            if (r.clinical_indication) acc[key].indications.push(r.clinical_indication);
                                            if (r.urgency === 'Urgent') acc[key].urgency = 'Urgent';
                                        }
                                        return acc;
                                    }, {})).length > 0 ? Object.values(requests.filter(r => r.pname.toLowerCase().includes(searchTerm.toLowerCase())).reduce((acc, r) => {
                                        const key = r.appointment_id || r.id;
                                        if (!acc[key]) {
                                            acc[key] = { ...r, allTests: [{ name: r.test_name, paid: r.is_paid }], testCount: 1, indications: [r.clinical_indication].filter(Boolean), unpaidCount: r.is_paid ? 0 : 1 };
                                        } else {
                                            acc[key].allTests.push({ name: r.test_name, paid: r.is_paid });
                                            acc[key].testCount++;
                                            if (!r.is_paid) acc[key].unpaidCount++;
                                            if (r.clinical_indication) acc[key].indications.push(r.clinical_indication);
                                            if (r.urgency === 'Urgent') acc[key].urgency = 'Urgent';
                                        }
                                        return acc;
                                    }, {})).slice(0, 10).map((r, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', transition: '0.2s' }}>
                                             <td style={{ padding: '20px 20px' }}>
                                                 <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.95rem' }}>{r.pname}</div>
                                                 <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{r.pgender} • {r.pgender === 'Female' ? '♀' : '♂'}</div>
                                             </td>
                                             <td style={{ padding: '20px 20px', maxWidth: '300px' }}>
                                                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                                     {r.allTests.map((t, ti) => (
                                                         <span 
                                                            key={ti} 
                                                            style={{ 
                                                                background: t.paid ? '#ecfdf5' : '#fef2f2', 
                                                                padding: '4px 10px', 
                                                                borderRadius: '8px', 
                                                                fontSize: '0.75rem', 
                                                                fontWeight: 700, 
                                                                color: t.paid ? '#065f46' : '#991b1b', 
                                                                border: t.paid ? '1px solid #d1fae5' : '1px solid #fee2e2' 
                                                            }}
                                                         >
                                                             {t.name}
                                                         </span>
                                                     ))}
                                                 </div>
                                                 {r.indications?.length > 0 && (
                                                     <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                         <Activity size={12} color="#3b82f6" /> {r.indications[0]}
                                                     </div>
                                                 )}
                                             </td>
                                             <td style={{ padding: '20px 20px' }}>
                                                 {r.unpaidCount > 0 ? (
                                                     <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                        {r.unpaidCount === r.testCount ? (
                                                            <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 900, background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2', textAlign: 'center' }}>
                                                                UNPAID
                                                            </span>
                                                        ) : (
                                                            <span style={{ 
                                                                padding: '4px 12px', 
                                                                borderRadius: 8, 
                                                                fontSize: '0.7rem', 
                                                                fontWeight: 900, 
                                                                background: (r.testCount - r.unpaidCount) / r.testCount >= 0.6 ? '#f5f3ff' : '#fff7ed', 
                                                                color: (r.testCount - r.unpaidCount) / r.testCount >= 0.6 ? '#7c3aed' : '#f59e0b', 
                                                                border: (r.testCount - r.unpaidCount) / r.testCount >= 0.6 ? '1px solid #ddd6fe' : '1px solid #ffedd5', 
                                                                textAlign: 'center' 
                                                            }}>
                                                                PARTIAL ({Math.round(((r.testCount - r.unpaidCount) / r.testCount) * 100)}%)
                                                            </span>
                                                        )}
                                                        <div style={{ fontSize: '0.65rem', color: '#64748b', textAlign: 'center', fontWeight: 700 }}>
                                                            {r.testCount - r.unpaidCount} / {r.testCount} CLEARED
                                                        </div>
                                                     </div>
                                                 ) : (
                                                     <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: '0.7rem', fontWeight: 900, background: '#ecfdf5', color: '#10b981', border: '1px solid #d1fae5' }}>
                                                         PAID
                                                     </span>
                                                 )}
                                             </td>
                                             <td style={{ padding: '20px 20px' }}>
                                                 <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                     <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.status === 'completed' ? '#10b981' : '#f59e0b' }} />
                                                     <span style={{ fontWeight: 800, fontSize: '0.72rem', color: r.status === 'completed' ? '#10b981' : '#f59e0b', textTransform: 'uppercase' }}>
                                                         {r.status || 'Pending'}
                                                     </span>
                                                 </div>
                                             </td>
                                            <td style={{ padding: '20px 20px' }}>
                                                <span style={{ padding: '4px 12px', borderRadius: 12, fontSize: '0.68rem', fontWeight: 900, background: r.urgency === 'Urgent' ? '#fef2f2' : '#f0f9ff', color: r.urgency === 'Urgent' ? '#ef4444' : '#3b82f6', border: r.urgency === 'Urgent' ? '1px solid #fee2e2' : '1px solid #e0f2fe' }}>
                                                    {r.urgency === 'Urgent' ? '⚡ URGENT' : 'ROUTINE'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '20px 20px' }}>
                                                <button 
                                                    disabled={r.unpaidCount === r.testCount}
                                                    onClick={() => navigate(`/lab/workbench?appoid=${r.appointment_id}`)}
                                                    style={{ 
                                                        background: r.unpaidCount === r.testCount ? '#94a3b8' : '#0f172a', 
                                                        color: 'white', 
                                                        border: 'none', 
                                                        padding: '10px 18px', 
                                                        borderRadius: '10px', 
                                                        fontWeight: '800', 
                                                        fontSize: '0.75rem', 
                                                        cursor: r.unpaidCount === r.testCount ? 'not-allowed' : 'pointer', 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        gap: '8px',
                                                        transition: '0.2s',
                                                        boxShadow: r.unpaidCount === r.testCount ? 'none' : '0 4px 6px -1px rgba(0,0,0,0.1)',
                                                        opacity: r.unpaidCount === r.testCount ? 0.7 : 1
                                                    }}
                                                >
                                                    {r.unpaidCount === r.testCount ? (
                                                        <>Locked <Activity size={14} opacity={0.5} /></>
                                                    ) : (
                                                        (r.status?.toLowerCase() === 'pending' || r.status?.toLowerCase() === 'sent' || !r.status) ? (
                                                            <>Start <Microscope size={14} /></>
                                                        ) : (
                                                            <>Continue <Activity size={14} /></>
                                                        )
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                                <ClipboardList size={32} opacity={0.3} />
                                                <div style={{ fontWeight: 700 }}>No pending requests in queue</div>
                                            </div>
                                        </td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                </div>
        </div>
    );
}
