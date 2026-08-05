// =============================================================
// FILE: RegistrarRegistration.jsx
// PURPOSE: React component for the Patient Registration / Enrollment
//          system. Handles new patients, returning visits, and triage.
// =============================================================
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Save, AlertTriangle, Thermometer, Activity, Heart, Wind, Droplets, Info, ShieldCheck, CreditCard, Camera, FileText, Search, Users, RefreshCw, FlaskConical, Stethoscope, Phone, MapPin, Fingerprint, ChevronRight, CheckCircle, Edit, CalendarPlus, X } from 'lucide-react';
import Select from 'react-select';
import { format } from 'date-fns';
import { addPatient } from '../../lib/api';
import { useNotification } from '../../components/NotificationContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const RegistrarRegistration = () => {
    const navigate = useNavigate();
    const { showNotification } = useNotification();
    const { profile } = useAuth();
    const rolePath = window.location.pathname.startsWith('/admin') ? '/admin' : '/registrar';

    const [activeTab, setActiveTab] = useState('new'); // 'new' or 'returning'
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [visitCount, setVisitCount] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    const [isBooking, setIsBooking] = useState(false);
    const [labModal, setLabModal] = useState(false);
    const [catalog, setCatalog] = useState([]);
    const [selectedTests, setSelectedTests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [priceMatrix, setPriceMatrix] = useState([]);
    const [regFees, setRegFees] = useState([]);

    const initialFormState = {
        firstName: '', lastName: '', gender: '', dob: '', marital: '',
        phone: '', altPhone: '', email: '', address: '', city: '',
        patientDisplayId: '', nationalId: '', insuranceId: '',
        bloodGroup: '', allergies: '', conditions: '', medications: '', takingMedication: 'No',
        temp: '', weight: '', height: '', bp: '', heartRate: '', respiratory: '', spo2: '',
        disabilities: '', pregnancy: 'N/A', immunization: '',
        emergencyName: '', emergencyPhone: '', emergencyRelation: '',
        guardianName: '', guardianRelation: '', guardianPhone: '', guardianEmail: '', guardianAddress: '',
        guardianId: '', guardianInsurance: '',
        consentBy: '', consentSignature: '', consentDate: format(new Date(), 'yyyy-MM-dd'),
        paymentMethod: '',
        photo: '', notes: ''
    };

    const [formData, setFormData] = useState(initialFormState);

    // Auto-calculate Age
    const age = useMemo(() => {
        if (!formData.dob) return null;
        const birthDate = new Date(formData.dob);
        const today = new Date();
        let ageValue = today.getFullYear() - birthDate.getFullYear();
        if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
            ageValue--;
        }
        return ageValue;
    }, [formData.dob]);

    const isMinor = age !== null && age < 18;

    useEffect(() => {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomStr = Math.floor(1000 + Math.random() * 9000);
        setFormData(prev => ({ ...prev, patientDisplayId: `PT-${dateStr}-${randomStr}` }));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (selectedOption, action) => {
        setFormData(prev => ({ ...prev, [action.name]: selectedOption ? selectedOption.value : '' }));
    };

    const handleDateChange = (type, value) => {
        const [y, m, d] = (formData.dob || '1990-01-01').split('-');
        let newDob = '';
        if (type === 'year') newDob = `${value}-${m}-${d}`;
        else if (type === 'month') newDob = `${y}-${value}-${d}`;
        else if (type === 'day') newDob = `${y}-${m}-${value}`;
        setFormData(prev => ({ ...prev, dob: newDob }));
    };

    const dobParts = formData.dob ? formData.dob.split('-') : ['', '', ''];
    const years = Array.from({ length: 120 }, (_, i) => ({ value: (new Date().getFullYear() - i).toString(), label: (new Date().getFullYear() - i).toString() }));
    const months = [
        { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
        { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
        { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
        { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' }
    ];
    const days = Array.from({ length: 31 }, (_, i) => ({ value: (i + 1).toString().padStart(2, '0'), label: (i + 1).toString() }));

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim().length >= 1) {
                handleSearch();
            } else if (searchQuery.trim().length === 0) {
                setSearchResults([]);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSearch = async () => {
        setIsSearching(true);
        try {
            const { data, error } = await supabase
                .from('patient')
                .select('*, appointment(appoid)')
                .or(`pname.ilike.%${searchQuery}%, ptel.ilike.%${searchQuery}%, patient_display_id.ilike.%${searchQuery}%`)
                .limit(10);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (e) {
            showNotification('Search failed', 'error');
        } finally {
            setIsSearching(false);
        }
    };

    const selectPatient = async (p) => {
        setIsSearching(true);
        try {
            const { data, error } = await supabase.from('patient').select('*').eq('pid', p.pid).single();
            if (error) throw error;

            setSelectedPatient(data);
            const { count } = await supabase.from('appointment').select('appoid', { count: 'exact', head: true }).eq('pid', p.pid);
            setVisitCount((count || 0) + 1);
            setSearchResults([]);
        } catch (e) {
            showNotification('Failed to load patient profile', 'error');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSendToDoctor = async () => {
        if (!selectedPatient) return;
        setIsBooking(true);
        try {
            const { data, error } = await supabase.from('appointment').insert({
                pid: selectedPatient.pid,
                appodate: format(new Date(), 'yyyy-MM-dd'),
                status: 'pending'
            }).select();

            if (error) throw error;

            // Sync vitals to patient table
            if (formData.temp || formData.bp) {
                await supabase.from('patient').update({
                    ptemp: formData.temp || null,
                    pbp: formData.bp || null,
                    pheartrate: formData.heartRate || null,
                    prespiratory: formData.respiratory || null,
                    pspo2: formData.spo2 || null,
                    pweight: formData.weight || null,
                    pheight: formData.height || null
                }).eq('pid', selectedPatient.pid);

                await supabase.from('vitals_records').insert({
                    pid: selectedPatient.pid,
                    temp: formData.temp,
                    bp: formData.bp,
                    pulse: formData.heartRate,
                    weight: formData.weight,
                    height: formData.height,
                    resp_rate: formData.respiratory,
                    spo2: formData.spo2
                });
            }

            showNotification(`Patient queued for consultation (Visit #${visitCount})`);
            navigate('/registrar/dashboard');
        } catch (e) {
            showNotification('Booking failed', 'error');
        } finally {
            setIsBooking(false);
        }
    };

    const handleSendToLab = async () => {
        if (selectedTests.length === 0) return showNotification('Select at least one test', 'error');
        setIsBooking(true);
        try {
            const { data: appo, error: appoErr } = await supabase.from('appointment').insert({
                pid: selectedPatient.pid,
                appodate: format(new Date(), 'yyyy-MM-dd'),
                status: 'pending_lab'
            }).select();

            if (appoErr) throw appoErr;

            const labRequests = selectedTests.map(test => ({
                appointment_id: appo[0].appoid,
                test_name: test.test_name,
                price: Number(test.price || 0),
                status: 'pending'
            }));

            const { error: labErr } = await supabase.from('lab_requests').insert(labRequests);
            if (labErr) throw labErr;

            showNotification('Lab order sent successfully');
            navigate('/registrar/dashboard');
        } catch (e) {
            showNotification('Lab order failed', 'error');
        } finally {
            setIsBooking(false);
        }
    };

    useEffect(() => {
        const fetchPricing = async () => {
            const { data } = await supabase.from('pricing_matrix').select('*').eq('is_active', true);
            if (data) {
                setPriceMatrix(data);
                const reg = data.filter(p => p.category === 'Administration');
                setRegFees(reg);
            }
        };
        fetchPricing();
    }, []);

    useEffect(() => {
        if (labModal) {
            const fetchCatalog = async () => {
                const { data } = await supabase.from('lab_catalog').select('*').eq('is_enabled', true);
                setCatalog(data || []);
            };
            fetchCatalog();
        }
    }, [labModal]);



    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const patientData = {
            patient_display_id: formData.patientDisplayId,
            pname: `${formData.firstName} ${formData.lastName}`,
            pgender: formData.gender,
            pdob: formData.dob,
            ptel: formData.phone,
            palttel: formData.altPhone || null,
            pemail: formData.email || null,
            paddress: formData.address || null,
            pcity: formData.city || null,
            pmarital: formData.marital || null,
            pnic: formData.nationalId || null,
            pinsurance_scheme: formData.insuranceId || null,
            pbloodgroup: formData.bloodGroup || null,
            pallergies: formData.allergies || null,
            pconditions: formData.conditions || null,
            pmedications: formData.medications || null,
            pdisabilities: formData.disabilities || null,
            ppregnancy: formData.pregnancy || 'N/A',
            pimmunization: formData.immunization || null,
            pemergency_name: formData.emergencyName || null,
            pemergency_phone: formData.emergencyPhone || null,
            pemergency_relation: formData.emergencyRelation || null,
            pguardian_name: formData.guardianName || null,
            pguardian_phone: formData.guardianPhone || null,
            pguardian_relation: formData.guardianRelation || null,
            pguardian_email: formData.guardianEmail || null,
            pguardian_address: formData.guardianAddress || null,
            pguardian_id: formData.guardianId || null,
            ppayment: formData.paymentMethod || null,
            pnotes: formData.notes || null,
            pdate_registered: new Date().toISOString(),
            pstatus: 'active',
            created_by: profile?.full_name || 'Staff',
            // Sync vitals to patient table so doctor sees them
            ptemp: formData.temp || null,
            pbp: formData.bp || null,
            pheartrate: formData.heartRate || null,
            prespiratory: formData.respiratory || null,
            pspo2: formData.spo2 || null,
            pweight: formData.weight || null,
            pheight: formData.height || null
        };
        try {
            // Check for duplicate email first
            if (formData.email) {
                const { data: existing } = await supabase
                    .from('patient')
                    .select('pid, pname')
                    .eq('pemail', formData.email.trim())
                    .maybeSingle();

                if (existing) {
                    showNotification(`Registration failed: Email already in use by patient ${existing.pname}.`, 'error');
                    setLoading(false);
                    return;
                }
            }

            let res;
            res = await supabase.from('patient').insert(patientData).select();

            const { data, error } = res;

            if (!error) {
                showNotification('Patient successfully registered!', 'success');
                setFormData(initialFormState);
                navigate(`${rolePath}/patients`);
            } else {
                if (error.message.includes('patient_pemail_key')) {
                    showNotification('This email is already registered to another patient.', 'error');
                } else {
                    showNotification(error.message, 'error');
                }
            }
        } catch (err) {
            showNotification('Network error', 'error');
        } finally {
            setLoading(false);
        }
    };

    const SectionHeader = ({ icon: Icon, title }) => (
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, borderBottom: '2px solid #f1f5f9', paddingBottom: '16px', marginBottom: '32px', color: '#334155', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {Icon && <Icon size={24} color="#2563eb" />} {title}
        </h3>
    );

    const customSelectStyles = {
        control: (base) => ({
            ...base,
            padding: '6px',
            borderRadius: '14px',
            border: '2px solid #e2e8f0',
            boxShadow: 'none',
            fontSize: '1rem',
            '&:hover': { border: '2px solid #2563eb' }
        })
    };

    return (
        <div style={{ padding: '48px', maxWidth: '1600px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
                <header style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '16px', letterSpacing: '-0.04em' }}>
                        <Users size={40} color="#2563eb" /> Add Patient
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '1.125rem', fontWeight: '500' }}>Manage new enrollments and returning patient visits.</p>
                </header>
                    <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '6px', borderRadius: '18px', border: '1px solid #e2e8f0', marginTop: '16px' }}>
                        <button
                            onClick={() => {
                                setActiveTab('new');
                                if (!isEditMode) setFormData(initialFormState);
                            }}
                            style={{ padding: '14px 32px', borderRadius: '14px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', transition: '0.3s', border: 'none', background: activeTab === 'new' ? 'white' : 'transparent', color: activeTab === 'new' ? '#2563eb' : '#64748b', boxShadow: activeTab === 'new' ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <UserPlus size={20} /> {isEditMode ? 'Edit Profile' : 'New Enrollment'}
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('returning');
                                setIsEditMode(false);
                            }}
                            style={{ padding: '14px 32px', borderRadius: '14px', fontSize: '1rem', fontWeight: 800, cursor: 'pointer', transition: '0.3s', border: 'none', background: activeTab === 'returning' ? 'white' : 'transparent', color: activeTab === 'returning' ? '#2563eb' : '#64748b', boxShadow: activeTab === 'returning' ? '0 10px 15px -3px rgba(0, 0, 0, 0.1)' : 'none', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <RefreshCw size={20} /> Returning Patient
                        </button>
                    </div>

                <div style={{ background: 'white', borderRadius: '32px', border: '1px solid #e2e8f0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.05)', overflow: 'hidden', maxWidth: '1100px' }}>
                    {activeTab === 'returning' ? (
                        <div style={{ padding: '48px' }}>
                            <div style={{ margin: '0 auto 48px' }}>
                                <SectionHeader icon={Search} title="Find Existing Patient" />
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <div style={{ flex: 1, position: 'relative' }}>
                                        <Search size={24} color="#94a3b8" style={{ position: 'absolute', left: '20px', top: '16px' }} />
                                        <input
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            onKeyPress={e => e.key === 'Enter' && handleSearch()}
                                            placeholder="Search Name, Phone or ID..."
                                            style={{ width: '100%', padding: '18px 18px 18px 60px', borderRadius: '18px', border: '2px solid #e2e8f0', fontSize: '1.1rem', outline: 'none', transition: '0.2s' }}
                                        />
                                    </div>
                                    <button
                                        onClick={handleSearch}
                                        disabled={isSearching}
                                        style={{ padding: '0 36px', borderRadius: '18px', background: '#2563eb', color: 'white', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
                                        {isSearching ? '...' : 'Find'}
                                    </button>
                                </div>

                                {searchResults.length > 0 && (
                                    <div style={{ marginTop: '16px', border: '1px solid #e2e8f0', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)' }}>
                                        {searchResults.map(p => (
                                            <div
                                                key={p.pid}
                                                onClick={() => selectPatient(p)}
                                                style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', background: 'white', transition: '0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                                onMouseOver={e => e.currentTarget.style.background = '#f8fafc'}
                                                onMouseOut={e => e.currentTarget.style.background = 'white'}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                                    <div style={{ width: '50px', height: '50px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#2563eb' }}>{p.pname.charAt(0)}</div>
                                                    <div>
                                                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.25rem' }}>{p.pname}</div>
                                                        <div style={{ fontSize: '1rem', color: '#64748b', fontWeight: '500' }}>ID: {p.patient_display_id} • {p.ptel}</div>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <span style={{ padding: '6px 12px', background: '#eff6ff', color: '#2563eb', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 800 }}>SELECT PATIENT</span>
                                                    <ChevronRight size={20} color="#cbd5e1" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {selectedPatient && (
                                <div style={{ animation: 'fadeIn 0.4s cubic-bezier(0, 0, 0.2, 1)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Last Temp</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b' }}>{selectedPatient.ptemp || 'N/A'} °C</div>
                                        </div>
                                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Last BP</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b' }}>{selectedPatient.pbp || 'N/A'}</div>
                                        </div>
                                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Blood Group</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b' }}>{selectedPatient.pbloodgroup || 'N/A'}</div>
                                        </div>
                                        <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>Last Visit</div>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#1e293b' }}>{selectedPatient.pdate_registered ? format(new Date(selectedPatient.pdate_registered), 'dd MMM yyyy') : 'N/A'}</div>
                                        </div>
                                    </div>

                                    {/* 🩺 NEW VITALS FOR THIS VISIT */}
                                    <section style={{ borderTop: '2px solid #f1f5f9', paddingTop: '32px' }}>
                                        <SectionHeader icon={Activity} title="New Triage / Vitals for this Visit" />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                                            <div>
                                                <label className="label-text">Temp (°C)</label>
                                                <input type="text" name="temp" value={formData.temp} onChange={handleChange} className="input-field" placeholder="36.5" />
                                            </div>
                                            <div>
                                                <label className="label-text">Weight (kg)</label>
                                                <input type="text" name="weight" value={formData.weight} onChange={handleChange} className="input-field" placeholder="70" />
                                            </div>
                                            <div>
                                                <label className="label-text">Blood Pressure</label>
                                                <input type="text" name="bp" value={formData.bp} onChange={handleChange} className="input-field" placeholder="120/80" />
                                            </div>
                                        </div>
                                    </section>

                                    {/* SINGLE ACTION BUTTON */}
                                    <div style={{ marginTop: '32px' }}>
                                        <button 
                                            onClick={async () => {
                                                setIsBooking(true);
                                                try {
                                                    // 1. Sync vitals to patient table for this returning visit
                                                    await supabase.from('patient').update({
                                                        ptemp: formData.temp || selectedPatient.ptemp,
                                                        pbp: formData.bp || selectedPatient.pbp,
                                                        pheartrate: formData.heartRate || selectedPatient.pheartrate,
                                                        prespiratory: formData.respiratory || selectedPatient.prespiratory,
                                                        pspo2: formData.spo2 || selectedPatient.pspo2,
                                                        pweight: formData.weight || selectedPatient.pweight,
                                                        pheight: formData.height || selectedPatient.pheight
                                                    }).eq('pid', selectedPatient.pid);

                                                    // 2. Create a 'pending' appointment to signify check-in
                                                    const { error: appoErr } = await supabase.from('appointment').insert({
                                                        pid: selectedPatient.pid,
                                                        appodate: new Date().toISOString().split('T')[0],
                                                        status: 'pending'
                                                    });

                                                    if (appoErr) throw appoErr;

                                                    showNotification(`Check-in successful! Visit #${visitCount + 1} recorded. Redirecting to clinical handover...`, 'success');
                                                    setTimeout(() => navigate(`${rolePath}/patients`), 800);
                                                } catch (e) {
                                                    showNotification('Registration failed', 'error');
                                                } finally {
                                                    setIsBooking(false);
                                                }
                                            }}
                                            disabled={isBooking}
                                            style={{ 
                                                width: '100%',
                                                padding: '24px', 
                                                borderRadius: '24px', 
                                                border: 'none', 
                                                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', 
                                                color: 'white', 
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '16px',
                                                transition: '0.2s',
                                                boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
                                                fontSize: '1.25rem',
                                                fontWeight: 900,
                                                opacity: isBooking ? 0.7 : 1
                                            }}
                                            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
                                        >
                                            <CalendarPlus size={28} color="white" />
                                            {isBooking ? 'Registering...' : 'Register for Visit'}
                                        </button>
                                        <p style={{ textAlign: 'center', marginTop: '16px', color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>
                                            Handing over will send this patient to the directory for clinical booking.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div style={{ padding: '48px', display: 'flex', flexDirection: 'column', gap: '56px' }}>
                                {/* 🧑 BASIC INFORMATION */}
                                <section>
                                    <SectionHeader icon={isEditMode ? RefreshCw : UserPlus} title={isEditMode ? "Update Clinical Credentials" : "Basic Information"} />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label className="label-text">Full Name *</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="input-field" placeholder="First Name" required />
                                                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="input-field" placeholder="Last Name" required />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="label-text">Date of Birth *</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: '8px' }}>
                                                <Select options={months} value={months.find(m => m.value === dobParts[1])} onChange={(opt) => handleDateChange('month', opt.value)} styles={customSelectStyles} placeholder="Month" />
                                                <Select options={days} value={days.find(d => d.value === dobParts[2])} onChange={(opt) => handleDateChange('day', opt.value)} styles={customSelectStyles} placeholder="Day" />
                                                <Select options={years} value={years.find(y => y.value === dobParts[0])} onChange={(opt) => handleDateChange('year', opt.value)} styles={customSelectStyles} placeholder="Year" />
                                            </div>
                                            {age !== null && <div style={{ marginTop: '8px', fontSize: '0.875rem', color: '#2563eb', fontWeight: '600' }}>Calculated Age: {age} years</div>}
                                        </div>
                                        <div>
                                            <label className="label-text">Gender</label>
                                            <Select name="gender" options={[{ value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }, { value: 'Other', label: 'Other' }]} value={formData.gender ? { value: formData.gender, label: formData.gender } : null} onChange={handleSelectChange} styles={customSelectStyles} placeholder="Select Gender" />
                                        </div>
                                        <div>
                                            <label className="label-text">Marital Status</label>
                                            <Select name="marital" options={[{ value: 'Single', label: 'Single' }, { value: 'Married', label: 'Married' }, { value: 'Divorced', label: 'Divorced' }, { value: 'Widowed', label: 'Widowed' }]} value={formData.marital ? { value: formData.marital, label: formData.marital } : null} onChange={handleSelectChange} styles={customSelectStyles} placeholder="Select Status" />
                                        </div>
                                    </div>
                                </section>

                                {/* 📞 CONTACT INFORMATION */}
                                <section>
                                    <SectionHeader icon={Phone} title="Contact Information" />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                        <div>
                                            <label className="label-text">Phone Number {isMinor ? '(Optional for Minors)' : '*'}</label>
                                            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="input-field" placeholder="07XXXXXXXX" required={!isMinor} />
                                        </div>
                                        <div>
                                            <label className="label-text">Alternate Phone</label>
                                            <input type="tel" name="altPhone" value={formData.altPhone} onChange={handleChange} className="input-field" placeholder="07XXXXXXXX" />
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label className="label-text">Email Address {isMinor ? '(Optional)' : ''}</label>
                                            <input type="email" name="email" value={formData.email} onChange={handleChange} className="input-field" placeholder="example@mail.com" />
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label className="label-text">Physical Address</label>
                                            <textarea name="address" value={formData.address} onChange={handleChange} className="input-field" rows="2" placeholder="Street, Building, Apartment"></textarea>
                                        </div>
                                        <div>
                                            <label className="label-text">City / Location</label>
                                            <input type="text" name="city" value={formData.city} onChange={handleChange} className="input-field" />
                                        </div>
                                    </div>
                                </section>

                                {/* 🆔 IDENTIFICATION */}
                                <section>
                                    <SectionHeader icon={Fingerprint} title="Identification" />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                        <div>
                                            <label className="label-text">National ID / Passport</label>
                                            <input type="text" name="nationalId" value={formData.nationalId} onChange={handleChange} className="input-field" />
                                        </div>
                                        <div>
                                            <label className="label-text">Insurance ID (Optional)</label>
                                            <input type="text" name="insuranceId" value={formData.insuranceId} onChange={handleChange} className="input-field" />
                                        </div>
                                    </div>
                                </section>

                                {/* 🧑⚕️ MEDICAL INFORMATION */}
                                <section>
                                    <SectionHeader icon={Activity} title="Medical Information" />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                        <div>
                                            <label className="label-text">Blood Group</label>
                                            <Select name="bloodGroup" options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => ({ value: g, label: g }))} value={formData.bloodGroup ? { value: formData.bloodGroup, label: formData.bloodGroup } : null} onChange={handleSelectChange} styles={customSelectStyles} />
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label className="label-text">Known Allergies</label>
                                            <textarea name="allergies" value={formData.allergies} onChange={handleChange} className="input-field" rows="2" placeholder="Drugs, Food, Environmental"></textarea>
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label className="label-text">Existing Medical Conditions</label>
                                            <textarea name="conditions" value={formData.conditions} onChange={handleChange} className="input-field" rows="2"></textarea>
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label className="label-text">Current Medications</label>
                                            <textarea name="medications" value={formData.medications} onChange={handleChange} className="input-field" rows="2" placeholder="List medications, dose, and frequency"></textarea>
                                        </div>
                                    </div>
                                </section>

                                {/* 🌡️ VITAL SIGNS (TRIAGE) */}
                                <section style={{ background: '#f0f9ff', padding: '32px', borderRadius: '12px', border: '1px solid #bae6fd' }}>
                                    <SectionHeader icon={Thermometer} title="Vital Signs (Triage)" />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                                        <div>
                                            <label className="label-text">Temperature (°C)</label>
                                            <input type="text" name="temp" value={formData.temp} onChange={handleChange} className="input-field" placeholder="36.5" />
                                        </div>
                                        <div>
                                            <label className="label-text">Weight (kg)</label>
                                            <input type="text" name="weight" value={formData.weight} onChange={handleChange} className="input-field" placeholder="70" />
                                        </div>
                                        <div>
                                            <label className="label-text">Height (cm)</label>
                                            <input type="text" name="height" value={formData.height} onChange={handleChange} className="input-field" placeholder="175" />
                                        </div>
                                        <div>
                                            <label className="label-text">Blood Pressure</label>
                                            <input type="text" name="bp" value={formData.bp} onChange={handleChange} className="input-field" placeholder="120/80" />
                                        </div>
                                        <div>
                                            <label className="label-text">Heart Rate (bpm)</label>
                                            <input type="text" name="heartRate" value={formData.heartRate} onChange={handleChange} className="input-field" placeholder="72" />
                                        </div>
                                        <div>
                                            <label className="label-text">Resp. Rate</label>
                                            <input type="text" name="respiratory" value={formData.respiratory} onChange={handleChange} className="input-field" placeholder="16" />
                                        </div>
                                        <div>
                                            <label className="label-text">SpO₂ (%)</label>
                                            <input type="text" name="spo2" value={formData.spo2} onChange={handleChange} className="input-field" placeholder="98" />
                                        </div>
                                    </div>
                                </section>

                                {/* 🧠 ADDITIONAL HEALTH INFO */}
                                <section>
                                    <SectionHeader icon={Info} title="Additional Health Info" />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label className="label-text">Disabilities (If any)</label>
                                            <input type="text" name="disabilities" value={formData.disabilities} onChange={handleChange} className="input-field" />
                                        </div>
                                        {(formData.gender === 'Female' && age >= 12) && (
                                            <div>
                                                <label className="label-text">Pregnancy Status</label>
                                                <Select name="pregnancy" options={[{ value: 'N/A', label: 'N/A' }, { value: 'Pregnant', label: 'Pregnant' }, { value: 'Not Pregnant', label: 'Not Pregnant' }]} value={{ value: formData.pregnancy, label: formData.pregnancy }} onChange={handleSelectChange} styles={customSelectStyles} />
                                            </div>
                                        )}
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label className="label-text">Immunization / Vaccination Status</label>
                                            <textarea name="immunization" value={formData.immunization} onChange={handleChange} className="input-field" rows="2"></textarea>
                                        </div>
                                    </div>
                                </section>

                                {/* 🚨 EMERGENCY CONTACT */}
                                <section>
                                    <SectionHeader icon={AlertTriangle} title="Emergency Contact" />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
                                        <div>
                                            <label className="label-text">Contact Name</label>
                                            <input type="text" name="emergencyName" value={formData.emergencyName} onChange={handleChange} className="input-field" />
                                        </div>
                                        <div>
                                            <label className="label-text">Contact Phone</label>
                                            <input type="tel" name="emergencyPhone" value={formData.emergencyPhone} onChange={handleChange} className="input-field" placeholder="07XXXXXXXX" />
                                        </div>
                                        <div>
                                            <label className="label-text">Relationship</label>
                                            <input type="text" name="emergencyRelation" value={formData.emergencyRelation} onChange={handleChange} className="input-field" />
                                        </div>
                                    </div>
                                </section>

                                {/* 👨👩👧 GUARDIAN INFORMATION (Minors Only) */}
                                {isMinor && (
                                    <section style={{ background: '#fffbeb', padding: '32px', borderRadius: '12px', border: '1px solid #fde68a' }}>
                                        <SectionHeader icon={ShieldCheck} title="Guardian Information (Patient is Under 18)" />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                            <div>
                                                <label className="label-text">Guardian Full Name *</label>
                                                <input type="text" name="guardianName" value={formData.guardianName} onChange={handleChange} className="input-field" required />
                                            </div>
                                            <div>
                                                <label className="label-text">Relationship to Patient *</label>
                                                <Select name="guardianRelation" options={[{ value: 'Mother', label: 'Mother' }, { value: 'Father', label: 'Father' }, { value: 'Legal Guardian', label: 'Legal Guardian' }, { value: 'Other', label: 'Other' }]} value={formData.guardianRelation ? { value: formData.guardianRelation, label: formData.guardianRelation } : null} onChange={handleSelectChange} styles={customSelectStyles} />
                                            </div>
                                            <div>
                                                <label className="label-text">Guardian Phone *</label>
                                                <input type="tel" name="guardianPhone" value={formData.guardianPhone} onChange={handleChange} className="input-field" required />
                                            </div>
                                            <div>
                                                <label className="label-text">Guardian Email</label>
                                                <input type="email" name="guardianEmail" value={formData.guardianEmail} onChange={handleChange} className="input-field" />
                                            </div>
                                            <div style={{ gridColumn: 'span 2' }}>
                                                <label className="label-text">Guardian Address</label>
                                                <textarea name="guardianAddress" value={formData.guardianAddress} onChange={handleChange} className="input-field" rows="2"></textarea>
                                            </div>
                                            <div style={{ borderTop: '1px solid #fef3c7', gridColumn: 'span 2', paddingTop: '24px', marginTop: '12px' }}>
                                                <SectionHeader title="Guardian Identification" />
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                                    <div>
                                                        <label className="label-text">Guardian National ID / Passport</label>
                                                        <input type="text" name="guardianId" value={formData.guardianId} onChange={handleChange} className="input-field" />
                                                    </div>
                                                    <div>
                                                        <label className="label-text">Guardian Insurance Details</label>
                                                        <input type="text" name="guardianInsurance" value={formData.guardianInsurance} onChange={handleChange} className="input-field" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                )}

                                {/* 💳 PAYMENT INFORMATION */}
                                <section>
                                    <SectionHeader icon={CreditCard} title="Payment Information" />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                        <div>
                                            <label className="label-text">Payment Method</label>
                                            <Select name="paymentMethod" options={[{ value: 'Cash', label: 'Cash' }, { value: 'Card', label: 'Card' }, { value: 'Insurance', label: 'Insurance' }, { value: 'Mpesa', label: 'Mpesa' }]} value={formData.paymentMethod ? { value: formData.paymentMethod, label: formData.paymentMethod } : null} onChange={handleSelectChange} styles={customSelectStyles} />
                                        </div>
                                        {regFees.length > 0 && (
                                            <div style={{ gridColumn: 'span 2', marginTop: '16px', padding: '16px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                                <label className="label-text" style={{ color: '#2563eb' }}>Applicable Registration Fees</label>
                                                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                                                    {regFees.map(fee => (
                                                        <div key={fee.id} style={{ background: 'white', padding: '10px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: '700' }}>
                                                            {fee.item_name}: <span style={{ color: '#10b981' }}>KES {fee.price.toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <section>
                                    <SectionHeader icon={FileText} title="Clinical Notes & Comments" />
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                                        <textarea name="notes" value={formData.notes} onChange={handleChange} className="input-field" rows="3" placeholder="Add any additional context or instructions..."></textarea>
                                    </div>
                                </section>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '20px', borderTop: '2px solid #f1f5f9', paddingTop: '48px' }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditMode(false);
                                            setFormData(initialFormState);
                                            navigate('/registrar/dashboard');
                                        }}
                                        style={{ padding: '18px 40px', borderRadius: '18px', border: '2px solid #e2e8f0', background: 'white', color: '#64748b', fontWeight: 800, cursor: 'pointer' }}>
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        style={{ padding: '18px 48px', borderRadius: '18px', background: '#2563eb', color: 'white', fontWeight: 900, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 15px 30px -5px rgba(37, 99, 235, 0.4)' }}>
                                        <Save size={24} /> {loading ? 'Saving...' : isEditMode ? 'Update Credentials' : 'Register Patient & Save'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>

                {/* LAB SELECTION MODAL */}
                {labModal && (
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, backdropFilter: 'blur(12px)', padding: '24px' }}>
                        <div style={{ background: 'white', width: '100%', maxWidth: '800px', borderRadius: '32px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', animation: 'fadeIn 0.3s ease-out' }}>
                            <div style={{ padding: '32px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#1e293b' }}>Select Lab Investigations</h3>
                                    <p style={{ color: '#64748b', fontWeight: 600 }}>Ordering tests for {selectedPatient?.pname}</p>
                                </div>
                                <button onClick={() => setLabModal(false)} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: '0.2s' }}><X size={20} /></button>
                            </div>
                            
                            <div style={{ padding: '32px', maxHeight: '500px', overflowY: 'auto' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    {catalog.map(test => (
                                        <div 
                                            key={test.id}
                                            onClick={() => {
                                                const isSelected = selectedTests.some(t => t.id === test.id);
                                                if (isSelected) setSelectedTests(selectedTests.filter(t => t.id !== test.id));
                                                else setSelectedTests([...selectedTests, test]);
                                            }}
                                            style={{
                                                padding: '20px',
                                                borderRadius: '20px',
                                                border: '3px solid',
                                                borderColor: selectedTests.some(t => t.id === test.id) ? '#2563eb' : '#f1f5f9',
                                                background: selectedTests.some(t => t.id === test.id) ? '#eff6ff' : 'white',
                                                cursor: 'pointer',
                                                transition: '0.2s',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '1.1rem' }}>{test.test_name}</div>
                                                <div style={{ color: '#10b981', fontWeight: 800 }}>KES {Number(test.price || 0).toLocaleString()}</div>
                                            </div>
                                            {selectedTests.some(t => t.id === test.id) && <CheckCircle size={24} color="#2563eb" />}
                                        </div>
                                    ))}
                                </div>
                                {selectedTests.length > 0 && (
                                    <div style={{ marginTop: '24px', padding: '20px', background: '#f0fdf4', borderRadius: '20px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#166534' }}>Total Order Cost ({selectedTests.length} tests)</span>
                                        <span style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>KES {selectedTests.reduce((sum, t) => sum + Number(t.price || 0), 0).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>

                            <div style={{ padding: '32px', borderTop: '2px solid #f1f5f9', display: 'flex', gap: '16px' }}>
                                <button
                                    onClick={() => setLabModal(false)}
                                    style={{ flex: 1, padding: '18px', borderRadius: '18px', border: '2px solid #e2e8f0', background: 'white', fontWeight: 800, cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendToLab}
                                    disabled={isBooking || selectedTests.length === 0}
                                    style={{ flex: 2, padding: '18px', borderRadius: '18px', background: '#2563eb', color: 'white', fontWeight: 900, border: 'none', cursor: 'pointer', opacity: selectedTests.length === 0 ? 0.5 : 1 }}>
                                    {isBooking ? 'Sending...' : `Order ${selectedTests.length} Tests`}
                                </button>
                            </div>
                        </div>
                    </div>
                )}


            <style>{`
                .label-text { display: block; font-size: 0.85rem; font-weight: 800; color: #475569; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
                .input-field { width: 100%; padding: 14px 20px; border: 2px solid #e2e8f0; border-radius: 14px; font-size: 1.05rem; outline: none; transition: 0.3s; box-sizing: border-box; font-weight: 500; }
                .input-field:focus { border-color: #2563eb; background: #fff; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};

export default RegistrarRegistration;
