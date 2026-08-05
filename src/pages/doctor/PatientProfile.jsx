// =============================================================
// FILE: PatientProfile.jsx
// PURPOSE: React component / entry point for the eDoc Hospital
//          frontend. Part of the Vite + React SPA.
// =============================================================
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    User, Calendar, Clock, Clipboard, Pill, FlaskConical, 
    ChevronLeft, Mail, Phone, MapPin, Activity, FileText,
    ArrowLeft, Download, ShieldCheck, AlertCircle, CreditCard
} from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const PatientProfile = () => {
    const { id: pid } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedVisits, setExpandedVisits] = useState({});

    useEffect(() => {
        const fetchRecord = async () => {
            setLoading(true);
            try {
                // 1. Fetch Patient
                let patient = null;
                
                let query = supabase.from('patient').select('*');
                if (!isNaN(pid) && !pid.startsWith('PT-')) {
                    query = query.eq('pid', parseInt(pid));
                } else {
                    query = query.eq('patient_display_id', pid);
                }
                
                const { data: pData } = await query.maybeSingle();
                patient = pData;
                
                if (!patient) {
                    let altQuery = supabase.from('patients').select('*');
                    if (!isNaN(pid) && !pid.startsWith('PT-')) {
                        altQuery = altQuery.eq('pid', parseInt(pid));
                    } else {
                        altQuery = altQuery.eq('patient_display_id', pid);
                    }
                    const { data: altData } = await altQuery.maybeSingle();
                    patient = altData || null;
                }

                if (!patient) {
                    setLoading(false);
                    return;
                }

                // 2. Fetch Consultations
                let enrichedConsultations = [];
                const { data: consultationsData, error: consultError } = await supabase
                    .from('consultations')
                    .select('*')
                    .eq('pid', patient.pid)
                    .in('status', ['final', 'completed'])
                    .order('consultation_date', { ascending: false });
                
                if (consultError) throw consultError;

                if (consultationsData && consultationsData.length > 0) {
                    const docIds = [...new Set(consultationsData.map(c => c.docid))].filter(Boolean);
                    let doctors = [];
                    if (docIds.length > 0) {
                        const { data: dData } = await supabase
                            .from('doctor')
                            .select('docid, docname')
                            .in('docid', docIds);
                        doctors = dData || [];
                    }

                    const consultIds = consultationsData.map(c => c.id);
                    const [
                        { data: presData },
                        { data: vitData },
                        { data: reqData }
                    ] = await Promise.all([
                        supabase.from('prescriptions').select('*').in('consultation_id', consultIds),
                        supabase.from('vitals_records').select('*').in('consultation_id', consultIds),
                        supabase.from('lab_requests').select('id, pid').eq('pid', id)
                    ]);

                    let lab_reports = [];
                    if (reqData && reqData.length > 0) {
                        const reqIds = reqData.map(r => r.id);
                        const { data: lData } = await supabase.from('lab_reports').select('*').in('request_id', reqIds);
                        lab_reports = lData || [];
                        
                        const techIds = [...new Set(lab_reports.map(r => r.technician_id))].filter(Boolean);
                        let technicians = [];
                        if (techIds.length > 0) {
                            const { data: tData } = await supabase
                                .from('lab_technician')
                                .select('labid, labname')
                                .in('labid', techIds);
                            technicians = tData || [];
                        }
                        
                        lab_reports = lab_reports.map(r => ({
                            ...r,
                            technician_name: technicians.find(t => String(t.labid) === String(r.technician_id))?.labname || 'Unknown Technician'
                        }));
                    }

                    enrichedConsultations = consultationsData.map(c => {
                        const cReqIds = (reqData || []).filter(r => r.consultation_id === c.id).map(r => r.id);
                        return {
                            ...c,
                            doctor_name: doctors.find(d => String(d.docid) === String(c.docid))?.docname || 'Unknown Doctor',
                            prescriptions: (presData || []).filter(p => p.consultation_id === c.id),
                            lab_results: (lab_reports || []).filter(r => cReqIds.includes(r.request_id)),
                            vitals: (vitData || []).find(v => v.consultation_id === c.id) || null
                        };
                    });
                    
                    setExpandedVisits({ [consultationsData[0].id]: true });
                }

                setData({ patient, consultations: enrichedConsultations });

            } catch (err) {
                console.error("Failed to fetch medical record", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRecord();
    }, [pid]);

    const toggleVisit = (id) => {
        setExpandedVisits(prev => ({ ...prev, [id]: !prev[id] }));
    };

    if (loading) return (
        <div style={{ padding: '0', background: '#f8fafc', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #eff6ff', borderTopColor: '#2563eb', borderRadius: '50%' }}></div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } } .animate-spin { animation: spin 1s linear infinite; }`}</style>
        </div>
    );

    if (!data || !data.patient) return (
        <div style={{ padding: '40px', background: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <AlertCircle size={64} color="#f87171" style={{ marginBottom: '16px' }} />
            <h2 style={{ color: '#1e293b', fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px' }}>Patient Record Not Found</h2>
            <p style={{ color: '#64748b', textAlign: 'center', maxWidth: '400px' }}>No patient data found for this record. Please verify the ID.</p>
            <button onClick={() => navigate(-1)} style={{ marginTop: '24px', padding: '12px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}>
                Go Back
            </button>
        </div>
    );

    const { patient, consultations } = data;

    return (
        <div style={{ padding: '0', background: '#f1f5f9', minHeight: '100vh' }}>
                {/* Header / Actions */}
                <header style={{ 
                    padding: '24px 40px', background: 'white', borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button onClick={() => navigate(-1)} style={{ padding: '8px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}>
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Clinical Dossier</h1>
                            <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Comprehensive Medical History Archive</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Download size={16} /> Export EMR
                        </button>
                    </div>
                </header>

                <div style={{ display: 'flex', minHeight: 'calc(100vh - 90px)' }}>
                    {/* Left Panel: Comprehensive Patient Dossier Card */}
                    <aside style={{ width: '400px', background: 'white', borderRight: '1px solid #e2e8f0', padding: '32px', overflowY: 'auto' }}>
                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <div style={{ 
                                width: '100px', height: '100px', borderRadius: '30px', background: '#eff6ff', 
                                margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#2563eb', fontSize: '2.5rem', fontWeight: '800', border: '4px solid #f8fafc'
                            }}>
                                {patient?.pname?.charAt(0) || 'P'}
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>{patient?.pname || 'Anonymous Patient'}</h2>
                            <span style={{ padding: '4px 12px', background: '#f1f5f9', borderRadius: '100px', fontSize: '0.75rem', fontWeight: '800', color: '#2563eb' }}>
                                {patient.patient_display_id}
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Vital Stats Section */}
                            <section>
                                <h4 style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>Vital Statistics</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700' }}>AGE</div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#1e293b' }}>{patient.pdob ? new Date().getFullYear() - new Date(patient.pdob).getFullYear() : '--'} Yrs</div>
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700' }}>GENDER</div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#1e293b' }}>{patient.pgender}</div>
                                    </div>
                                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: '700' }}>BLOOD GROUP</div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#ef4444' }}>{patient.pbloodgroup || '--'}</div>
                                    </div>
                                </div>
                            </section>

                            {/* Contact Details */}
                            <section>
                                <h4 style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>Administrative Data</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                                        <Phone size={14} color="#94a3b8" /> <span style={{ color: '#334155', fontWeight: '600' }}>{patient.ptel}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                                        <Mail size={14} color="#94a3b8" /> <span style={{ color: '#334155', fontWeight: '600' }}>{patient.pemail || 'No email registered'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                                        <MapPin size={14} color="#94a3b8" style={{ marginTop: '3px' }} /> <span style={{ color: '#334155', fontWeight: '600' }}>{patient.paddress}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                                        <User size={14} color="#94a3b8" /> <span style={{ color: '#334155', fontWeight: '600' }}>Registered By: {patient.created_by || 'N/A'}</span>
                                    </div>
                                </div>
                            </section>

                            {/* Clinical Alerts */}
                            <section>
                                <h4 style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: '800', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Activity size={16} /> CLINICAL ALERTS
                                </h4>
                                <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '16px' }}>
                                    <div style={{ fontSize: '0.65rem', color: '#991b1b', fontWeight: '800', marginBottom: '4px' }}>KNOWN ALLERGIES</div>
                                    <div style={{ fontSize: '0.85rem', color: '#991b1b', fontWeight: '700' }}>{patient.pallergies || 'NKDA (No Known Drug Allergies)'}</div>
                                </div>
                            </section>
                        </div>
                    </aside>

                    {/* Right Panel: Visit Timeline */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
                        <div style={{ maxWidth: '950px', margin: '0 auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>Clinical Timeline ({consultations.length} Visits)</h3>
                                <div style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: '600' }}>Chronological Archives</div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                {consultations.map((c) => (
                                    <div key={c.id} style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                        {/* Visit Header */}
                                        <div 
                                            onClick={() => toggleVisit(c.id)}
                                            style={{ padding: '24px 32px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: expandedVisits[c.id] ? '#f8fafc' : 'white', transition: '0.2s' }}
                                        >
                                            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                                                <div style={{ textAlign: 'center', minWidth: '60px' }}>
                                                    <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a' }}>{c.consultation_date ? new Date(c.consultation_date).getDate() : '--'}</div>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>{c.consultation_date ? new Date(c.consultation_date).toLocaleString('default', { month: 'short' }) : '---'}</div>
                                                </div>
                                                <div style={{ width: '2px', height: '40px', background: '#e2e8f0' }} />
                                                <div>
                                                    <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '1.1rem' }}>{c.diagnosis || 'General Consultation'}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                        <User size={14} /> Seen by Dr. {c.doctor_name} • <Clock size={14} /> {c.consultation_date ? new Date(c.consultation_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                                <span style={{ padding: '8px 16px', background: '#eff6ff', color: '#2563eb', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '800', letterSpacing: '0.5px' }}>
                                                    {c.consultation_type || 'OUTPATIENT'}
                                                </span>
                                                <ChevronLeft size={22} color="#94a3b8" style={{ transform: expandedVisits[c.id] ? 'rotate(-90deg)' : 'rotate(180deg)', transition: '0.3s' }} />
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {expandedVisits[c.id] && (
                                            <div style={{ padding: '40px', borderTop: '1px solid #f1f5f9' }}>
                                                
                                                {/* Vitals Snapshot */}
                                                <div style={{ marginBottom: '40px' }}>
                                                    <h4 style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Activity size={16} /> Clinical Vitals Signs
                                                    </h4>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', padding: '24px', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                                                        {[
                                                            { label: 'Temp', value: c.vitals?.temp ? `${c.vitals.temp}°C` : '--', color: '#ef4444' },
                                                            { label: 'BP', value: c.vitals?.bp || '--', color: '#1e293b' },
                                                            { label: 'HR', value: c.vitals?.heart_rate ? `${c.vitals.heart_rate} bpm` : '--', color: '#1e293b' },
                                                            { label: 'SPO2', value: c.vitals?.spo2 ? `${c.vitals.spo2}%` : '--', color: '#2563eb' },
                                                            { label: 'Weight', value: c.vitals?.weight ? `${c.vitals.weight} kg` : '--', color: '#1e293b' },
                                                            { label: 'Height', value: c.vitals?.height ? `${c.vitals.height} cm` : '--', color: '#1e293b' },
                                                            { label: 'BMI', value: c.vitals?.bmi || '--', color: '#10b981' },
                                                        ].map((v, i) => (
                                                            <div key={i} style={{ textAlign: 'center', padding: '12px', border: '1px solid #eff6ff', borderRadius: '16px', background: 'white' }}>
                                                                <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: '800', marginBottom: '6px', textTransform: 'uppercase' }}>{v.label}</div>
                                                                <div style={{ fontSize: '1.1rem', fontWeight: '800', color: v.color }}>{v.value}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '40px' }}>
                                                    {/* Subjective Section */}
                                                    <div style={{ background: '#f8fafc', padding: '32px', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                                                        <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <Clipboard size={18} color="#3b82f6" /> SUBJECTIVE FINDINGS
                                                        </h4>
                                                        <div style={{ fontSize: '0.9rem', color: '#334155', lineHeight: '1.6', background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #eff6ff' }}>
                                                            {c.hpi || 'No clinical notes recorded.'}
                                                        </div>
                                                    </div>

                                                    {/* Assessment Section */}
                                                    <div style={{ background: '#fffbeb', padding: '32px', borderRadius: '24px', border: '1px solid #fef3c7' }}>
                                                        <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#92400e', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <FileText size={18} color="#f59e0b" /> ASSESSMENT
                                                        </h4>
                                                        <div style={{ background: 'white', padding: '20px', borderRadius: '20px', border: '1px solid #fef3c7' }}>
                                                            <div style={{ fontSize: '0.65rem', color: '#b45309', fontWeight: '800', marginBottom: '6px', textTransform: 'uppercase' }}>Primary Diagnosis</div>
                                                            <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>{c.diagnosis || 'Clinical Review'}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Orders Section */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                                    {/* RX */}
                                                    <div>
                                                        <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <Pill size={18} color="#2563eb" /> PRESCRIPTIONS (RX)
                                                        </h4>
                                                        <div style={{ background: 'white', border: '1px solid #f1f5f9', borderRadius: '24px', overflow: 'hidden' }}>
                                                            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                                                <thead style={{ background: '#f8fafc' }}>
                                                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #f1f5f9' }}>
                                                                        <th style={{ padding: '16px 24px' }}>Medication</th>
                                                                        <th style={{ padding: '16px 24px' }}>Regimen</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {c.prescriptions && c.prescriptions.length > 0 ? c.prescriptions.map((rx, i) => (
                                                                        <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                                            <td style={{ padding: '16px 24px', fontWeight: '700' }}>{rx.drug_name}</td>
                                                                            <td style={{ padding: '16px 24px' }}>{rx.dosage} • {rx.frequency || rx.instructions}</td>
                                                                        </tr>
                                                                    )) : (
                                                                        <tr>
                                                                            <td colSpan="2" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>No medications.</td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    {/* Labs */}
                                                    <div>
                                                        <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#1e293b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <FlaskConical size={18} color="#059669" /> LAB RESULTS
                                                        </h4>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                            {c.lab_results && c.lab_results.length > 0 ? c.lab_results.map((res, i) => (
                                                                <div key={i} style={{ background: 'white', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                                                    <div style={{ fontWeight: '800', color: '#1e293b' }}>{res.test_name}</div>
                                                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>Status: Verified • Done by: {res.technician_name || 'Unknown'}</div>
                                                                </div>
                                                            )) : (
                                                                <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>No lab records.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
        </div>
    );
};

export default PatientProfile;
