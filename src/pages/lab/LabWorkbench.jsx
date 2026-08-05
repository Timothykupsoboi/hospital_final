// =============================================================
// FILE: LabWorkbench.jsx
// PURPOSE: React component for the Laboratory Analysis Workbench.
//          Handles specimen processing, result entry, and reporting.
//          Uses schema-compliant queries and joins.
// =============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { Microscope, Search, Droplets, Activity, FileText, CheckCircle, AlertTriangle, Send, X, Clock, User, Users, Loader, Trash2, RefreshCw, Lock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import NotificationCenter from '../../components/NotificationCenter';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const RESULT_TEMPLATES = {
// ... (templates remain same)
    'Full Blood Count': [
        { field: 'Haemoglobin (Hb)', unit: 'g/dL', ref: '12.0 – 17.5' },
        { field: 'WBC Count', unit: 'x10³/µL', ref: '4.0 – 11.0' },
        { field: 'Platelets', unit: 'x10³/µL', ref: '150 – 400' },
        { field: 'PCV/Haematocrit', unit: '%', ref: '36 – 52' },
        { field: 'MCV', unit: 'fL', ref: '80 – 100' },
    ],
    'Lipid Profile': [
        { field: 'Total Cholesterol', unit: 'mg/dL', ref: '< 200' },
        { field: 'LDL Cholesterol', unit: 'mg/dL', ref: '< 130' },
        { field: 'HDL Cholesterol', unit: 'mg/dL', ref: '> 40' },
        { field: 'Triglycerides', unit: 'mg/dL', ref: '< 150' },
    ],
    'Urinalysis': [
        { field: 'Appearance', unit: '', ref: 'Clear' },
        { field: 'pH', unit: '', ref: '4.5 – 8.0' },
        { field: 'Protein', unit: '', ref: 'Negative' },
        { field: 'Glucose', unit: '', ref: 'Negative' },
        { field: 'Blood', unit: '', ref: 'Negative' },
        { field: 'Leucocytes', unit: '/HPF', ref: '0 – 5' },
    ],
    'Blood Sugar': [
        { field: 'Blood Sugar Level', unit: 'mg/dL', ref: '70 – 140' },
    ],
    'Malaria': [
        { field: 'Malaria Parasites (MPS)', unit: '', ref: 'Not Seen' },
    ],
    'HIV': [
        { field: 'HIV 1/2 Antibody', unit: '', ref: 'Non-Reactive' },
    ],
    'Pregnancy': [
        { field: 'HCG (Urine)', unit: '', ref: 'Negative' },
    ],
    'Liver Function Test': [
        { field: 'ALT (SGPT)', unit: 'U/L', ref: '7 – 56' },
        { field: 'AST (SGOT)', unit: 'U/L', ref: '10 – 40' },
        { field: 'ALP', unit: 'U/L', ref: '44 – 147' },
        { field: 'Total Bilirubin', unit: 'mg/dL', ref: '0.2 – 1.2' },
        { field: 'Albumin', unit: 'g/dL', ref: '3.5 – 5.0' },
    ],
    'Renal Function Test': [
        { field: 'Serum Creatinine', unit: 'mg/dL', ref: '0.6 – 1.2' },
        { field: 'BUN', unit: 'mg/dL', ref: '7 – 20' },
        { field: 'Uric Acid', unit: 'mg/dL', ref: '2.4 – 7.0' },
        { field: 'eGFR', unit: 'mL/min', ref: '> 60' },
    ],
};

const getDefaultFields = (testType, catalog = []) => {
    const catalogTest = catalog.find(t => t.test_name.toLowerCase() === testType.toLowerCase());
    if (catalogTest && catalogTest.ref_ranges) {
        try {
            const fields = JSON.parse(catalogTest.ref_ranges);
            if (Array.isArray(fields)) return fields;
        } catch (e) {
            console.error("Failed to parse ref_ranges for", testType, e);
        }
    }
    for (const key of Object.keys(RESULT_TEMPLATES)) {
        if (testType && testType.toLowerCase().includes(key.toLowerCase())) return RESULT_TEMPLATES[key];
    }
    return [{ field: 'Result', unit: '', ref: 'As per reference' }, { field: 'Interpretation', unit: '', ref: '' }];
};

