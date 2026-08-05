// =============================================================
// FILE: RegistrarPrint.jsx
// PURPOSE: React component / entry point for the eDoc Hospital
//          frontend. Part of the Vite + React SPA.
// =============================================================
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Calendar, Search, Users, Clock, Printer } from 'lucide-react';
import './RegistrarPrint.css';

const RegistrarPrint = () => {
    const [patients, setPatients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('forms');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [historyData, setHistoryData] = useState(null);
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('patient')
                .select('*')
                .order('pname', { ascending: true });
            if (error) throw error;
            setPatients(data || []);
        } catch (err) {
            console.error('Error fetching patients', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async (pid) => {
        try {
            setLoading(true);
            // 1. Get patient info
            const { data: patient } = await supabase
                .from('patient')
                .select('*')
                .eq('pid', pid)
                .single();

            // 2. Get appointments and consultations for timeline
            const [apptRes, consultRes] = await Promise.all([
                supabase.from('appointment').select('appodate, status, doctor:docid(docname)').eq('pid', pid),
                supabase.from('consultations').select('created_at, clinical_impression, doctor:docid(docname)').eq('pid', pid)
            ]);

            const events = [];
            (apptRes.data || []).forEach(a => {
                events.push({
                    event_date: a.appodate,
                    type: 'APPOINTMENT',
                    provider: a.doctor?.docname || 'Staff',
                    detail: `Status: ${a.status}`
                });
            });
            (consultRes.data || []).forEach(c => {
                events.push({
                    event_date: c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : 'N/A',
                    type: 'CONSULTATION',
                    provider: c.doctor?.docname || 'Staff',
                    detail: c.clinical_impression || 'Clinical visit'
                });
            });

            setHistoryData({
                patient,
                events: events.sort((a, b) => new Date(b.event_date) - new Date(a.event_date))
            });
            setActiveTab('history');
        } catch (err) {
            console.error('Error fetching history', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = (patient) => {
        setSelectedPatient(patient);
        setTimeout(() => window.print(), 800);
    };

    const filtered = (patients || []).filter(p =>
        p.pname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.patient_display_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ padding: '40px 56px', maxWidth: '1600px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
                {/* Header */}
                <header className="no-print" style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ fontSize: '36px', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.04em', margin: 0 }}>
                            Clinical <span style={{ color: '#0891b2' }}>Archives</span> &amp; Forms
                        </h1>
                        <p style={{ color: '#475569', fontSize: '16px', marginTop: '6px', fontWeight: '600' }}>
                            Professional Registry Terminal • Institutional Grade Printing
                        </p>
                    </div>
                    <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', borderRadius: '20px', border: '1px solid white', boxShadow: '0 10px 20px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#06b6d4', boxShadow: '0 0 15px #06b6d4' }} />
                        <span style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', letterSpacing: '0.05em' }}>ARCHIVE SERVER ONLINE</span>
                    </div>
                </header>

                {/* Action Hub */}
                <div className="no-print" style={{ background: 'white', padding: '30px', borderRadius: '30px', marginBottom: '40px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', gap: '15px', marginBottom: '24px' }}>
                        {['forms', 'reports'].map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '14px 28px', borderRadius: '14px', border: 'none', background: activeTab === tab ? '#0891b2' : '#f8fafc', color: activeTab === tab ? 'white' : '#64748b', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {tab === 'forms' ? <FileText size={18} /> : <Calendar size={18} />}
                                {tab === 'forms' ? 'Registry Dossiers' : 'Daily Archives'}
                            </button>
                        ))}
                    </div>
                    <div style={{ position: 'relative' }}>
                        <Search color="#0891b2" size={22} style={{ position: 'absolute', left: '22px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="Search by Name or Patient ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '18px 20px 18px 60px', borderRadius: '16px', border: '1px solid #e2e8f0', background: 'white', fontSize: '16px', fontWeight: '600', color: '#1e293b' }}
                        />
                    </div>
                </div>

                {/* Patient Grid */}
                {activeTab === 'forms' && (
                    <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                        {filtered.length === 0 && (
                            <p style={{ color: '#94a3b8', fontWeight: '600', gridColumn: '1/-1', textAlign: 'center', padding: '60px' }}>No patients found.</p>
                        )}
                        {filtered.map(p => (
                            <div key={p.pid} style={{ background: 'white', padding: '28px', borderRadius: '24px', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '5px', height: '100%', background: '#06b6d4' }} />
                                <span style={{ fontSize: '11px', fontWeight: '900', color: '#0891b2', background: '#ecfeff', padding: '4px 10px', borderRadius: '6px' }}>{p.patient_display_id}</span>
                                <h3 style={{ fontSize: '19px', fontWeight: '900', color: '#0f172a', margin: '10px 0 4px' }}>{p.pname}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '13px', fontWeight: '600', marginBottom: '20px' }}>
                                    <Users size={13} /> {p.pgender} • {p.pbloodgroup || 'Group TBD'}
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => fetchHistory(p.pid)} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#0891b2', cursor: 'pointer', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        <Clock size={15} /> ARCHIVE
                                    </button>
                                    <button onClick={() => handlePrint(p)} style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: '#0f172a', color: 'white', cursor: 'pointer', fontWeight: '800', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                        <Printer size={15} /> PRINT
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── DOCUMENT PREVIEW MODAL ── */}
                {selectedPatient && (
                    <div style={{ 
                        position: 'fixed', inset: 0, zIndex: 5000, 
                        background: 'rgba(15, 23, 42, 0.95)', 
                        backdropFilter: 'blur(10px)',
                        display: 'flex', flexDirection: 'column',
                        animation: 'fadeIn 0.3s ease'
                    }}>
                        {/* Preview Control Bar */}
                        <div className="no-print" style={{ 
                            padding: '16px 40px', background: 'white', borderBottom: '1px solid #e2e8f0', 
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <FileText size={18} color="white" />
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '1rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Document Preview</h2>
                                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Reviewing Dossier for {selectedPatient.pname}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setSelectedPatient(null)} style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', fontWeight: '700', cursor: 'pointer', color: '#64748b' }}>Close Preview</button>
                                <button onClick={() => window.print()} style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', background: '#0891b2', color: 'white', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Printer size={18} /> Send to Printer
                                </button>
                            </div>
                        </div>

                        {/* Paper Preview Area */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>
                            {/* PAGE 1 */}
                            <div className="printable-page" style={{ 
                                width: '210mm', minHeight: '297mm', background: 'white', padding: '60px 80px', 
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', borderRadius: '2px', position: 'relative' 
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '40px', marginBottom: '60px' }}>
                                    <div style={{ width: '160px', height: '160px', borderRadius: '24px', background: '#f8fafc', padding: '4px', border: '2px dashed #cbd5e1', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {selectedPatient.pphoto
                                            ? <img src={selectedPatient.pphoto} alt="Patient" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '20px' }} />
                                            : <Users size={60} color="#cbd5e1" />}
                                    </div>
                                    <div>
                                        <h1 style={{ fontSize: '42px', fontWeight: '900', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Patient Enrollment</h1>
                                        <p style={{ color: '#64748b', margin: '8px 0', fontSize: '18px', fontWeight: '500' }}>Part 1 of 2 — Primary Identity & Physiological Baseline</p>
                                        <div style={{ marginTop: '16px', padding: '8px 16px', background: '#f1f5f9', borderRadius: '8px', display: 'inline-block', fontSize: '14px', fontWeight: '900', color: '#0891b2', border: '1px solid #e2e8f0' }}>
                                            SYSTEM ID: {selectedPatient.patient_display_id}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '60px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '900', borderBottom: '3px solid #0f172a', paddingBottom: '12px', marginBottom: '32px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Basic Identity & Residency</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
                                        <div><label style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>First Name</label><div style={{ fontSize: '18px', fontWeight: '700', padding: '12px 0', borderBottom: '1px solid #f1f5f9', color: '#1e293b' }}>{selectedPatient.pname?.split(' ')[0] || '—'}</div></div>
                                        <div><label style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>Last Name</label><div style={{ fontSize: '18px', fontWeight: '700', padding: '12px 0', borderBottom: '1px solid #f1f5f9', color: '#1e293b' }}>{selectedPatient.pname?.split(' ').slice(1).join(' ') || '—'}</div></div>
                                        <div><label style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>Date of Birth</label><div style={{ fontSize: '18px', fontWeight: '700', padding: '12px 0', borderBottom: '1px solid #f1f5f9', color: '#1e293b' }}>{selectedPatient.pdob || '—'}</div></div>
                                        <div><label style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>Gender</label><div style={{ fontSize: '18px', fontWeight: '700', padding: '12px 0', borderBottom: '1px solid #f1f5f9', color: '#1e293b' }}>{selectedPatient.pgender || '—'}</div></div>
                                        <div><label style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>Contact Phone</label><div style={{ fontSize: '18px', fontWeight: '700', padding: '12px 0', borderBottom: '1px solid #f1f5f9', color: '#1e293b' }}>{selectedPatient.ptel || '—'}</div></div>
                                        <div><label style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>Email Address</label><div style={{ fontSize: '18px', fontWeight: '700', padding: '12px 0', borderBottom: '1px solid #f1f5f9', color: '#1e293b' }}>{selectedPatient.pemail || '—'}</div></div>
                                        <div style={{ gridColumn: 'span 2' }}><label style={{ fontSize: '10px', fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase' }}>Residential Physical Address</label><div style={{ fontSize: '16px', fontWeight: '700', padding: '12px 0', borderBottom: '1px solid #f1f5f9', minHeight: '44px', color: '#1e293b' }}>{selectedPatient.paddress || '—'}</div></div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '60px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '900', borderBottom: '3px solid #0f172a', paddingBottom: '12px', marginBottom: '32px', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Physiological Baseline (Initial Vitals)</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '20px' }}>
                                        {[
                                            { label: 'TEMPERATURE', value: selectedPatient.ptemp ? `${selectedPatient.ptemp}°C` : '--°C' },
                                            { label: 'BLOOD PRESSURE', value: selectedPatient.pbp || '--/--' },
                                            { label: 'WEIGHT', value: selectedPatient.pweight ? `${selectedPatient.pweight} KG` : '-- KG' },
                                            { label: 'HEIGHT', value: selectedPatient.pheight ? `${selectedPatient.pheight} CM` : '-- CM' },
                                        ].map(v => (
                                            <div key={v.label} style={{ padding: '24px 16px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                                <div style={{ fontSize: '10px', fontWeight: '900', color: '#64748b', marginBottom: '8px' }}>{v.label}</div>
                                                <div style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a' }}>{v.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', bottom: '60px', left: 0, right: 0, textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>
                                    Clinical record for {selectedPatient.pname} • Page 1 of 2 • Generated on {new Date().toLocaleDateString()}
                                </div>
                            </div>

                            {/* PAGE 2 */}
                            <div className="printable-page" style={{ 
                                width: '210mm', minHeight: '297mm', background: 'white', padding: '80px', 
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', borderRadius: '2px', position: 'relative' 
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '5px solid #0f172a', paddingBottom: '20px', marginBottom: '48px' }}>
                                    <div>
                                        <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>PART 2: CLINICAL DEPTH & ADMIN</h2>
                                        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0', fontWeight: '600' }}>CASE REF: {selectedPatient.patient_display_id}</p>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '48px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '900', borderBottom: '3px solid #0f172a', paddingBottom: '12px', marginBottom: '24px', color: '#0f172a', textTransform: 'uppercase' }}>3. Clinical Summary</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                                        <div style={{ padding: '24px', background: '#f0fdf4', borderRadius: '16px', border: '1px solid #bbf7d0' }}>
                                            <div style={{ fontSize: '10px', fontWeight: '900', color: '#166534', letterSpacing: '0.05em' }}>BLOOD GROUP</div>
                                            <div style={{ fontSize: '32px', fontWeight: '900', color: '#14532d', marginTop: '12px' }}>{selectedPatient.pbloodgroup || 'N/A'}</div>
                                        </div>
                                        <div style={{ padding: '24px', background: '#fef2f2', borderRadius: '16px', border: '1px solid #fecaca' }}>
                                            <div style={{ fontSize: '10px', fontWeight: '900', color: '#991b1b', letterSpacing: '0.05em' }}>IDENTIFIED ALLERGIES</div>
                                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#7f1d1d', marginTop: '12px', lineHeight: '1.5' }}>{selectedPatient.pallergies || 'NO KNOWN ALLERGIES DISCLOSED'}</div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '48px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '900', borderBottom: '3px solid #0f172a', paddingBottom: '12px', marginBottom: '24px', color: '#0f172a', textTransform: 'uppercase' }}>4. History & Chronic Observations</h3>
                                    <div style={{ padding: '30px', border: '2px solid #f1f5f9', borderRadius: '16px', minHeight: '140px', fontSize: '16px', lineHeight: '1.8', color: '#1e293b', background: '#fcfdfe' }}>
                                        {selectedPatient.pconditions || 'No significant medical history or chronic conditions recorded at the time of intake.'}
                                    </div>
                                </div>
                                <div style={{ marginBottom: '60px' }}>
                                    <h3 style={{ fontSize: '14px', fontWeight: '900', borderBottom: '3px solid #0f172a', paddingBottom: '12px', marginBottom: '24px', color: '#0f172a', textTransform: 'uppercase' }}>5. Admin & Emergency Security</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                        <div style={{ padding: '24px', background: '#f5f3ff', borderRadius: '16px', border: '1px solid #ddd6fe' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '900', color: '#5b21b6', marginBottom: '16px', textTransform: 'uppercase' }}>Payment & Coverage</div>
                                            <p style={{ fontSize: '14px', margin: '8px 0', color: '#1e293b' }}><strong>Method:</strong> {selectedPatient.ppayment || 'Cash/Private'}</p>
                                            <p style={{ fontSize: '14px', margin: '8px 0', color: '#1e293b' }}><strong>Provider:</strong> {selectedPatient.pinsurance_provider || 'N/A'}</p>
                                            <p style={{ fontSize: '14px', margin: '8px 0', color: '#1e293b' }}><strong>Policy #:</strong> {selectedPatient.pinsurance_number || 'N/A'}</p>
                                        </div>
                                        <div style={{ padding: '24px', background: '#fffbeb', borderRadius: '16px', border: '1px solid #fde68a' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '900', color: '#b45309', marginBottom: '16px', textTransform: 'uppercase' }}>Next of Kin</div>
                                            <p style={{ fontSize: '14px', margin: '8px 0', color: '#1e293b' }}><strong>Name:</strong> {selectedPatient.pemergency_name || '—'}</p>
                                            <p style={{ fontSize: '14px', margin: '8px 0', color: '#1e293b' }}><strong>Phone:</strong> {selectedPatient.pemergency_phone || '—'}</p>
                                            <p style={{ fontSize: '14px', margin: '8px 0', color: '#1e293b' }}><strong>Relation:</strong> {selectedPatient.pemergency_relation || '—'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ borderTop: '4px solid #0f172a', paddingTop: '40px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '60px', marginTop: '60px' }}>
                                    <div>
                                        <h4 style={{ fontWeight: '900', marginBottom: '12px', fontSize: '16px' }}>Official Clinical Declaration</h4>
                                        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>This electronic health record constitutes an official medical document of the institution. All data is verified per standard intake protocols and certified accurate for clinical use.</p>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ height: '60px' }} />
                                        <div style={{ borderTop: '2px solid #0f172a', paddingTop: '10px', fontSize: '14px', fontWeight: '800' }}>Registrar: {profile?.regname || profile?.docname || 'ADMINISTRATOR'}</div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Authorized Digital Signature</div>
                                        <div style={{ border: '2px solid #cbd5e1', color: '#cbd5e1', padding: '12px', marginTop: '32px', fontSize: '12px', fontWeight: '900', borderRadius: '8px', textTransform: 'uppercase', letterSpacing: '0.2em' }}>Institutional Stamp Area</div>
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', bottom: '60px', left: 0, right: 0, textAlign: 'center', fontSize: '12px', color: '#94a3b8', fontWeight: '600' }}>
                                    REF: {selectedPatient.patient_display_id} • Page 2 of 2 • Certified Document
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MASTER ARCHIVE (History Print) */}
                {historyData && (
                    <div className="print-only" style={{ display: 'none' }}>
                        <div style={{ padding: '60px', background: 'white' }}>
                            <div style={{ borderBottom: '4px solid #000', paddingBottom: '16px', marginBottom: '30px', textAlign: 'center' }}>
                                <h1 style={{ fontSize: '30px', fontWeight: '900', margin: 0 }}>PATIENT MASTER CASE FILE</h1>
                                <p style={{ fontWeight: '600', color: '#333' }}>Longitudinal Clinical Record</p>
                            </div>
                            <div style={{ display: 'flex', gap: '30px', marginBottom: '36px', padding: '20px', border: '2px solid #000' }}>
                                <div style={{ width: '110px', height: '130px', border: '1px solid #000', overflow: 'hidden', flexShrink: 0 }}>
                                    {historyData.patient?.pphoto && <img src={historyData.patient.pphoto} alt="P" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                </div>
                                <div>
                                    <h2 style={{ fontSize: '22px', fontWeight: '900' }}>{historyData.patient?.pname}</h2>
                                    <p>ID: {historyData.patient?.patient_display_id}</p>
                                    <p>DOB: {historyData.patient?.pdob} &nbsp;|&nbsp; Gender: {historyData.patient?.pgender}</p>
                                    <p>Phone: {historyData.patient?.ptel}</p>
                                </div>
                            </div>
                            <h3 style={{ background: '#000', color: '#fff', padding: '10px 20px', marginBottom: '20px' }}>CLINICAL EVENT TIMELINE</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #000' }}>
                                        <th style={{ textAlign: 'left', padding: '10px' }}>Date</th>
                                        <th style={{ textAlign: 'left', padding: '10px' }}>Type</th>
                                        <th style={{ textAlign: 'left', padding: '10px' }}>Provider</th>
                                        <th style={{ textAlign: 'left', padding: '10px' }}>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historyData.events?.map((e, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #ccc' }}>
                                            <td style={{ padding: '10px' }}>{e.event_date}</td>
                                            <td style={{ padding: '10px', fontWeight: '800', textTransform: 'uppercase' }}>{e.type}</td>
                                            <td style={{ padding: '10px' }}>{e.provider}</td>
                                            <td style={{ padding: '10px' }}>{e.detail}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ marginTop: '60px', borderTop: '2px solid #000', paddingTop: '16px', textAlign: 'center', fontSize: '12px' }}>
                                Generated by Moonview Clinical System — {new Date().toLocaleString()}
                            </div>
                        </div>
                    </div>
                )}
        </div>
    );
};

export default RegistrarPrint;
