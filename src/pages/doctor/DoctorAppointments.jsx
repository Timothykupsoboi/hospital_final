// =============================================================
// FILE: DoctorAppointments.jsx
// PURPOSE: React component / entry point for the eDoc Hospital
//          frontend. Part of the Vite + React SPA.
// =============================================================
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarRange, Filter, Search, Lock, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const DoctorAppointments = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (profile?.docid) {
            fetchQueue();

            // LIVE SYNC: Listen for appointment changes
            const channel = supabase
                .channel('appt-list-updates')
                .on('postgres_changes', { event: '*', table: 'appointment' }, (payload) => {
                    console.log("[Realtime-Appts] Update:", payload);
                    fetchQueue(true);
                })
                .subscribe((status) => {
                    console.log("[Realtime-Appts] Status:", status);
                });

            // FALLBACK: Poll every 5 seconds
            const pollInterval = setInterval(() => fetchQueue(true), 5000);

            return () => {
                supabase.removeChannel(channel);
                clearInterval(pollInterval);
            };
        }
    }, [profile]);

    const fetchQueue = async (silent = false) => {
        const docIdInt = parseInt(profile?.docid);
        if (isNaN(docIdInt)) {
            setLoading(false);
            return;
        }

        if (!silent) setLoading(true);
        try {
            let query = supabase
                .from('appointment')
                .select(`
                    appoid, apponum, appodate, status,
                    patient:pid (pname, ptel, patient_display_id),
                    schedule:scheduleid (scheduledate, scheduletime)
                `);

            if (!isNaN(docIdInt)) {
                query = query.eq('docid', docIdInt);
            }

            const { data, error } = await query.order('appoid', { ascending: false });
            if (error) throw error;

            if (data) {
                const formattedQueue = data.map(appo => ({
                    appoid: appo.appoid,
                    apponum: appo.apponum,
                    status: appo.status,
                    is_paid: true,
                    pname: appo.patient?.pname || 'Unknown Patient',
                    ptel: appo.patient?.ptel || 'N/A',
                    scheduledate: appo.schedule?.scheduledate || appo.appodate,
                    scheduletime: appo.schedule?.scheduletime || '00:00'
                }));
                setQueue(formattedQueue);
            }
        } catch (err) {
            console.error("Failed to fetch queue", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '48px 64px', maxWidth: '1600px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '48px' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <CalendarRange size={28} color="var(--primary)" /> Appointments & Queue
                    </h1>
                    <p style={{ color: 'var(--text-muted)' }}>Manage your scheduled sessions and live waiting room.</p>
                </div>
            </header>

            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '24px', display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-muted)' }} />
                    <input type="text" placeholder="Search appointments by patient name or ID..." className="input-field" style={{ paddingLeft: '44px', width: '100%' }} />
                </div>
                <button className="btn-primary" style={{ background: 'white', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                    <Filter size={18} /> Filter Status
                </button>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '16px 24px', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Time</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Appt No.</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Patient Details</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status</th>
                            <th style={{ padding: '16px 24px', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center' }}>Loading...</td></tr>
                        ) : queue.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '24px', textAlign: 'center' }}>No appointments found.</td></tr>
                        ) : queue.map((q) => (
                            <tr key={q.appoid} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '16px 24px', fontSize: '0.875rem', fontWeight: '500' }}>
                                    {q.scheduletime ? q.scheduletime.slice(0, 5) : 'N/A'}
                                    {q.scheduledate !== new Date().toISOString().split('T')[0] && (
                                        <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '2px' }}>{q.scheduledate}</div>
                                    )}
                                </td>
                                <td style={{ padding: '16px 24px', fontSize: '0.875rem' }}>#{q.apponum || q.appoid}</td>
                                <td style={{ padding: '16px 24px', fontSize: '0.875rem' }}>
                                    <div style={{ fontWeight: '600' }}>{q.pname}</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{q.ptel}</div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {q.status === 'waiting' && <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#fffbeb', color: '#d97706', fontSize: '0.75rem', fontWeight: '600' }}>Waiting</span>}
                                        {(q.status === 'in_consultation' || q.status === 'Consultation') && <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#eff6ff', color: '#3b82f6', fontSize: '0.75rem', fontWeight: '600' }}>Consultation</span>}
                                        {q.status === 'pending_lab' && <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', fontWeight: '600' }}>At Lab</span>}
                                        {q.status === 'results_ready' && <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#f0fdf4', color: '#166534', fontSize: '0.75rem', fontWeight: '600' }}>Results Ready</span>}
                                        {q.status?.toLowerCase() === 'completed' && <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#059669', fontSize: '0.75rem', fontWeight: '600' }}>Done</span>}
                                        
                                        {!q.is_paid && (
                                            <span style={{ padding: '4px 8px', borderRadius: '4px', background: '#fef2f2', color: '#dc2626', fontSize: '0.7rem', fontWeight: '800', border: '1px solid #fee2e2' }}>
                                                UNPAID
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td style={{ padding: '16px 24px' }}>
                                    {q.is_paid ? (
                                        <button 
                                            onClick={async () => {
                                                await supabase.from('appointment').update({ status: 'in_consultation' }).eq('appoid', q.appoid);
                                                navigate(`/doctor/consultation?appoid=${q.appoid}`);
                                            }} 
                                            style={{ background: '#2563eb', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <CheckCircle size={14} /> {q.status === 'in_consultation' ? 'Continue Session' : 'Start Session'}
                                        </button>
                                    ) : (
                                        <button 
                                            disabled
                                            style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#94a3b8', padding: '8px 16px', borderRadius: '8px', cursor: 'not-allowed', fontSize: '0.75rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Lock size={14} /> Locked
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DoctorAppointments;