const getStatusStyle = (status) => {
    switch (status) {
        case 'pending': return { background: '#fef3c7', color: '#b45309' };
        case 'processing': return { background: '#f5f3ff', color: '#7c3aed' }; // Purple for active
        case 'sample_collected': return { background: '#e0f2fe', color: '#0369a1' };
        case 'results_entered': return { background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' };
        case 'sample_rejected': return { background: '#fef2f2', color: '#ef4444' };
        case 'completed': return { background: '#ecfdf5', color: '#059669' };
        default: return { background: '#f1f5f9', color: '#475569' };
    }
};

const statusLabel = (s) => {
    const map = { 
        pending: 'Waiting for Sample', 
        processing: 'In Progress / Session Started', 
        sample_collected: 'Sample Collected', 
        results_entered: 'Results Ready (Not Sent)',
        sample_rejected: 'Sample Rejected', 
        completed: 'Completed & Sent' 
    };
    return map[s] || s;
};

export default function LabWorkbench() {
    const { profile } = useAuth();
    const [searchParams] = useSearchParams();
    const urlAppoid = searchParams.get('appoid');
    const [requests, setRequests] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [resultValues, setResultValues] = useState({});
    const [notes, setNotes] = useState('');
    const [verified, setVerified] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [technicians, setTechnicians] = useState([]);
    const [selectedTech, setSelectedTech] = useState(null);
    const [customFields, setCustomFields] = useState([]); // Track field names being edited
    const [currentTab, setCurrentTab] = useState('Active'); // 'Active', 'Partial'

    // Deep Link Effect
    useEffect(() => {
        if (!loading && urlAppoid && requests.length > 0) {
            const req = requests.find(r => String(r.appointment_id) === String(urlAppoid));
            if (req) {
                // If it's a "Partial" or "Completed" request, maybe we should switch tabs?
                // For now, just open the panel if it exists in the raw requests.
                openPanel(req);
            }
        }
    }, [urlAppoid, requests.length, loading]);

    // Grouping Logic: Patient Centric
    const groupedRequests = requests.reduce((acc, req) => {
        const key = req.appointment_id || req.pid;
        if (!acc[key]) acc[key] = [];
        acc[key].push(req);
        return acc;
    }, {});

    // Tab Filtering Logic
    const tabData = { Active: {}, Pending: {}, Collected: {}, Partial: {} };
    Object.entries(groupedRequests).forEach(([appoid, group]) => {
        const allCompleted = group.every(r => r.status === 'completed');
        if (allCompleted) return;

        // Base categorization
        const anyPartial = group.some(r => r.status === 'completed' || r.status === 'results_entered');
        if (anyPartial) tabData.Partial[appoid] = group;
        else tabData.Active[appoid] = group;

        // Specific status sub-tabs
        if (group.some(r => r.status === 'pending')) tabData.Pending[appoid] = group;
        if (group.some(r => r.status === 'sample_collected')) tabData.Collected[appoid] = group;
    });

    const displayedGroups = Object.entries(tabData[currentTab]).reduce((acc, [appoid, group]) => {
        const matchesSearch = !search || group.some(r => 
            r.pname?.toLowerCase().includes(search.toLowerCase()) || 
            r.test_name?.toLowerCase().includes(search.toLowerCase())
        );
        if (matchesSearch) acc[appoid] = group;
        return acc;
    }, {});

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchRequests = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Pruned select to only existing columns
            // 1. Fetch raw lab requests
            const { data: rawData, error: labError } = await supabase
                .from('lab_requests')
                .select('id, test_name, status, created_at, appointment_id, pid, docid, test_id, category')
                .in('status', ['pending', 'processing', 'sample_collected', 'results_entered', 'sample_rejected', 'completed'])
                .order('created_at', { ascending: false });

            if (labError) throw labError;

            // 2. Fetch related details manually
            const appoids = [...new Set((rawData || []).map(r => r.appointment_id).filter(Boolean))];
            let appos = [];
            if (appoids.length > 0) {
                const { data: appoData, error: appoError } = await supabase
                    .from('appointment')
                    .select(`
                        appoid, 
                        appodate,
                        patient:pid(pid, pname, ptel, pdob, pgender),
                        doctor:docid(docname, docemail)
                    `)
                    .in('appoid', appoids);
                if (appoError) console.warn("Appointment fetch failed", appoError);
                else appos = appoData || [];
            }

            // 3. Fetch technicians manually for mapping
            const { data: techData } = await supabase
                .from('lab_technician')
                .select('labid, labname');
            const techMap = (techData || []).reduce((acc, t) => {
                acc[t.labid] = t.labname;
                return acc;
            }, {});

            const mapped = (rawData || []).map(r => {
                const appo = appos.find(a => a.appoid === r.appointment_id);
                return {
                    ...r,
                    appointment: appo,
                    patient_id: appo?.patient?.pid,
                    pname: appo?.patient?.pname || 'Unknown',
                    pgender: appo?.patient?.pgender || 'Unknown',
                    ptel: appo?.patient?.ptel || '',
                    pdob: appo?.patient?.pdob || '',
                    docname: appo?.doctor?.docname || 'Clinical Staff',
                    docemail: appo?.doctor?.docemail || '',
                    consultation_date: appo?.appodate || '',
                    assigned_tech_name: techMap[r.technician_id] || null
                };
            });

            setRequests(mapped);
            if (!silent) setLoading(false);
        } catch (e) {
            console.error("Fetch requests error:", e);
            setRequests([]);
            if (!silent) setLoading(false);
        }
    }, []);

    const fetchCatalog = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('lab_catalog').select('*').order('category').order('test_name');
            if (error) throw error;
            setCatalog(data || []);
        } catch (e) { console.error("Catalog fetch failed", e); }
    }, []);

    const fetchTechnicians = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('lab_technician').select('labid, labname, labemail, user_id');
            if (error) throw error;
            setTechnicians(data || []);
            // Try to find the tech record matching the current user's email if possible
            if (profile?.email) {
                const myTech = data?.find(t => t.labemail === profile.email);
                if (myTech) setSelectedTech(myTech.user_id || myTech.labid);
            }
        } catch (e) { console.error("Technicians fetch failed", e); }
    }, [profile]);

    useEffect(() => {
        fetchRequests();
        fetchCatalog();
        fetchTechnicians();
    }, [fetchRequests, fetchCatalog, fetchTechnicians]);


    const counts = {
        pending: requests.filter(r => r.status === 'pending').length,
        collected: requests.filter(r => r.status === 'sample_collected').length,
    };

    const openPanel = async (req) => {
        setSelected(req);

        // If status is pending and paid, move to processing (Start Session)
        if (req.status === 'pending' && req.is_paid) {
            try {
                const { error } = await supabase
                    .from('lab_requests')
                    .update({ status: 'processing' })
                    .eq('id', req.id);
                if (!error) {
                    req.status = 'processing';
                    // Update appointment status to notify Registrar
                    if (req.appointment_id) {
                        await supabase
                            .from('appointment')
                            .update({ status: 'lab_processing' })
                            .eq('appoid', req.appointment_id);
                    }
                    fetchRequests();
                }
            } catch (err) {
                console.error("Failed to start session", err);
            }
        }

        const fields = getDefaultFields(req.test_name, catalog);
        const init = {};
        fields.forEach((f, idx) => {
            const fieldName = f.field || `Parameter ${idx + 1}`;
            init[fieldName] = {
                value: '',
                unit: f.unit || '',
                ref: f.ref || (f.min && f.max ? `${f.min} - ${f.max}` : f.min ? `>${f.min}` : f.max ? `<${f.max}` : ''),
                min: f.min || '',
                max: f.max || '',
                status: 'Normal',
                type: f.type || 'Number'
            };
        });
        setResultValues(init);
        setNotes('');
        setVerified(false);
        setCustomFields(fields.map((f, idx) => ({
            name: f.field || `Parameter ${idx + 1}`,
            type: f.type || 'Number'
        })));

        // Auto-select technician: Assigned > Logged In > First in list
        if (req.technician_id) {
            setSelectedTech(req.technician_id);
        } else if (profile?.email) {
            const myTech = technicians.find(t => t.labemail === profile.email);
            if (myTech) setSelectedTech(myTech.labid);
            else setSelectedTech(technicians[0]?.labid || null);
        } else {
            setSelectedTech(technicians[0]?.labid || null);
        }

        setPanelOpen(true);
    };

    const handleCollect = async (id) => {
        try {
            // Optimistic update
            setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'sample_collected' } : r));
            
            const { error } = await supabase.from('lab_requests').update({ status: 'sample_collected' }).eq('id', id);
            if (error) throw error;
            showToast('Sample marked as collected');
            fetchRequests(true); // Silent refresh
        } catch (e) {
            showToast('Failed to mark sample as collected', 'error');
            fetchRequests(); // Re-fetch to restore state on error
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt("Reason for rejection (e.g. Hemolyzed, Insufficient Volume):");
        if (!reason) return;
        
        try {
            const { error } = await supabase.from('lab_requests').update({ 
                status: 'sample_rejected',
                notes: `REJECTED: ${reason}`
            }).eq('id', id);
            
            if (error) throw error;
            showToast('Sample rejected and doctor notified');
            fetchRequests(true);
            setPanelOpen(false);
        } catch (e) {
            showToast('Failed to reject sample', 'error');
        }
    };

    const handlePrintLabel = (req) => {
        const win = window.open('', '_blank', 'width=400,height=300');
        win.document.write(`
            <html>
                <head>
                    <title>Specimen Label - ${req.id}</title>
                    <style>
                        body { font-family: 'Courier New', Courier, monospace; padding: 20px; }
                        .label { border: 2px solid black; padding: 10px; width: 300px; }
                        .header { font-weight: bold; border-bottom: 1px solid black; margin-bottom: 10px; }
                        .barcode { font-size: 24px; letter-spacing: 5px; }
                    </style>
                </head>
                <body>
                    <div class="label">
                        <div class="header">MOONVIEW MEDICAL CENTER</div>
                        <div>ID: #LR-${req.id}</div>
                        <div>PT: ${req.pname}</div>
                        <div>TEST: ${req.test_name}</div>
                        <div>DATE: ${new Date().toLocaleString()}</div>
                        <div class="barcode">|||||||||||||||</div>
                    </div>
                </body>
            </html>
        `);
        win.document.close();
        win.print();
    };

    const handleMarkDone = async () => {
        if (!verified) return showToast('Please verify the results before marking as done', 'error');
        setSubmitting(true);
        try {
            const techRecord = technicians.find(t => t.user_id === selectedTech || String(t.labid) === String(selectedTech));
            const integerTechId = techRecord ? techRecord.labid : (Number(selectedTech) || null);

            const { error: insertError } = await supabase.from('lab_reports').insert({
                request_id: selected.id,
                patient_id: Number(selected.patient_id),
                test_name: selected.test_name,
                results: JSON.stringify(resultValues),
                notes: notes,
                technician_id: integerTechId
            });
            if (insertError) throw insertError;

            // Optimistic update
            setRequests(prev => prev.map(r => r.id === selected.id ? { ...r, status: 'results_entered' } : r));
            
            // Update to results_entered instead of completed
            const { error: updateError } = await supabase.from('lab_requests').update({ status: 'results_entered' }).eq('id', selected.id);
            if (updateError) throw updateError;

            // Update appointment status so Registrar sees progress
            if (selected.appointment_id) {
                await supabase
                    .from('appointment')
                    .update({ status: 'lab_results_partial' })
                    .eq('appoid', selected.appointment_id);
            }

            showToast('Results saved locally. Finalize the full report to notify doctor.');
            setPanelOpen(false);
            fetchRequests(true); // Silent refresh
        } catch (e) {
            console.error('[handleMarkDone] Error:', e);
            showToast(`Save failed: ${e.message}`, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleFinalizePatientReport = async (group) => {
        try {
            setSubmitting(true);
            const readyTests = group.filter(r => r.status === 'results_entered');
            if (readyTests.length === 0) return;

            // Update all to completed
            const ids = readyTests.map(r => r.id);
            
            // Optimistic update
            setRequests(prev => prev.filter(r => !ids.includes(r.id)));

            const { error: updateError } = await supabase
                .from('lab_requests')
                .update({ status: 'completed' })
                .in('id', ids);
            if (updateError) throw updateError;

            // Update appointment status to lab_completed for Registrar
            const appointmentId = group[0]?.appointment_id;
            if (appointmentId) {
                await supabase
                    .from('appointment')
                    .update({ status: 'lab_completed' })
                    .eq('appoid', appointmentId);
            }

            // Single Notification
            const patient = group[0];
            if (patient.docemail) {
                await supabase.from('notifications').insert({
                    recipient_email: patient.docemail,
                    title: `Lab Panel Ready: ${patient.pname}`,
                    message: `Consolidated results for ${readyTests.length} investigations are now available for review.`,
                    type: 'lab',
                    status: 'unread'
                });
            }

            showToast(`Report finalized! Doctor notified for ${readyTests.length} tests.`);
            fetchRequests(true); // Silent refresh
        } catch (e) {
            showToast('Failed to finalize report', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const fields = selected ? getDefaultFields(selected.test_name, catalog) : [];

    return (
        <div style={{ padding: '32px 48px', maxWidth: '1600px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>
            {toast && (
                <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 9999, background: toast.type === 'error' ? '#ef4444' : '#10b981', color: 'white', padding: '12px 24px', borderRadius: 12, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                    {toast.msg}
                </div>
            )}

            <header style={{ background: 'white', padding: '20px 40px', borderBottom: '1px solid #e2e8f0', borderRadius: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Microscope size={26} color="#2563eb" /> Lab Workbench
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: 2 }}>Central hub for active test processing</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={16} style={{ position: 'absolute', left: 10, top: 10, color: '#94a3b8' }} />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient or test..." style={{ padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', width: 220 }} />
                    </div>
                    <NotificationCenter />
                </div>
            </header>

            {/* Tabs Navigation */}
            <div style={{ display: 'flex', gap: '32px', marginBottom: '32px', borderBottom: '2px solid #f1f5f9', paddingBottom: '0' }}>
                {[
                    { id: 'Active', label: 'Active Queue', icon: Clock, count: Object.keys(tabData.Active).length, color: '#2563eb' },
                    { id: 'Pending', label: 'Pending Orders', icon: Clock, count: Object.keys(tabData.Pending).length, color: '#f59e0b' },
                    { id: 'Collected', label: 'Samples Collected', icon: Droplets, count: Object.keys(tabData.Collected).length, color: '#3b82f6' },
                    { id: 'Partial', label: 'Partial Results', icon: Activity, count: Object.keys(tabData.Partial).length, color: '#8b5cf6' },
                ].map(t => (
                    <button 
                        key={t.id}
                        onClick={() => setCurrentTab(t.id)}
                        style={{
                            padding: '12px 16px',
                            background: 'none',
                            border: 'none',
                            borderBottom: currentTab === t.id ? `4px solid ${t.color}` : '4px solid transparent',
                            color: currentTab === t.id ? t.color : '#64748b',
                            fontSize: '0.95rem',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: '0.2s',
                            opacity: currentTab === t.id ? 1 : 0.7
                        }}
                    >
                        <t.icon size={18} /> {t.label}
                        <span style={{ fontSize: '0.7rem', background: currentTab === t.id ? t.color : '#e2e8f0', color: currentTab === t.id ? 'white' : '#64748b', padding: '2px 8px', borderRadius: '12px', marginLeft: '4px' }}>{t.count}</span>
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 28 }}>
                {[
                    { label: 'Pending Orders', key: 'Pending', count: counts.pending, color: '#f59e0b', bg: '#fffbeb', icon: Clock },
                    { label: 'Samples Collected', key: 'Collected', count: counts.collected, color: '#3b82f6', bg: '#eff6ff', icon: Droplets },
                ].map(s => (
                    <div key={s.key} onClick={() => setCurrentTab(s.key)}
                        style={{ background: 'white', padding: '14px 20px', borderRadius: 12, border: currentTab === s.key ? `2px solid ${s.color}` : '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 14, flex: 1, cursor: 'pointer', transition: 'all 0.2s', transform: currentTab === s.key ? 'translateY(-2px)' : 'none', boxShadow: currentTab === s.key ? `0 4px 12px ${s.color}22` : 'none' }}>
                        <div style={{ background: s.bg, padding: 10, borderRadius: 10 }}><s.icon size={18} color={s.color} /></div>
                        <div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>{s.count}</div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
                        </div>
                    </div>
                ))}
            </div>


            {/* Grouped Request List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: 64, color: '#94a3b8' }}><Loader size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
                ) : Object.entries(displayedGroups).length === 0 ? (
                    <div style={{ padding: '80px', textAlign: 'center', background: 'white', borderRadius: '32px', border: '2px dashed #e2e8f0' }}>
                        <Users size={48} color="#cbd5e1" style={{ marginBottom: '20px' }} />
                        <h3 style={{ color: '#64748b', fontSize: '1.2rem', fontWeight: '700' }}>{currentTab} Queue is Clear</h3>
                        <p style={{ color: '#94a3b8' }}>{currentTab === 'Active' ? 'New diagnostic requests will appear here.' : 'No reports found in this category.'}</p>
                    </div>
                ) : Object.entries(displayedGroups).map(([appoid, group]) => {
                    const patient = group[0];
                    const allPaid = group.every(r => r.is_paid);
                    
                    return (
                        <div key={appoid} style={{ background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                            {/* Patient Group Header */}
                            <div style={{ padding: '24px 32px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <User size={24} />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>{patient.pname}</h3>
                                        <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.8rem', color: '#64748b', fontWeight: '600' }}>
                                            <span>{patient.pgender}</span>
                                            <span>•</span>
                                            <span>Req. by Dr. {patient.docname}</span>
                                            <span>•</span>
                                            <span style={{ color: '#2563eb' }}>{group.length} Test(s)</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {!allPaid && (
                                        <div style={{ padding: '8px 16px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Lock size={14} /> PARTIAL PAYMENT / PENDING
                                        </div>
                                    )}
                                    {allPaid && (
                                        <div style={{ padding: '8px 16px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '0.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <CheckCircle size={14} /> ALL TESTS CLEARED
                                        </div>
                                    )}
                                    {group.some(r => r.status === 'results_entered') && (
                                        <button 
                                            onClick={() => handleFinalizePatientReport(group)}
                                            disabled={submitting}
                                            style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(37,99,235,0.4)' }}
                                        >
                                            <Send size={16} /> Finalize Full Report ({group.filter(r => r.status === 'results_entered').length})
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Tests Table for this patient */}
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: 'white', borderBottom: '1px solid #f1f5f9' }}>
                                    <tr>
                                        <th style={{ padding: '16px 32px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Investigation</th>
                                        <th style={{ padding: '16px 32px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Priority & Payment</th>
                                        <th style={{ padding: '16px 32px', textAlign: 'left', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Current Status</th>
                                        <th style={{ padding: '16px 32px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.map((req, i) => (
                                        <tr key={req.id} style={{ borderBottom: i === group.length - 1 ? 'none' : '1px solid #f1f5f9', transition: '0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#fcfdfe'} onMouseOut={e => e.currentTarget.style.background = 'white'}>
                                            <td style={{ padding: '20px 32px' }}>
                                                <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.95rem' }}>{req.test_name}</div>
                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Requested {new Date(req.created_at).toLocaleTimeString()}</div>
                                            </td>
                                            <td style={{ padding: '20px 32px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ fontSize: '0.72rem', background: req.urgency === 'Urgent' ? '#fee2e2' : '#eff6ff', color: req.urgency === 'Urgent' ? '#ef4444' : '#2563eb', padding: '4px 10px', borderRadius: '6px', fontWeight: '800' }}>
                                                        {req.urgency ? req.urgency.toUpperCase() : 'NORMAL'}
                                                    </span>
                                                    {req.is_paid ? (
                                                        <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <CheckCircle size={12} /> PAID
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                            <Lock size={12} /> UNPAID
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '20px 32px' }}>
                                                <span style={{ ...getStatusStyle(req.status), padding: '4px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}>
                                                    {statusLabel(req.status)}
                                                </span>
                                            </td>
                                            <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                                                {req.status === 'completed' ? (
                                                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                                                        <CheckCircle size={14} /> FINALIZED
                                                    </span>
                                                ) : !req.is_paid ? (
                                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Locked</div>
                                                ) : (
                                                    <button 
                                                        onClick={() => openPanel(req)}
                                                        style={{ background: '#0f172a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
                                                    >
                                                        <Droplets size={14} /> {req.status === 'pending' ? 'Start Session' : 'Continue Analysis'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })}
            </div>

            {panelOpen && selected && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }} onClick={() => setPanelOpen(false)} />
                    <div style={{ width: '100%', maxWidth: '50vw', height: '100vh', background: 'white', boxShadow: '-10px 0 40px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                        <div style={{ padding: '24px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <div>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Process Test</h2>
                                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 2 }}>ID: #LR-{selected.id} · {selected.test_name}</p>
                            </div>
                            <button onClick={() => setPanelOpen(false)} style={{ background: '#e2e8f0', border: 'none', padding: '6px 12px', borderRadius: 8, cursor: 'pointer' }}><X size={16} /></button>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                            <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', color: 'white', padding: 20, borderRadius: 12, marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                    <div style={{ background: 'rgba(255,255,255,0.15)', padding: 8, borderRadius: 8 }}><User size={18} /></div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selected.pname}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: 0.75 }}>{selected.pgender}</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>
                                    Ordered by: Dr. {selected.docname}
                                </div>
                            </div>

                            <section style={{ marginBottom: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 12, fontSize: '0.9rem' }}>
                                    <Droplets size={16} color="#d946ef" /> 1. Sample Collection
                                </div>
                                {selected.status === 'sample_collected' ? (
                                    <div style={{ background: '#ecfdf5', border: '1px solid #86efac', borderRadius: 10, padding: '12px 16px', color: '#166534', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <CheckCircle size={16} /> Sample ready for analysis
                                    </div>
                                ) : (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button 
                                                onClick={() => handleCollect(selected.id)}
                                                disabled={!selected.is_paid}
                                                style={{ 
                                                    flex: 1, 
                                                    padding: '12px', 
                                                    borderRadius: 10, 
                                                    border: selected.is_paid ? '1px solid #3b82f6' : '1px solid #e2e8f0', 
                                                    color: selected.is_paid ? '#2563eb' : '#94a3b8', 
                                                    background: selected.is_paid ? '#eff6ff' : '#f8fafc', 
                                                    fontWeight: 700, 
                                                    fontSize: '0.85rem', 
                                                    cursor: selected.is_paid ? 'pointer' : 'not-allowed',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px'
                                                }}>
                                                {selected.is_paid ? <Droplets size={16} /> : <Lock size={16} />}
                                                {selected.is_paid ? 'Mark Collected' : 'Wait for Payment'}
                                            </button>
                                            <button 
                                                onClick={() => handleReject(selected.id)}
                                                style={{ 
                                                    padding: '12px', 
                                                    borderRadius: 10, 
                                                    border: '1px solid #fecdd3', 
                                                    color: '#e11d48', 
                                                    background: '#fff1f2', 
                                                    fontWeight: 700, 
                                                    fontSize: '0.85rem', 
                                                    cursor: 'pointer'
                                                }}
                                                title="Reject Sample"
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    )}
                                    {selected.status === 'sample_collected' && (
                                        <button 
                                            onClick={() => handlePrintLabel(selected)}
                                            style={{ 
                                                width: '100%',
                                                marginTop: '10px',
                                                padding: '10px', 
                                                borderRadius: 10, 
                                                border: '1px solid #e2e8f0', 
                                                color: '#64748b', 
                                                background: 'white', 
                                                fontWeight: 700, 
                                                fontSize: '0.8rem', 
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                            }}>
                                            Print Specimen Label
                                        </button>
                                    )}
                                </section>

                            {selected.is_paid ? (
                                <>
                                    <section style={{ marginBottom: 24 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 12, fontSize: '0.9rem' }}>
                                            <FileText size={16} color="#3b82f6" /> 2. Enter Findings
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {customFields.map((fObj, idx) => {
                                                const fieldName = fObj.name;
                                                const fieldType = resultValues[fieldName]?.type || fObj.type || 'Number';

                                                return (
                                                    <div key={idx} style={{ background: '#f8fafc', padding: '16px', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 12 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                                                                <button
                                                                    onClick={() => {
                                                                        setCustomFields(customFields.filter((_, i) => i !== idx));
                                                                        setResultValues(prev => {
                                                                            const n = { ...prev };
                                                                            delete n[fieldName];
                                                                            return n;
                                                                        });
                                                                    }}
                                                                    style={{ background: '#fff1f2', border: '1px solid #fecdd3', padding: '4px', borderRadius: 6, cursor: 'pointer', color: '#e11d48', display: 'flex', alignItems: 'center' }}
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                                <input
                                                                    style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 800, border: 'none', background: 'transparent', padding: 0, width: '100%' }}
                                                                    value={fieldName}
                                                                    onChange={e => {
                                                                        const newName = e.target.value;
                                                                        setCustomFields(prev => {
                                                                            const n = [...prev];
                                                                            n[idx] = { ...n[idx], name: newName };
                                                                            return n;
                                                                        });
                                                                        setResultValues(prev => {
                                                                            const n = { ...prev };
                                                                            n[newName] = n[fieldName] || { value: '', unit: '', ref: '', status: 'Normal', type: 'Number' };
                                                                            delete n[fieldName];
                                                                            return n;
                                                                        });
                                                                    }}
                                                                    placeholder="Parameter Name"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Findings / Value</label>
                                                                {fieldType === 'Number' || fieldType === 'Text' ? (
                                                                    <input
                                                                        type={fieldType === 'Number' ? 'number' : 'text'}
                                                                        value={resultValues[fieldName]?.value || ''}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            const numVal = parseFloat(val);
                                                                            let status = resultValues[fieldName]?.status || 'Normal';
                                                                            const min = parseFloat(resultValues[fieldName]?.min);
                                                                            const max = parseFloat(resultValues[fieldName]?.max);

                                                                            if (fieldType === 'Number' && !isNaN(numVal)) {
                                                                                if (!isNaN(min) && numVal < min) {
                                                                                    status = 'Critical';
                                                                                } else if (!isNaN(max) && numVal > max) {
                                                                                    status = 'Critical';
                                                                                } else if (!isNaN(min) && !isNaN(max)) {
                                                                                    status = 'Normal';
                                                                                }
                                                                            }

                                                                            setResultValues(v => ({ ...v, [fieldName]: { ...v[fieldName], value: val, status: status } }));
                                                                        }}
                                                                        placeholder={fieldType === 'Number' ? "Enter number" : "Type result here..."}
                                                                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box', background: 'white' }}
                                                                    />
                                                                ) : (
                                                                    <select
                                                                        value={resultValues[fieldName]?.value || ''}
                                                                        onChange={e => setResultValues(v => ({ ...v, [fieldName]: { ...v[fieldName], value: e.target.value } }))}
                                                                        style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.9rem', background: 'white' }}
                                                                    >
                                                                        <option value="">Choose result...</option>
                                                                        {fieldType === 'Pos/Neg' && <><option>Positive</option><option>Negative</option></>}
                                                                        {fieldType === 'React/Non' && <><option>Reactive</option><option>Non-Reactive</option></>}
                                                                        {fieldType === 'Normal/Abnormal' && <><option>Normal</option><option>Abnormal</option></>}
                                                                        {fieldType === 'Levels' && <><option>Negative</option><option>+</option><option>++</option><option>+++</option></>}
                                                                    </select>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Normal Range</label>
                                                                <input
                                                                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.9rem', boxSizing: 'border-box', background: 'white', color: '#64748b' }}
                                                                    value={resultValues[fieldName]?.ref || ''}
                                                                    onChange={e => setResultValues(v => ({ ...v, [fieldName]: { ...v[fieldName], ref: e.target.value } }))}
                                                                    placeholder="Healthy Range"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Verdict / Status</label>
                                                                <select
                                                                    value={resultValues[fieldName]?.status || 'Normal'}
                                                                    onChange={e => setResultValues(v => ({ ...v, [fieldName]: { ...v[fieldName], status: e.target.value } }))}
                                                                    style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem', background: resultValues[fieldName]?.status === 'Normal' ? 'white' : '#fff1f1', color: resultValues[fieldName]?.status === 'Normal' ? '#64748b' : '#ef4444', fontWeight: 600 }}>
                                                                    <option>Normal</option>
                                                                    <option>High</option>
                                                                    <option>Low</option>
                                                                    <option>Critical</option>
                                                                    <option>Reactive</option>
                                                                    <option>Non-Reactive</option>
                                                                    <option>Positive</option>
                                                                    <option>Negative</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            <button
                                                onClick={() => {
                                                    const newFieldName = `Parameter ${customFields.length + 1}`;
                                                    setCustomFields([...customFields, { name: newFieldName, type: 'Number' }]);
                                                    setResultValues(prev => ({ ...prev, [newFieldName]: { value: '', unit: '', ref: '', status: 'Normal', type: 'Number' } }));
                                                }}
                                                style={{ marginTop: 8, background: '#f1f5f9', color: '#475569', border: 'none', padding: '8px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                + Add Another Parameter
                                            </button>
                                            <div>
                                                <label style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 4 }}>Observations</label>
                                                <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                                                    placeholder="Add notes..." style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.88rem', resize: 'none' }} />
                                            </div>
                                        </div>
                                    </section>

                                    <section style={{ marginBottom: 24 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, marginBottom: 12, fontSize: '0.9rem', marginTop: 20 }}>
                                            <CheckCircle size={16} color="#10b981" /> 3. Authorization & Technician
                                        </div>
                                        <div style={{ marginBottom: 16 }}>
                                            <label style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: 6 }}>Performing Technician</label>
                                            <select
                                                value={selectedTech || ''}
                                                onChange={e => setSelectedTech(e.target.value)}
                                                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: '0.85rem' }}
                                            >
                                                <option value="">Select Technician...</option>
                                                {technicians.map(t => (
                                                    <option key={t.labid} value={t.user_id || t.labid}>{t.labname}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '14px 16px', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} style={{ width: 18, height: 18 }} />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#166534' }}>Certify and Release Results</span>
                                        </label>
                                    </section>
                                </>
                            ) : (
                                <div style={{ padding: '40px 20px', textAlign: 'center', background: '#fff7ed', borderRadius: 12, border: '1px solid #ffedd5' }}>
                                    <AlertTriangle size={48} color="#f59e0b" style={{ margin: '0 auto 16px' }} />
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#9a3412' }}>Payment Required</h3>
                                    <p style={{ color: '#c2410c', fontSize: '0.85rem', marginTop: 8 }}>
                                        This test order is visible for planning but results cannot be entered until the Registrar confirms payment.
                                    </p>
                                    <div style={{ marginTop: 24, fontSize: '0.75rem', color: '#9a3412', fontWeight: 600, textTransform: 'uppercase' }}>
                                        Contact Billing Department
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '20px 28px', borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>
                            <button onClick={handleMarkDone} disabled={submitting || !verified}
                                style={{ width: '100%', padding: '14px', borderRadius: 12, background: verified ? '#10b981' : '#e2e8f0', color: verified ? 'white' : '#94a3b8', border: 'none', fontWeight: 700, cursor: verified ? 'pointer' : 'not-allowed' }}>
                                {submitting ? 'Saving...' : 'Save & Mark as Done'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
}
