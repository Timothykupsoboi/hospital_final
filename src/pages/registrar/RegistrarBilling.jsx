import React, { useState, useEffect } from 'react';
import { CreditCard, Search, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import BillingGateModal from '../../components/registrar/BillingGateModal';

const RegistrarBilling = () => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showGateModal, setShowGateModal] = useState(false);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [currentTab, setCurrentTab] = useState('ongoing');

    useEffect(() => {
        fetchAppointments();
    }, []);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('appointment')
                .select('*, patient:pid(pname, patient_display_id)')
                .order('appodate', { ascending: false });
            
            if (error) {
                console.error("Error fetching appointments:", error.message);
                setAppointments([]);
            } else {
                setAppointments(data || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSettle = (appt) => {
        setSelectedAppointment(appt);
        setShowGateModal(true);
    };

    const filteredAppointments = appointments.filter(appt => {
        const matchesSearch = (appt.patient?.pname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                             (appt.patient?.patient_display_id || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const isOngoing = ['waiting', 'in_consultation', 'pending_lab', 'lab_processing', 'lab_results_partial', 'lab_completed'].includes(appt.status);
        const isDone = appt.status === 'completed';

        if (currentTab === 'ongoing') return matchesSearch && isOngoing;
        if (currentTab === 'done') return matchesSearch && isDone;
        return matchesSearch;
    });

    return (
        <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: '#3b82f6', color: 'white', padding: '10px', borderRadius: '12px' }}>
                            <CreditCard size={24} />
                        </div>
                        Centralized Billing Desk
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '1rem', marginTop: '8px' }}>Manage patient billing and track outstanding balances.</p>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <button 
                    onClick={() => setCurrentTab('ongoing')}
                    style={{ 
                        padding: '12px 24px', borderRadius: '12px', border: 'none', 
                        background: currentTab === 'ongoing' ? '#0f172a' : 'white', 
                        color: currentTab === 'ongoing' ? 'white' : '#64748b',
                        fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer',
                        boxShadow: currentTab === 'ongoing' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                        transition: '0.2s'
                    }}
                >
                    Currently Ongoing
                </button>
                <button 
                    onClick={() => setCurrentTab('done')}
                    style={{ 
                        padding: '12px 24px', borderRadius: '12px', border: 'none', 
                        background: currentTab === 'done' ? '#0f172a' : 'white', 
                        color: currentTab === 'done' ? 'white' : '#64748b',
                        fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer',
                        boxShadow: currentTab === 'done' ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                        transition: '0.2s'
                    }}
                >
                    Done
                </button>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '16px', alignItems: 'center', background: '#f8fafc' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                        <input 
                            type="text" 
                            placeholder="Search by patient name or ID..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px 10px 40px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                        />
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                        <tr>
                            <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.8rem', fontWeight: '800', color: '#475569' }}>APPT ID</th>
                            <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.8rem', fontWeight: '800', color: '#475569' }}>PATIENT</th>
                            <th style={{ padding: '16px 24px', textAlign: 'center', fontSize: '0.8rem', fontWeight: '800', color: '#475569' }}>STATUS</th>
                            <th style={{ padding: '16px 24px', textAlign: 'right', fontSize: '0.8rem', fontWeight: '800', color: '#475569' }}>ACTION</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Loading records...</td></tr>
                        ) : filteredAppointments.length === 0 ? (
                            <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>No patients found.</td></tr>
                        ) : filteredAppointments.map(appt => (
                            <tr key={appt.appoid} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '16px 24px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <FileText size={18} color="#94a3b8" />
                                        <span style={{ fontWeight: '800', color: '#0f172a' }}>APPT-{appt.appoid}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '30px' }}>{new Date(appt.appodate).toLocaleDateString()}</div>
                                </td>
                                <td style={{ padding: '16px 24px', fontWeight: '700', color: '#334155' }}>
                                    {appt.patient?.pname || 'Unknown'}
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {appt.patient?.patient_display_id}</div>
                                </td>
                                <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                    <span style={{
                                        padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800',
                                        background: '#fef3c7',
                                        color: '#b45309'
                                    }}>
                                        {appt.status}
                                    </span>
                                </td>
                                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                    <button 
                                        onClick={() => handleSettle(appt)} 
                                        style={{ 
                                            background: currentTab === 'done' ? '#0f172a' : '#3b82f6', 
                                            color: 'white', border: 'none', padding: '8px 16px', 
                                            borderRadius: '8px', fontWeight: '700', cursor: 'pointer' 
                                        }}
                                    >
                                        {currentTab === 'done' ? 'View Breakdown' : 'Make Payment'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showGateModal && selectedAppointment && (
                <BillingGateModal 
                    isOpen={showGateModal}
                    onClose={() => setShowGateModal(false)}
                    onUpdate={fetchAppointments}
                    patient={selectedAppointment.patient}
                    appointmentId={selectedAppointment.appoid}
                />
            )}
        </div>
    );
};

export default RegistrarBilling;