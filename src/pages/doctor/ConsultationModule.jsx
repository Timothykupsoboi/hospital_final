// =============================================================
// FILE: ConsultationModule.jsx
// PURPOSE: React component / entry point for the eDoc Hospital
//          frontend. Part of the Vite + React SPA.
// =============================================================
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Save, AlertTriangle, Pill, FlaskConical, Clock, ChevronLeft,
    Plus, Trash2, Clipboard, Activity, FileText, User,
    Stethoscope, Thermometer, Heart, Wind, UserCheck,
    LogOut, Calendar, Info, ShieldCheck, MapPin, Search, PlusCircle, X, Scissors, Camera, BookOpen, Droplets, ClipboardCheck, Send, Lock, CheckCircle
} from 'lucide-react';
import ClinicalModal from '../../components/shared/ClinicalModal';
import { searchIcd10, searchMedicines, getLabCatalog } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const ConsultationModule = () => {
    const [searchParams] = useSearchParams();
    const appoid = searchParams.get('appoid');
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [patient, setPatient] = useState(null);
    const [appointment, setAppointment] = useState(null);
    const [history, setHistory] = useState([]);
    const [activeTab, setActiveTab] = useState('subjective');
    const [startTime] = useState(new Date());
    const [elapsedTime, setElapsedTime] = useState('00:00');
    const [clinicalModal, setClinicalModal] = useState({ open: false, title: '', message: '', type: 'info', onConfirm: null });
    const [ignoreLabGate, setIgnoreLabGate] = useState(false); // Gate bypass


    // Timer Effect
    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const diff = Math.floor((now - startTime) / 1000);
            const mins = Math.floor(diff / 60).toString().padStart(2, '0');
            const secs = (diff % 60).toString().padStart(2, '0');
            setElapsedTime(`${mins}:${secs}`);
        }, 1000);
        return () => clearInterval(timer);
    }, [startTime]);

    // --- FORM STATE ---

    // Subjective
    const [subjective, setSubjective] = useState({
        consultation_type: 'Initial',
        chief_complaints: [], // Changed from chief_complaint: ''
        hpi: '',
        pmh: '',
        surgical_history: '',
        family_history: '',
        social_history: '',
        obstetric_history: '',
        allergies_detailed: '',
        immunization_history: '',
        ros: '',
        symptoms: [] // Array to store multiple symptoms
    });

    // Mock Symptom Database
    const symptomDatabase = [
        "Fever", "Cough", "Headache", "Fatigue", "Nausea", "Vomiting",
        "Diarrhea", "Shortness of breath", "Chest pain", "Abdominal pain",
        "Joint pain", "Muscle ache", "Loss of appetite", "Chills", "Night sweats",
        "Dizziness", "Sore throat", "Runny nose", "Skin rash", "Itching",

        "Back pain", "Swelling", "Weight loss", "Weight gain", "Blurred vision",
        "Double vision", "Ear pain", "Hearing loss", "Sneezing", "Wheezing",
        "Palpitations", "Heartburn", "Constipation", "Frequent urination",
        "Painful urination", "Blood in urine", "Dry mouth", "Excessive thirst",
        "Cold intolerance", "Heat intolerance", "Hair loss", "Brittle nails",

        "Anxiety", "Depression", "Confusion", "Memory loss", "Insomnia",
        "Seizures", "Tremors", "Numbness", "Tingling sensation", "Weakness",

        "Eye redness", "Eye pain", "Sensitivity to light", "Nasal congestion",
        "Post-nasal drip", "Hoarseness", "Difficulty swallowing",

        "Leg pain", "Arm pain", "Neck pain", "Stiffness", "Cramps",
        "Difficulty walking", "Balance problems",

        "Bruising easily", "Bleeding gums", "Pale skin", "Yellowing of skin",
        "Swollen lymph nodes", "Slow wound healing",

        "Sexual dysfunction", "Irregular periods", "Heavy periods",
        "Pelvic pain", "Vaginal discharge",

        "Dry skin", "Oily skin", "Acne", "Burning sensation", "Pins and needles",

        "Loss of smell", "Loss of taste", "Excessive sweating",
        "Dehydration", "Fainting", "Restlessness"
    ];

    const [symptomSearch, setSymptomSearch] = useState('');
    const [symptomResults, setSymptomResults] = useState([]);
    const [showSymptomDropdown, setShowSymptomDropdown] = useState(false);

    useEffect(() => {

        if (!symptomSearch) {
            setSymptomResults([]);
            setShowSymptomDropdown(false);
            return;
        }
        const results = symptomDatabase.filter(s => s.toLowerCase().includes(symptomSearch.toLowerCase()));
        setSymptomResults(results);
        setShowSymptomDropdown(true);
    }, [symptomSearch]);

    const [newComplaint, setNewComplaint] = useState('');


    // Objective
    const [vitals, setVitals] = useState({
        temp: '', bp: '', heart_rate: '', spo2: '', weight: '', height: '',
        respiratory_rate: '', hb: '',
        bmi: '',
    });
    const [physicalExam, setPhysicalExam] = useState({});
    const [clinicalQuickPicks, setClinicalQuickPicks] = useState({
        general_appearance: ['Well-looking', 'Ill-looking', 'Pale', 'Jaundiced', 'Cyanosed', 'Dyspnoeic', 'Distressed', 'Febrile', 'Dehydrated', 'Cachectic', 'Obese'],
        head_neck: ['No lymphadenopathy', 'Thyroid not enlarged', 'JVP not raised', 'Supple neck', 'Trachea central'],
        heent: ['Pupils PERRLA', 'Conjunctiva clear', 'Sclera anicteric', 'Oropharynx clear', 'No nasal discharge'],
        cardiovascular: ['S1 S2 heard', 'No murmurs', 'Apex beat not displaced', 'No pedal edema'],
        respiratory: ['Vesicular breath sounds', 'No crepitations', 'No wheezing', 'Equal air entry'],
        abdomen: ['Soft, Non-tender', 'No organomegaly', 'Bowel sounds present', 'No masses'],
        neurological: ['GCS 15/15', 'Power 5/5', 'Tone normal', 'Reflexes 2+', 'Nerves intact'],
        musculoskeletal: ['Full ROM', 'No swelling', 'No deformities', 'Normal gait'],
        skin_integumentary: ['No rashes', 'No lesions', 'Warm and dry', 'Normal turgor'],
        psychiatric: ['Calm & cooperative', 'Oriented T/P/P', 'Euthymic mood', 'Appropriate affect'],
        pmh: ['Hypertension', 'Type 2 Diabetes', 'Asthma', 'Peptic Ulcer Disease', 'Epilepsy', 'HIV Reactive'],
        surgical_history: ['Appendectomy', 'C-Section', 'Hernia Repair', 'No past surgeries'],
        social_history: ['Non-smoker', 'Non-drinker', 'Social drinker', 'Occasional smoker'],
        allergies_detailed: ['Penicillin Allergy', 'Sulfa Allergy', 'No known allergies', 'Latex Allergy'],
        medication_history: ['On Anti-hypertensives', 'On Metformin', 'On ARTs', 'On Supplements'],
        ob_gyn_history: ['LMP: Normal', 'G1 P0', 'Irregular Cycles', 'Post-menopausal'],
        ros: ['Systemic: Normal', 'HEENT: Normal', 'Chest: Clear', 'Abd: Soft']
    });
    const [editMode, setEditMode] = useState({}); 
    const [selectedForDelete, setSelectedForDelete] = useState({});

    const addQuickPick = (category) => {
        const val = physicalExam[category];
        if (!val || clinicalQuickPicks[category].includes(val)) return;
        setClinicalQuickPicks({
            ...clinicalQuickPicks,
            [category]: [...clinicalQuickPicks[category], val]
        });
        showToast(`Added "${val}" to ${category}`, "success");
    };

    const deleteQuickPicks = (category) => {
        const remaining = clinicalQuickPicks[category].filter(opt => !selectedForDelete[`${category}-${opt}`]);
        setClinicalQuickPicks({
            ...clinicalQuickPicks,
            [category]: remaining
        });
        setEditMode({ ...editMode, [category]: false });
        setSelectedForDelete({});
        showToast("Findings removed", "info");
    };

    const toggleNumberedItem = (currentVal, opt, setter, state, key) => {
        let lines = (currentVal || '').split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
        if (lines.includes(opt)) {
            lines = lines.filter(l => l !== opt);
        } else {
            lines.push(opt);
        }
        const formatted = lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
        setter({ ...state, [key]: formatted });
    };

    const handleListKeyDown = (e, currentVal, setter, state, key) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const lines = (currentVal || '').split('\n').filter(l => l.trim() !== '');
            const nextNum = lines.length + 1;
            const newVal = (currentVal || '').trimEnd() + `\n${nextNum}. `;
            setter({ ...state, [key]: newVal });
        }
    };

    // Assessment
    const [assessment, setAssessment] = useState({
        primary_diagnosis_code: '',
        diagnosis: '',
        secondary_diagnoses: [],
        differential_diagnoses: [],
        clinical_impression: ''
    });

    // Plan
    const [prescriptions, setPrescriptions] = useState([]);
    const [newDrug, setNewDrug] = useState({
        id: null,
        drug_id: '',
        drug_name: '',
        brand_name: '',
        drug_form: 'Tablet',
        dosage: '500mg',
        frequency: 'Twice a day (BD) [1x2]',
        route: 'By Mouth (Oral)',
        duration: '5 days',
        quantity: '',
        refills: '0',
        food_relation: 'After Food',
        instructions: ''
    });
    const [labRequests, setLabRequests] = useState([]);
    const [labTracker, setLabTracker] = useState([]); // Live tracking of orders
    const [labReports, setLabReports] = useState([]);
    const [catalog, setCatalog] = useState([]); // Past/Finalized lab results
    const [technicians, setTechnicians] = useState([]);
    const [selectedTech, setSelectedTech] = useState(null);
    const [bundles, setBundles] = useState([]); // Clinical Protocols
    const [consultationRates, setConsultationRates] = useState([]);
    const [newLab, setNewLab] = useState({ test_name: '', urgency: 'Routine', clinical_indication: '', specimen_type: '', order_notes: '', price: 0 });

    // Modal States
    const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
    const [showLabModal, setShowLabModal] = useState(false);
    const [showProcedureModal, setShowProcedureModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [showLabResultsModal, setShowLabResultsModal] = useState(false);
    const [selectedLabResult, setSelectedLabResult] = useState(null);
    const [procedureCatalog, setProcedureCatalog] = useState([]);
    const [newProcedure, setNewProcedure] = useState({ procedure_name: '', notes: '', urgency: 'Routine', price: 0 });
    const [isSendingLab, setIsSendingLab] = useState(false);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
    };

    // Disposition
    const [disposition, setDisposition] = useState({
        status: 'Discharge',
        referral_specialty: '',
        referral_notes: '',
        follow_up_date: ''
    });

    // Additional Management States
    const [managementPlan, setManagementPlan] = useState('');
    const [imagingRequests, setImagingRequests] = useState([]);
    const [procedureOrders, setProcedureOrders] = useState([]);
    const [sentProcedures, setSentProcedures] = useState([]);
    const [patientEducation, setPatientEducation] = useState('');
    const [sickLeave, setSickLeave] = useState({ required: false, days: '', notes: '' });

    // ICD-10 Search State
    const [icdSearchTerm, setIcdSearchTerm] = useState('');
    const [icdResults, setIcdResults] = useState([]);
    const [showIcdDropdown, setShowIcdDropdown] = useState(false);
    const [isSearchingIcd, setIsSearchingIcd] = useState(false);

    // Medicine Search State
    const [medSearch, setMedSearch] = useState('');
    const [medResults, setMedResults] = useState([]);
    const [showMedDropdown, setShowMedDropdown] = useState(false);
    const [isSearchingMed, setIsSearchingMed] = useState(false);

    // --- Persistence Logic ---
    const persistenceKey = `consultation_draft_${appoid}`;

    // 1. Recovery on Mount
    useEffect(() => {
        const savedDraft = localStorage.getItem(persistenceKey);
        if (savedDraft) {
            try {
                const draft = JSON.parse(savedDraft);
                if (draft.subjective) setSubjective(draft.subjective);
                if (draft.vitals) setVitals(draft.vitals);
                if (draft.physicalExam) setPhysicalExam(draft.physicalExam);
                if (draft.assessment) setAssessment(draft.assessment);
                if (draft.prescriptions) setPrescriptions(draft.prescriptions);
                if (draft.labRequests) setLabRequests(draft.labRequests);
                if (draft.disposition) setDisposition(draft.disposition);
                if (draft.managementPlan) setManagementPlan(draft.managementPlan);
                if (draft.imagingRequests) setImagingRequests(draft.imagingRequests);
                if (draft.procedureOrders) setProcedureOrders(draft.procedureOrders);
                if (draft.patientEducation) setPatientEducation(draft.patientEducation);
                if (draft.sickLeave) setSickLeave(draft.sickLeave);

                // showToast("Previous draft recovered successfully.", "info");
            } catch (e) {
                console.error("Failed to recover draft", e);
            }
        }
    }, [appoid]);

    // Timer for "Time Waiting"
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // 2. Auto-Save Effect
    useEffect(() => {
        const draft = {
            subjective, vitals, physicalExam, assessment, prescriptions,
            labRequests, disposition, managementPlan, imagingRequests,
            procedureOrders, patientEducation, sickLeave
        };
        localStorage.setItem(persistenceKey, JSON.stringify(draft));
    }, [
        subjective, vitals, physicalExam, assessment, prescriptions,
        labRequests, disposition, managementPlan, imagingRequests,
        procedureOrders, patientEducation, sickLeave
    ]);

    // 3. Prevent Accidental Exit
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    useEffect(() => {
        if (icdSearchTerm.length < 2) {
            setIcdResults([]);
            setShowIcdDropdown(false);
            return;
        }

        const fetchResults = async () => {
            setIsSearchingIcd(true);
            try {
                const { data, error } = await searchIcd10(icdSearchTerm);
                if (error) {
                    console.error('Error fetching ICD-10 codes:', error.message);
                    return;
                }
                const mappedResults = data?.map(item => ({
                    code: item.code,
                    description: item.name
                })) || [];
                setIcdResults(mappedResults);
                setShowIcdDropdown(true);
            } catch (error) {
                console.error('Error fetching ICD-10 codes:', error);
            } finally {
                setIsSearchingIcd(false);
            }
        };

        const timer = setTimeout(fetchResults, 300);
        return () => clearTimeout(timer);
    }, [icdSearchTerm]);

    useEffect(() => {
        if (!medSearch || medSearch.length < 2) {
            setMedResults([]);
            setShowMedDropdown(false);
            return;
        }

        const fetchMeds = async () => {
            setIsSearchingMed(true);
            try {
                const { data, error } = await searchMedicines(medSearch);
                if (error) {
                    console.error('Error searching medicines:', error.message);
                    return;
                }
                setMedResults(data || []);
                setShowMedDropdown(true);
            } catch (error) {
                console.error('Error searching medicines:', error);
            } finally {
                setIsSearchingMed(false);
            }
        };

        const timer = setTimeout(fetchMeds, 300);
        return () => clearTimeout(timer);
    }, [medSearch]);

    // POS-Style Smart Quantity Calculator
    useEffect(() => {
        if (!newDrug.drug_name || !newDrug.frequency || !newDrug.duration) return;

        // Extract numeric days (e.g. "5 days" -> 5)
        const days = parseInt(newDrug.duration.replace(/[^0-9]/g, '')) || 0;

        // Map frequency to multiplier
        const freqMap = {
            'Once a day (OD)': 1,
            'Twice a day (BD)': 2,
            'Three times a day (TDS)': 3,
            'Four times a day (QID)': 4,
            'At Night': 1,
            'As needed (PRN)': 1,
            'Immediately (STAT)': 1
        };

        const multiplier = freqMap[newDrug.frequency] || 1;
        const total = days * multiplier;

        if (total > 0 && !newDrug.quantity) {
            setNewDrug(prev => ({ ...prev, quantity: `${total} ${prev.drug_form || 'Units'}` }));
        }
    }, [newDrug.frequency, newDrug.duration, newDrug.drug_name]);

    const handleSelectDiagnosis = (diag) => {
        if (!assessment.primary_diagnosis_code) {
            setAssessment({
                ...assessment,
                primary_diagnosis_code: diag.code,
                diagnosis: diag.description,
                diagnosis_details: diag // Store full object including chapter/category
            });
        } else {
            // Check if it already exists in primary or secondary
            if (assessment.primary_diagnosis_code === diag.code) return;
            if (assessment.secondary_diagnoses.find(d => d.code === diag.code)) return;

            setAssessment({
                ...assessment,
                secondary_diagnoses: [...assessment.secondary_diagnoses, diag]
            });
        }
        setIcdSearchTerm('');
        setShowIcdDropdown(false);
    };

    const handleRemovePrimaryDiagnosis = () => {
        // If there are secondary diagnoses, promote the first one to primary
        if (assessment.secondary_diagnoses.length > 0) {
            const nextPrimary = assessment.secondary_diagnoses[0];
            const remainingSecondary = assessment.secondary_diagnoses.slice(1);
            setAssessment({
                ...assessment,
                primary_diagnosis_code: nextPrimary.code,
                diagnosis: nextPrimary.description,
                diagnosis_details: nextPrimary,
                secondary_diagnoses: remainingSecondary
            });
        } else {
            setAssessment({
                ...assessment,
                primary_diagnosis_code: '',
                diagnosis: '',
                diagnosis_details: null
            });
        }
    };

    const handleRemoveSecondaryDiagnosis = (code) => {
        setAssessment({
            ...assessment,
            secondary_diagnoses: assessment.secondary_diagnoses.filter(d => d.code !== code)
        });
    };

    const fetchProcedures = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('pricing_matrix').select('*').eq('category', 'Procedure').eq('is_active', true);
            if (error) throw error;
            setProcedureCatalog(data || []);
            console.log('[Consultation] Loaded', data?.length || 0, 'procedures');
        } catch (e) { console.error("Procedures fetch failed", e); }
    }, []);

    const fetchCatalog = useCallback(async () => {
        try {
            const { data, error } = await getLabCatalog();
            if (error) throw error;
            setCatalog(data || []);
            console.log('[Consultation] Loaded', data?.length || 0, 'lab tests');
        } catch (e) {
            console.error("Catalog fetch failed:", e);
            showToast('Lab catalog unavailable. Check Supabase RLS.', 'error');
        }
    }, [getLabCatalog]);

    const fetchBundles = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('treatment_bundles').select('*').eq('is_active', 1);
            if (error) throw error;
            setBundles(data ? data.map(r => ({ ...r, items: typeof r.items === 'string' ? JSON.parse(r.items) : r.items || [] })) : []);
        } catch (e) { console.error("Bundles fetch failed", e); }
    }, []);

    const fetchTechnicians = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('lab_technician').select('labid, labname, user_id');
            if (error) throw error;
            setTechnicians(data || []);
            if (data?.length === 1) {
                setSelectedTech(data[0].user_id || data[0].labid);
            }
        } catch (e) { console.error("Techs fetch failed", e); }
    }, []);

    const fetchRates = useCallback(async () => {
        try {
            const { data, error } = await supabase.from('pricing_matrix').select('*').eq('category', 'Consultation').eq('is_active', true);
            if (error) throw error;
            setConsultationRates(data || []);
        } catch (e) { console.error("Rates fetch failed", e); }
    }, []);

    const applyProtocol = (bundle) => {
        const labsToAdd = bundle.items.filter(i => i.type === 'lab');
        const medsToAdd = bundle.items.filter(i => i.type === 'medicine');

        setLabRequests([...labRequests, ...labsToAdd.map(l => ({
            test_name: l.name,
            urgency: 'Routine',
            clinical_indication: `Protocol: ${bundle.name}. ${l.instructions || ''}`,
            id: Date.now() + Math.random()
        }))]);

        setPrescriptions([...prescriptions, ...medsToAdd.map(m => {
            // Try to parse dosage/frequency from instructions if they look like "500mg 1x3"
            const parts = (m.instructions || '').split(' ');
            return {
                drug_name: m.name,
                dosage: parts[0] || 'As per protocol',
                frequency: parts[1] || 'Once a day (OD) [1x1]',
                duration: '5 days',
                food_relation: 'After Food',
                route: 'By Mouth (Oral)',
                instructions: m.instructions || '',
                id: Date.now() + Math.random()
            };
        })]);

        showToast(`Applied Protocol: ${bundle.name}`, "success");
    };

    const availableLabs = catalog.filter(t => t.is_enabled).map(t => t.test_name);

    // BACKGROUND SYNC (REALTIME)
    useEffect(() => {
        if (!appoid || appoid === 'null') return;

        console.log('[Realtime] Initializing background sync for appoid:', appoid);

        // Subscribe to changes in the consultation draft
        const consultationChannel = supabase
            .channel(`consultation_sync_${appoid}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'consultations', 
                filter: `appointment_id=eq.${appoid}` 
            }, (payload) => {
                console.log('[Realtime] Consultation update detected', payload);
                refreshData();
            })
            .subscribe();

        // Subscribe to lab request changes (e.g. status updates from lab)
        const labChannel = supabase
            .channel(`lab_sync_${appoid}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'lab_requests', 
                filter: `appointment_id=eq.${appoid}` 
            }, (payload) => {
                console.log('[Realtime] Lab update detected', payload);
                refreshData();
            })
            .subscribe();

        // Subscribe to procedure changes (e.g. payment updates from registrar)
        const procedureChannel = supabase
            .channel(`proc_sync_${appoid}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'procedures', 
                filter: `appointment_id=eq.${appoid}` 
            }, (payload) => {
                console.log('[Realtime] Procedure update detected', payload);
                refreshData();
            })
            .subscribe();

        return () => {
            console.log('[Realtime] Cleaning up channels');
            supabase.removeChannel(consultationChannel);
            supabase.removeChannel(labChannel);
            supabase.removeChannel(procedureChannel);
        };
    }, [appoid]);

    useEffect(() => {
        refreshData();
        fetchCatalog();
        fetchBundles();
        fetchTechnicians();
        fetchRates();
        fetchProcedures();
    }, [appoid, navigate, fetchCatalog, fetchBundles, fetchTechnicians, fetchRates, fetchProcedures]);

    const refreshData = async () => {
        if (!appoid || appoid === 'null') {
            setLoading(false);
            return;
        }
        try {
            // Get Appointment & Patient Details
            const { data: apptData, error: apptError } = await supabase
                .from('appointment')
                .select('*, patient!inner(*)')
                .eq('appoid', appoid);

            if (apptError) throw apptError;
            const appointment = apptData?.[0];

            if (appointment && appointment.patient) {
                const patientData = appointment.patient;
                setPatient(patientData);
                setAppointment(appointment);

                // ENFORCE INTERFERENCE LOCK:
                // If status is 'in_consultation' and current user is Admin, block edits.
                // If status is 'Completed' or 'final', block edits for everyone.
                const userIsAdmin = profile?.role === 'a';
                if (appointment.status === 'in_consultation' && userIsAdmin) {
                    setIsReadOnly(true);
                } else if (appointment.status === 'Completed' || appointment.status === 'final') {
                    setIsReadOnly(true);
                } else {
                    setIsReadOnly(false);
                }

                // Pre-fill vitals from nursing if available
                setVitals({
                    temp: patientData.ptemp || '',
                    bp: patientData.pbp || '',
                    heart_rate: patientData.pheartrate || '',
                    respiratory_rate: patientData.prespiratory || '',
                    spo2: patientData.pspo2 || '',
                    weight: patientData.pweight || '',
                    height: patientData.pheight || '',
                    bmi: (patientData.pweight && patientData.pheight) ? (patientData.pweight / ((patientData.pheight / 100) ** 2)).toFixed(1) : ''
                });

                const { data: historyData } = await supabase
                    .from('consultations')
                    .select('id, consultation_date, diagnosis, clinical_impression')
                    .eq('pid', patientData.pid)
                    .order('consultation_date', { ascending: false })
                    .limit(5);
                setHistory(historyData || []);

                // Fetch Sent Procedures
                const { data: procData } = await supabase
                    .from('procedures')
                    .select('*')
                    .eq('appointment_id', Number(appoid));
                setSentProcedures(procData || []);

                // Get Existing Draft
                const { data: draftResults } = await supabase
                    .from('consultations')
                    .select('id, appointment_id, pid, docid, status, consultation_type, chief_complaint, symptoms, hpi, pmh, surgical_history, social_history, obstetric_history, immunization_history, ros, general_appearance, head_neck, eyes_ent, cardiovascular, respiratory, abdomen, neurological, musculoskeletal, skin, psychiatric, primary_diagnosis_code, diagnosis, secondary_diagnoses, differential_diagnoses, clinical_impression, management_plan, disposition')
                    .eq('appointment_id', appoid);

                const draftData = draftResults?.[0];

                if (draftData) {
                    const d = draftData;
                    setSubjective({
                        consultation_type: d.consultation_type || 'Initial',
                        chief_complaints: d.chief_complaint ? d.chief_complaint.split(', ') : [],
                        symptoms: d.symptoms ? d.symptoms.split(', ') : [],
                        hpi: d.hpi || '',
                        pmh: d.pmh || '',
                        surgical_history: d.surgical_history || '',
                        family_history: d.family_history || '',
                        social_history: d.social_history || '',
                        obstetric_history: d.obstetric_history || '',
                        allergies_detailed: d.allergies_detailed || '',
                        immunization_history: d.immunization_history || '',
                        ros: d.ros || ''
                    });
                    setPhysicalExam({
                        general_appearance: d.general_appearance || '',
                        head_neck: d.head_neck || '',
                        heent: d.eyes_ent || '',
                        cardiovascular: d.cardiovascular || '',
                        respiratory: d.respiratory || '',
                        abdomen: d.abdomen || '',
                        neurological: d.neurological || '',
                        musculoskeletal: d.musculoskeletal || '',
                        skin_integumentary: d.skin || '',
                        psychiatric: d.psychiatric || ''
                    });
                    setAssessment({
                        primary_diagnosis_code: d.primary_diagnosis_code || '',
                        diagnosis: d.diagnosis || '',
                        secondary_diagnoses: d.secondary_diagnoses ? JSON.parse(d.secondary_diagnoses) : [],
                        differential_diagnoses: d.differential_diagnoses ? JSON.parse(d.differential_diagnoses) : [],
                        clinical_impression: d.clinical_impression || ''
                    });
                    setManagementPlan(d.management_plan || '');
                    if (d.disposition) {
                        try { setDisposition(JSON.parse(d.disposition)); } catch (e) { }
                    }

                    // Fetch related draft data
                    const [{ data: draftPrescriptions }, { data: draftLabs }] = await Promise.all([
                        supabase.from('prescriptions').select('id, drug_name, dosage, frequency, duration').eq('consultation_id', d.id),
                        d.appointment_id
                          ? supabase.from('lab_requests').select('id, test_name, status').eq('appointment_id', d.appointment_id)
                          : Promise.resolve({ data: [] })
                    ]);

                    if (draftPrescriptions) {
                        setPrescriptions(draftPrescriptions.map(p => ({
                            ...p,
                            id: p.id || (Date.now() + Math.random())
                        })));
                    }
                    // Deliberately NOT loading draftLabs into labRequests. 
                    // labRequests is a temporary "shopping cart" for new orders. 
                    // Once saved to DB, they move to labTracker.
                }

                // Lab Tracker
                const { data: activeLabs, error: labsError } = await supabase
                    .from('lab_requests')
                    .select('id, test_name, status, created_at, appointment_id')
                    .eq('appointment_id', appoid);

                if (activeLabs && activeLabs.length > 0) {
                    setLabTracker(activeLabs);

                    // Fetch reports separately
                    const requestIds = activeLabs.map(l => l.id);
                    const { data: reportsData } = await supabase
                        .from('lab_reports')
                        .select('id, request_id, test_name, results, created_at')
                        .in('request_id', requestIds);

                    setLabReports(reportsData || []);
                }
            }
        } catch (err) {
            console.error("Failed to fetch patient data", err);
        } finally {
            setLoading(false);
        }
    };

    // Auto-save every 2 minutes
    useEffect(() => {
        if (!patient) return;
        const timer = setInterval(() => {
            saveProgress();
        }, 120000);
        return () => clearInterval(timer);
    }, [patient, subjective, physicalExam, assessment, managementPlan, prescriptions, labRequests]);

    const handleSelectMed = (med) => {
        const isExpired = new Date(med.expiry_date) < new Date();
        const isDepleted = med.stock_qty <= 0;

        if (isExpired) {
            setClinicalModal({
                open: true,
                type: 'warning',
                title: 'Expired Medication Warning',
                message: `WARNING: ${med.med_name} has EXPIRED (${med.expiry_date}). While you can still prescribe it for clinical reasons, please note the pharmacy will be blocked from dispensing it until it is replenished.`,
                onConfirm: () => {
                    setNewDrug({
                        ...newDrug,
                        drug_id: med.id,
                        drug_name: med.med_name,
                        brand_name: med.brand_name || '',
                        drug_form: med.med_type || 'Tablet',
                        dosage: med.dosage || '500mg',
                        frequency: 'Twice a day (BD) [1x2]',
                        duration: '5 days',
                        sell_price: med.selling_price,
                        stock: med.stock_qty,
                        food_relation: 'After Food'
                    });
                    setMedSearch(med.med_name);
                    setShowMedDropdown(false);
                }
            });
            return;
        }
        if (isDepleted) {
            showToast(`${med.med_name} is currently out of stock. The pharmacist will need to restock before dispensing.`, "info");
        }

        setNewDrug({
            ...newDrug,
            drug_id: med.id,
            drug_name: med.med_name,
            brand_name: med.brand_name || '',
            drug_form: med.med_type || 'Tablet',
            dosage: med.dosage || '500mg',
            frequency: 'Twice a day (BD) [1x2]',
            duration: '5 days',
            sell_price: med.selling_price,
            stock: med.stock_qty,
            food_relation: 'After Food'
        });
        setMedSearch(med.med_name);
        setShowMedDropdown(false);
    };

    // Handlers
    const handleAddDrug = () => {
        if (!newDrug.drug_name) {
            showToast("Please select or enter a medicine name first.", "error");
            return;
        }

        if (newDrug.id) {
            // Update existing
            setPrescriptions(prescriptions.map(p => p.id === newDrug.id ? { ...newDrug } : p));
        } else {
            // Add new
            setPrescriptions([...prescriptions, { ...newDrug, id: Date.now() }]);
        }

        setNewDrug({
            id: null,
            drug_id: '',
            drug_name: '',
            brand_name: '',
            drug_form: 'Tablet',
            dosage: '500mg',
            frequency: 'Twice a day (BD) [1x2]',
            route: 'By Mouth (Oral)',
            duration: '5 days',
            quantity: '',
            refills: '0',
            food_relation: 'After Food',
            instructions: ''
        });
        setMedSearch(''); // Clear the search bar
    };

    const handleEditDrug = (drug) => {
        setNewDrug({ ...drug });
        setMedSearch(drug.drug_name);
    };

    const handleAddLab = () => {
        if (!newLab.test_name) return;
        setLabRequests([...labRequests, { ...newLab, id: Date.now() }]);
        setNewLab({ test_name: '', clinical_indication: '', specimen_type: 'Blood', urgency: 'Routine', order_notes: '' });
        // showToast("Investigation added to visit plan.", "success"); // Removed to avoid modal clutter
    };


    const saveToSupabase = async (status, options = {}) => {
        const labsToSync = options.labOverride || labRequests;
        if (!patient || !profile) {
            showToast('Missing patient/doctor data. Refresh page.', 'error');
            return false;
        }
        try {
            console.log('[saveToSupabase] Starting save for status:', status, 'appoid:', appoid);

            // Build payload using only columns confirmed to exist in the consultations table.
            // Consolidate fields that don't have dedicated columns into the notes/hpi/clinical_impression fields.
            const chiefComplaints = [
                ...subjective.chief_complaints,
                ...subjective.symptoms
            ].join('; ');

            const consultationPayload = {
                appointment_id: Number(appoid), // Ensure integer
                pid: Number(patient.pid),       // Ensure integer
                docid: profile?.docid ? parseInt(profile.docid) : (appointment?.docid ? parseInt(appointment.docid) : null),
                consultation_date: new Date().toISOString(),
                status: status,
                consultation_type: subjective.consultation_type || 'Initial',
                chief_complaint: (subjective.chief_complaints || []).join(', '),
                symptoms: (subjective.symptoms || []).join(', '),
                hpi: subjective.hpi || '',
                pmh: subjective.pmh,
                surgical_history: subjective.surgical_history,
                family_history: subjective.family_history,
                social_history: subjective.social_history,
                obstetric_history: subjective.obstetric_history,
                immunization_history: subjective.immunization_history,
                ros: subjective.ros,
                general_appearance: physicalExam.general_appearance,
                head_neck: physicalExam.head_neck,
                eyes_ent: physicalExam.heent,
                cardiovascular: physicalExam.cardiovascular,
                respiratory: physicalExam.respiratory,
                abdomen: physicalExam.abdomen,
                neurological: physicalExam.neurological,
                musculoskeletal: physicalExam.musculoskeletal,
                skin: physicalExam.skin_integumentary,
                psychiatric: physicalExam.psychiatric,
                primary_diagnosis_code: assessment.primary_diagnosis_code,
                diagnosis: assessment.diagnosis,
                secondary_diagnoses: JSON.stringify(assessment.secondary_diagnoses || []),
                differential_diagnoses: JSON.stringify(assessment.differential_diagnoses || []),
                clinical_impression: assessment.clinical_impression,
                management_plan: managementPlan,
                disposition: JSON.stringify(disposition || {})
            };

            // 2. SAVE CONSULTATION (Check for existing record first to avoid 42P10 Upsert error)
            const { data: existingConsult } = await supabase
                .from('consultations')
                .select('id')
                .eq('appointment_id', Number(appoid))
                .maybeSingle();

            let consultId;
            if (existingConsult?.id) {
                const { data: updatedConsults, error: updateError } = await supabase
                    .from('consultations')
                    .update(consultationPayload)
                    .eq('id', existingConsult.id)
                    .select('id');
                
                if (updateError) throw updateError;
                consultId = updatedConsults?.[0]?.id;
            } else {
                const { data: insertedConsults, error: insertError } = await supabase
                    .from('consultations')
                    .insert([consultationPayload])
                    .select('id');
                
                if (insertError) throw insertError;
                consultId = insertedConsults?.[0]?.id;
            }

            if (!consultId) throw new Error('Failed to retrieve Consultation ID after save');
            console.log('[saveToSupabase] Consultation synced with ID:', consultId);

            // Prescriptions
            const { error: presDeleteError } = await supabase.from('prescriptions').delete().eq('consultation_id', consultId);
            if (presDeleteError) console.warn('Prescriptions cleanup warning:', presDeleteError.message);

            if (prescriptions.length > 0) {
                const rxPayload = prescriptions.map(p => ({
                    consultation_id: Number(consultId),
                    pid: Number(patient.pid),
                    docid: profile?.docid ? parseInt(profile.docid) : (appointment?.docid ? parseInt(appointment.docid) : null),
                    appointment_id: Number(appoid),
                    drug_name: p.drug_name,
                    dosage: p.dosage,
                    frequency: p.frequency,
                    duration: p.duration || '7 days',
                    date: new Date().toISOString().split('T')[0]
                }));
                const { error: presError } = await supabase.from('prescriptions').insert(rxPayload);
                if (presError) {
                    console.error('Prescriptions insert failed:', presError);
                    if (presError.message.includes('RLS')) showToast('Prescription save blocked (check RLS policies)', 'error');
                    else showToast(`Prescriptions failed: ${presError.message}`, 'error');
                } else {
                    console.log('[save] Saved', prescriptions.length, 'prescriptions');
                }
            }

            // Lab Requests - Only sync items that haven't been "sent" yet
            if (labsToSync.length > 0) {
                const labPayload = labsToSync.map(l => ({
                    consultation_id: Number(consultId),
                    appointment_id: Number(appoid),
                    test_name: l.test_name,
                    status: 'pending',
                    technician_id: selectedTech || null,
                    urgency: l.urgency || 'Routine',
                    clinical_indication: l.clinical_indication || '',
                    specimen_type: l.specimen_type || '',
                    order_notes: l.order_notes || '',
                    price: l.price || 0
                }));
                const { error: labError } = await supabase.from('lab_requests').insert(labPayload);
                if (!labError) {
                    console.log('[save] Sent', labsToSync.length, 'lab requests');
                    showToast(`✅ Sent ${labsToSync.length} lab order(s) successfully!`, 'success');
                    // Update appointment status to 'pending_lab' so Registrar sees them in the Lab tab
                    await supabase.from('appointment').update({ status: 'pending_lab' }).eq('appoid', Number(appoid));
                } else {
                    console.error('Lab requests insert failed:', labError);
                    showToast(`Lab orders failed: ${labError.message.substring(0, 100)}`, 'error');
                    return false;
                }
            }

            // Procedures
            if (procedureOrders.length > 0) {
                const procPayload = procedureOrders.map(p => ({
                    appointment_id: Number(appoid),
                    procedure_name: p.procedure_name,
                    price: Number(p.price) || 0,
                    is_paid: false,
                    docid: profile?.docid ? parseInt(profile.docid) : null
                }));
                const { error: procError } = await supabase.from('procedures').insert(procPayload);
                if (procError) {
                    console.error('Procedure insert failed:', procError);
                    showToast(`Procedure failed: ${procError.message}`, 'error');
                    return false;
                } else {
                    console.log('[save] Sent', procedureOrders.length, 'procedures');
                    showToast(`✅ ${procedureOrders.length} procedure(s) ordered successfully!`, 'success');
                }
            }

            // Vitals (no error handling needed - optional)
            const vitalsPayload = {
                consultation_id: Number(consultId),
                appoid: Number(appoid),
                pid: Number(patient.pid),
                temp: vitals.temp || null,
                bp: vitals.bp || null,
                heart_rate: vitals.heart_rate || null,
                respiratory_rate: vitals.respiratory_rate || null,
                spo2: vitals.spo2 || null,
                weight: vitals.weight || null,
                height: vitals.height || null,
                bmi: vitals.bmi || null
            };
            await supabase.from('vitals_records').delete().eq('consultation_id', consultId);
            await supabase.from('vitals_records').insert(vitalsPayload);

            if (status === 'final') {
                await supabase.from('appointment').update({ status: 'Completed' }).eq('appoid', Number(appoid));
            }
            return true;
        } catch (e) {
            console.error('[saveToSupabase] FULL ERROR:', e);
            const msg = e.message || (typeof e === 'object' ? JSON.stringify(e) : String(e));
            if (msg.includes('RLS') || msg.includes('policy') || msg.includes('permission')) {
                showToast('🚫 RLS Policy Error: Doctor cannot save requests. Fix in Supabase Dashboard.', 'error');
            } else if (msg.includes('Foreign key') || msg.includes('violates foreign key')) {
                showToast('Database FK error - Check doctor/patient IDs.', 'error');
            } else {
                showToast(`Save Error: ${msg.substring(0, 100)}`, 'error');
            }
            return false;
        }
    };

    const handleSaveDraft = async (redirect = true) => {
        const success = await saveToSupabase('draft');
        if (success) {
            if (redirect) {
                showToast("Draft saved successfully. Redirecting...", "success");
                navigate('/doctor/labs');
            }
        } else {
            showToast("Failed to save draft.", "error");
        }
    };

    const saveProgress = async () => {
        if (!patient) return false;
        const success = await saveToSupabase('draft');
        if (success) console.log("Background save complete");
        else console.error("Auto-save failed");
        return success;
    };

    const handleSendLabOrder = async (testItem = null) => {
        // If it's a specific test from the modal
        if (testItem && testItem.test_name) {
            // Explicitly build the list to avoid React state race conditions
            const updatedList = [...labRequests, { ...testItem, id: Date.now() }];
            setLabRequests(updatedList);

            setIsSendingLab(true);
            const success = await saveToSupabase('draft', { labOverride: updatedList });
            setIsSendingLab(false);
            if (success) {
                setLabRequests([]); // Clear after sending
                setShowLabModal(false);
                refreshData();
            }
        } else if (labRequests.length > 0) {
            // Sending all currently added but unsent tests
            setIsSendingLab(true);
            const success = await saveToSupabase('draft');
            setIsSendingLab(false);
            if (success) {
                setLabRequests([]);
                refreshData();
            }
        }
    };

    const handleSendProcedureOrder = async () => {
        if (procedureOrders.length === 0) return;
        setIsSendingLab(true);
        const success = await saveToSupabase('draft');
        setIsSendingLab(false);
        if (success) {
            setProcedureOrders([]);
            setShowProcedureModal(false);
            refreshData();
        }
    };

    const handleAddSymptom = (s) => {
        if (!subjective.symptoms.includes(s)) {
            setSubjective({ ...subjective, symptoms: [...subjective.symptoms, s] });
            setTimeout(saveProgress, 100);
        }
        setSymptomSearch('');
        setShowSymptomDropdown(false);
    };

    const handleRemoveSymptom = (s) => {
        setSubjective({ ...subjective, symptoms: subjective.symptoms.filter(item => item !== s) });
        setTimeout(saveProgress, 100);
    };

    const handleAddComplaint = () => {
        if (newComplaint.trim() && !subjective.chief_complaints.includes(newComplaint.trim())) {
            setSubjective({
                ...subjective,
                chief_complaints: [...subjective.chief_complaints, newComplaint.trim()]
            });
            setNewComplaint('');
            setTimeout(saveProgress, 100);
        }
    };

    const handleRemoveComplaint = (c) => {
        setSubjective({
            ...subjective,
            chief_complaints: subjective.chief_complaints.filter(item => item !== c)
        });
        setTimeout(saveProgress, 100);
    };

    const handleSave = async () => {
        const success = await saveToSupabase('final');
        if (success) {
            localStorage.removeItem(persistenceKey);
            showToast("Consultation completed successfully", "success");
            navigate('/doctor');
        } else {
            alert("Failed to save consultation.");
        }
    };

    if (loading) return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f1f5f9' }}>
            <div style={{ textAlign: 'center' }}>
                <Activity size={48} className="animate-pulse" style={{ color: '#2563eb', marginBottom: '16px' }} />
                <p>Opening Clinical Case File...</p>
            </div>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: '#f1f5f9' }}>
            <style>
                {`
                @keyframes critical-shake {
                    0%, 100% { transform: translateX(0); }
                    2%, 6%, 10% { transform: translateX(-3px); }
                    4%, 8% { transform: translateX(3px); }
                    15%, 100% { transform: translateX(0); }
                }
                .vital-critical-alert {
                    animation: critical-shake 2s infinite ease-in-out;
                    border-color: #ef4444 !important;
                    background: #fef2f2 !important;
                }
                `}
            </style>
                {/* Modern Clinical Header */}
                <header style={{
                    padding: '16px 32px',
                    background: 'white',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <button onClick={() => navigate('/doctor')} style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            border: '1px solid #e2e8f0', background: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', transition: '0.2s'
                        }}>
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            {patient ? (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b' }}>{patient.pname}</h2>
                                        <span style={{ padding: '2px 8px', background: '#e2e8f0', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>#{patient.patient_display_id || patient.pid}</span>
                                    </div>
                                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{patient.age}Y • {patient.pdob} • {patient.ptel}</p>
                                </>
                            ) : (
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#64748b' }}>No Patient Selected</h2>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        {patient && (
                            <>
                                <div style={{ textAlign: 'right', borderRight: '1px solid #e2e8f0', paddingRight: '16px' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Started At</div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                                <div style={{ textAlign: 'right', marginRight: '16px', borderRight: '1px solid #e2e8f0', paddingRight: '16px' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration</div>
                                    <div style={{
                                        fontSize: '0.9rem',
                                        fontWeight: '800',
                                        color: parseInt(elapsedTime.split(':')[0]) >= 20 ? '#ef4444' : '#2563eb',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <Clock size={14} /> {elapsedTime}
                                    </div>
                                </div>
                            </>
                        )}
                        <button 
                            onClick={saveProgress} 
                            disabled={!patient || isReadOnly} 
                            style={{
                                background: 'white', border: '1px solid #e2e8f0', padding: '12px 20px',
                                borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
                                fontWeight: '600', color: isReadOnly ? '#cbd5e1' : '#64748b', 
                                cursor: (patient && !isReadOnly) ? 'pointer' : 'not-allowed'
                            }}
                        >
                            <Clipboard size={18} /> Save Draft
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={!patient || isReadOnly} 
                            className="btn-primary" 
                            style={{
                                background: (patient && !isReadOnly) ? '#0f172a' : '#94a3b8', 
                                border: 'none', padding: '12px 24px',
                                borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
                                fontWeight: '600', color: 'white', 
                                cursor: (patient && !isReadOnly) ? 'pointer' : 'not-allowed',
                                opacity: isReadOnly ? 0.6 : 1
                            }}
                        >
                            <Save size={18} /> Finalize Encounter
                        </button>
                    </div>
                </header>

                {isReadOnly && (
                    <div style={{ background: '#fef2f2', borderBottom: '1px solid #fee2e2', padding: '10px 32px', display: 'flex', alignItems: 'center', gap: '12px', color: '#b91c1c' }}>
                        <AlertTriangle size={18} />
                        <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                            VIEW ONLY MODE: This session was started by a Doctor. Admin interference is disabled to prevent data loss.
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Sidebar: Patient Summary & Quick Access */}
                    <aside style={{
                        width: '320px',
                        background: 'white',
                        borderRight: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '2px 0 8px rgba(0,0,0,0.02)',
                        zIndex: 5
                    }}>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                            {!patient ? (
                                <div style={{ textAlign: 'center', paddingTop: '40px', color: '#94a3b8' }}>
                                    <User size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                    <p style={{ fontSize: '0.875rem' }}>Select a patient from the queue to see their summary.</p>
                                </div>
                            ) : (
                                <>
                                    <div style={{ marginBottom: '24px' }}>
                                        <h4 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Activity size={14} /> Triage Vitals
                                        </h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                            <div className={vitals.temp && (parseFloat(vitals.temp) > 37.5 || parseFloat(vitals.temp) < 35.0) ? 'vital-critical-alert' : ''} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', transition: '0.3s' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Temp</div>
                                                <div style={{ fontSize: '1rem', fontWeight: '800', color: vitals.temp ? (parseFloat(vitals.temp) > 37.5 ? '#ef4444' : parseFloat(vitals.temp) < 36.0 ? '#3b82f6' : '#1e293b') : '#1e293b' }}>
                                                    {vitals.temp || '--'}°C
                                                </div>
                                            </div>
                                            <div className={vitals.bp?.includes('/') && (parseInt(vitals.bp.split('/')[0]) > 140 || parseInt(vitals.bp.split('/')[1]) > 95 || parseInt(vitals.bp.split('/')[0]) < 90) ? 'vital-critical-alert' : ''} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', transition: '0.3s' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>BP</div>
                                                <div style={{ fontSize: '1rem', fontWeight: '800', color: vitals.bp?.includes('/') && (parseInt(vitals.bp.split('/')[0]) > 140 || parseInt(vitals.bp.split('/')[1]) > 90 || parseInt(vitals.bp.split('/')[0]) < 90) ? '#ef4444' : '#1e293b' }}>
                                                    {vitals.bp || '--/--'}
                                                </div>
                                            </div>
                                            <div className={vitals.heart_rate && (vitals.heart_rate > 110 || vitals.heart_rate < 50) ? 'vital-critical-alert' : ''} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', transition: '0.3s' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>HR</div>
                                                <div style={{ fontSize: '1rem', fontWeight: '800', color: vitals.heart_rate && (vitals.heart_rate > 100 || vitals.heart_rate < 60) ? '#ef4444' : '#1e293b' }}>
                                                    {vitals.heart_rate || '--'} <span style={{ fontSize: '0.7rem' }}>bpm</span>
                                                </div>
                                            </div>
                                            <div className={vitals.spo2 && vitals.spo2 < 92 ? 'vital-critical-alert' : ''} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', transition: '0.3s' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>SpO2</div>
                                                <div style={{ fontSize: '1rem', fontWeight: '800', color: vitals.spo2 && vitals.spo2 < 95 ? '#ef4444' : '#1e293b' }}>
                                                    {vitals.spo2 || '--'}%
                                                </div>
                                            </div>
                                            <div className={vitals.respiratory_rate && (vitals.respiratory_rate > 24 || vitals.respiratory_rate < 10) ? 'vital-critical-alert' : ''} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', transition: '0.3s' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>RR</div>
                                                <div style={{ fontSize: '1rem', fontWeight: '800', color: vitals.respiratory_rate && (vitals.respiratory_rate > 20 || vitals.respiratory_rate < 12) ? '#ef4444' : '#1e293b' }}>
                                                    {vitals.respiratory_rate || '--'} <span style={{ fontSize: '0.7rem' }}>/m</span>
                                                </div>
                                            </div>
                                            <div className={vitals.hb && (vitals.hb < 9 || vitals.hb > 19) ? 'vital-critical-alert' : ''} style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', transition: '0.3s' }}>
                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Hb</div>
                                                <div style={{ fontSize: '1rem', fontWeight: '800', color: vitals.hb && (vitals.hb < 12 || vitals.hb > 18) ? '#ef4444' : '#1e293b' }}>
                                                    {vitals.hb || '--'} <span style={{ fontSize: '0.7rem' }}>g/dL</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '24px' }}>
                                        <h4 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <AlertTriangle size={14} color="#ef4444" /> Risk Factors
                                        </h4>
                                        <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#991b1b', fontSize: '0.875rem' }}>
                                            <strong>Allergies:</strong> {patient.allergies || 'None recorded'}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Clock size={14} /> History
                                        </h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {history.length === 0 ? <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>No previous visits.</p> : history.map(h => (
                                                <div key={h.id} style={{ borderLeft: '2px solid #e2e8f0', paddingLeft: '12px' }}>
                                                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{h.consultation_date}</div>
                                                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#334155' }}>{h.diagnosis || 'General Checkup'}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </aside>

                    {/* Main Workspace: Clinical Tabs */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                        {/* Scrollable Content Area */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '32px', background: '#f8fafc', position: 'relative' }}>
                            {!patient && (
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(248, 250, 252, 0.8)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                                    <div style={{ textAlign: 'center', background: 'white', padding: '40px', borderRadius: '16px', border: '1px solid #e2e8f0', maxWidth: '400px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                                        <Stethoscope size={48} color="#2563eb" style={{ marginBottom: '20px' }} />
                                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '12px' }}>Workbench Ready</h3>
                                        <p style={{ color: '#64748b', marginBottom: '24px' }}>Please select a patient from the queue to start a clinical consultation session.</p>
                                        <button onClick={() => navigate('/doctor/appointments')} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                                            Open Queue
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div style={{ maxWidth: '950px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '64px', paddingBottom: '120px' }}>
                                <section id="subjective" style={{ scrollMarginTop: '20px' }}>
                                    {/* SOAP Guidance */}
                                    <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', border: '1px solid #dcfce7', display: 'flex', gap: '12px' }}>
                                        <Info size={20} color="#166534" />
                                        <p style={{ fontSize: '0.85rem', color: '#166534' }}>
                                            <strong>Subjective (S):</strong> Record the patient's own words. Focus on the Chief Complaint (why they are here) and the History of Presenting Illness (HPI).
                                        </p>
                                    </div>

                                    <div style={{ maxWidth: '400px' }}>
                                        <label className="label">Consultation Type</label>
                                        <select className="input-field" value={subjective.consultation_type} onChange={e => setSubjective({ ...subjective, consultation_type: e.target.value })}>
                                            <option>Initial</option><option>Follow-up</option><option>Review</option><option>Emergency</option><option>Ward Round</option>
                                        </select>
                                    </div>
                                    {/* Clinical Presentation Box */}
                                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                                            <Activity size={18} color="#2563eb" /> Patient Presentation & Symptoms
                                        </h3>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '24px' }}>
                                            {/* Database Search */}
                                            <div>
                                                <label className="label" style={{ color: '#2563eb' }}>Search Clinical Database</label>
                                                <div style={{ position: 'relative' }}>
                                                    <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                                        <Search size={18} />
                                                    </div>
                                                    <input
                                                        className="input-field"
                                                        style={{ paddingLeft: '40px' }}
                                                        placeholder="Search standard symptoms..."
                                                        value={symptomSearch}
                                                        onChange={e => setSymptomSearch(e.target.value)}
                                                    />
                                                    {showSymptomDropdown && (
                                                        <div style={{
                                                            position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0,
                                                            background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px',
                                                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', marginTop: '4px',
                                                            maxHeight: '180px', overflowY: 'auto'
                                                        }}>
                                                            {symptomResults.map(res => (
                                                                <div key={res} onClick={() => handleAddSymptom(res)} style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc' }} onMouseEnter={e => e.target.style.background = '#f0f9ff'} onMouseLeave={e => e.target.style.background = 'white'}>{res}</div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Manual Entry */}
                                            <div>
                                                <label className="label" style={{ color: '#64748b' }}>Other / Custom Entry</label>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <input
                                                        className="input-field"
                                                        value={newComplaint}
                                                        onChange={e => setNewComplaint(e.target.value)}
                                                        onKeyPress={e => e.key === 'Enter' && handleAddComplaint()}
                                                        placeholder="Type custom observation..."
                                                    />
                                                    <button
                                                        onClick={handleAddComplaint}
                                                        className="btn-primary"
                                                        style={{ background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', padding: '0 16px' }}
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Unified Tags Area */}
                                        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px dashed #e2e8f0' }}>
                                            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>Recorded Observations</span>
                                                <span>{subjective.chief_complaints.length + subjective.symptoms.length} items</span>
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                                                {/* Database Tags */}
                                                {subjective.symptoms.map(s => (
                                                    <span key={s} style={{
                                                        background: '#eff6ff', color: '#1e40af', padding: '6px 14px',
                                                        borderRadius: '100px', fontSize: '0.875rem', fontWeight: '600',
                                                        display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #dbeafe'
                                                    }}>
                                                        <ShieldCheck size={14} /> {s}
                                                        <X size={14} style={{ cursor: 'pointer' }} onClick={() => handleRemoveSymptom(s)} />
                                                    </span>
                                                ))}
                                                {/* Custom Tags */}
                                                {subjective.chief_complaints.map(c => (
                                                    <span key={c} style={{
                                                        background: 'white', color: '#334155', padding: '6px 14px',
                                                        borderRadius: '100px', fontSize: '0.875rem', fontWeight: '600',
                                                        display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #e2e8f0'
                                                    }}>
                                                        <PlusCircle size={14} /> {c}
                                                        <X size={14} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => handleRemoveComplaint(c)} />
                                                    </span>
                                                ))}
                                                {subjective.symptoms.length === 0 && subjective.chief_complaints.length === 0 && (
                                                    <span style={{ color: '#94a3b8', fontSize: '0.875rem', fontStyle: 'italic' }}>No observations recorded yet.</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {/* History & Background Box */}
                                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                                            <Clipboard size={18} color="#2563eb" /> Clinical History & Background
                                        </h3>

                                            {/* Clinical History Sections with Smart Quick-Picks */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                                {[
                                                    { label: 'Past Medical History (PMH)', key: 'pmh', stateKey: 'pmh' },
                                                    { label: 'Surgical History', key: 'surgical_history', stateKey: 'surgical_history' },
                                                    { label: 'Social & Family History', key: 'social_history', stateKey: 'social_history' },
                                                    { label: 'Allergies (Detailed)', key: 'allergies_detailed', stateKey: 'allergies_detailed' },
                                                    { label: 'Medication History', key: 'medication_history', stateKey: 'medication_history' },
                                                    { label: 'OB/GYN History', key: 'ob_gyn_history', stateKey: 'ob_gyn_history' },
                                                    { label: 'Review of Systems (ROS)', key: 'ros', stateKey: 'ros', fullWidth: true }
                                                ].map((section) => {
                                                    const currentVal = subjective[section.stateKey] || '';
                                                    const lines = currentVal.split('\n');
                                                    const lastLine = lines[lines.length - 1] || '';
                                                    const activeSearchTerm = lastLine.replace(/^\d+\.\s*/, '').toLowerCase();
                                                    
                                                    const filteredOptions = (clinicalQuickPicks[section.stateKey] || []).filter(opt => 
                                                        opt.toLowerCase().includes(activeSearchTerm)
                                                    );

                                                    return (
                                                        <div key={section.key} style={{ 
                                                            background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', 
                                                            display: 'flex', flexDirection: 'column',
                                                            gridColumn: section.fullWidth ? 'span 2' : 'span 1'
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                                <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                    {section.label}
                                                                </label>
                                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                                    <button 
                                                                        onClick={() => {
                                                                            const val = subjective[section.stateKey];
                                                                            if (!val || clinicalQuickPicks[section.stateKey].includes(val)) return;
                                                                            setClinicalQuickPicks({
                                                                                ...clinicalQuickPicks,
                                                                                [section.stateKey]: [...clinicalQuickPicks[section.stateKey], val]
                                                                            });
                                                                            showToast(`Added to ${section.label}`, "success");
                                                                        }}
                                                                        style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                                                                    >
                                                                        + Add
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setEditMode({ ...editMode, [section.stateKey]: !editMode[section.stateKey] })}
                                                                        style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                                                                    >
                                                                        {editMode[section.stateKey] ? 'Cancel' : 'Edit'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            <textarea 
                                                                className="input-field" 
                                                                rows={section.fullWidth ? 2 : 3}
                                                                value={subjective[section.stateKey] || ''} 
                                                                onChange={e => {
                                                                    setSubjective({ ...subjective, [section.stateKey]: e.target.value });
                                                                    e.target.style.height = 'auto';
                                                                    e.target.style.height = e.target.scrollHeight + 'px';
                                                                }} 
                                                                onKeyDown={e => handleListKeyDown(e, subjective[section.stateKey], setSubjective, subjective, section.stateKey)}
                                                                placeholder={`Type to search or record...`}
                                                                style={{ marginBottom: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', resize: 'vertical', minHeight: '60px' }}
                                                            />
                                                            
                                                            <div style={{ 
                                                                maxHeight: '120px', overflowY: 'auto', 
                                                                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '4px' 
                                                            }}>
                                                                {filteredOptions.length > 0 ? filteredOptions.map(opt => {
                                                                    const currentVal = subjective[section.stateKey] || '';
                                                                    const rawLines = currentVal.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim());
                                                                    const isSelected = rawLines.includes(opt);

                                                                    return (
                                                                        <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            {editMode[section.stateKey] && (
                                                                                <input 
                                                                                    type="checkbox" 
                                                                                    checked={!!selectedForDelete[`${section.stateKey}-${opt}`]} 
                                                                                    onChange={() => setSelectedForDelete({
                                                                                        ...selectedForDelete,
                                                                                        [`${section.stateKey}-${opt}`]: !selectedForDelete[`${section.stateKey}-${opt}`]
                                                                                    })}
                                                                                />
                                                                            )}
                                                                            <button 
                                                                                onClick={() => toggleNumberedItem(subjective[section.stateKey], opt, setSubjective, subjective, section.stateKey)}
                                                                                style={{ 
                                                                                    width: '100%', padding: '6px 8px', borderRadius: '6px', fontSize: '0.65rem', textAlign: 'left',
                                                                                    background: isSelected ? '#2563eb' : 'white',
                                                                                    color: isSelected ? 'white' : '#64748b',
                                                                                    border: '1px solid',
                                                                                    borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                                                                                    cursor: editMode[section.stateKey] ? 'default' : 'pointer', fontWeight: '600', transition: '0.2s',
                                                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                                                }}
                                                                                title={opt}
                                                                            >
                                                                                {opt}
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                }) : (
                                                                    <div style={{ gridColumn: 'span 3', fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>No matches found.</div>
                                                                )}
                                                            </div>

                                                            {editMode[section.stateKey] && Object.keys(selectedForDelete).some(k => k.startsWith(section.stateKey) && selectedForDelete[k]) && (
                                                                <button 
                                                                    onClick={() => {
                                                                        const remaining = clinicalQuickPicks[section.stateKey].filter(o => !selectedForDelete[`${section.stateKey}-${o}`]);
                                                                        setClinicalQuickPicks({ ...clinicalQuickPicks, [section.stateKey]: remaining });
                                                                        setEditMode({ ...editMode, [section.stateKey]: false });
                                                                        setSelectedForDelete({});
                                                                    }}
                                                                    style={{ marginTop: '12px', background: '#dc2626', color: 'white', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                                                >
                                                                    Delete Selected
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                    </div>

                                </section>
                                <section id="objective" style={{ scrollMarginTop: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {/* SOAP Guidance */}
                                    <div style={{ background: '#fdfaf1', padding: '16px', borderRadius: '8px', border: '1px solid #fef3c7', display: 'flex', gap: '12px' }}>
                                        <Info size={20} color="#92400e" />
                                        <p style={{ fontSize: '0.85rem', color: '#92400e' }}>
                                            <strong>Objective (O):</strong> Record measurable data. This includes vital signs (BP, Pulse, Temp) and your findings from the physical head-to-toe examination.
                                        </p>
                                    </div>

                                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={18} color="#2563eb" /> Vital Signs & Biometrics</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                            <div className={vitals.temp && (parseFloat(vitals.temp) > 37.5 || parseFloat(vitals.temp) < 35.0) ? 'vital-critical-alert' : ''} style={{ borderRadius: '8px', padding: '4px', transition: '0.3s' }}>
                                                <label className="label">Temp (°C)</label>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    value={vitals.temp}
                                                    onChange={e => setVitals({ ...vitals, temp: e.target.value.replace(/[^0-9.]/g, '') })}
                                                    onBlur={e => {
                                                        let val = e.target.value;
                                                        if (!val) return;
                                                        if (!val.includes('.')) {
                                                            if (val.length === 2) val = val + ".0";
                                                            else if (val.length === 3) val = val.substring(0, 2) + "." + val.substring(2);
                                                        }
                                                        setVitals({ ...vitals, temp: val });
                                                    }}
                                                    placeholder="36.5"
                                                    style={{
                                                        color: vitals.temp ? (parseFloat(vitals.temp) > 37.5 ? '#ef4444' : parseFloat(vitals.temp) < 36.0 ? '#3b82f6' : '#1e293b') : '#1e293b',
                                                        fontWeight: vitals.temp && (parseFloat(vitals.temp) > 37.5 || parseFloat(vitals.temp) < 36.0) ? '800' : '500',
                                                        background: 'transparent'
                                                    }}
                                                />
                                            </div>
                                            <div className={vitals.bp?.includes('/') && (parseInt(vitals.bp.split('/')[0]) > 140 || parseInt(vitals.bp.split('/')[1]) > 95 || parseInt(vitals.bp.split('/')[0]) < 90) ? 'vital-critical-alert' : ''} style={{ borderRadius: '8px', padding: '4px', transition: '0.3s' }}>
                                                <label className="label">BP (mmHg)</label>
                                                <input 
                                                    className="input-field" 
                                                    value={vitals.bp} 
                                                    onChange={e => {
                                                        const val = e.target.value.replace(/[^0-9/]/g, '');
                                                        setVitals({ ...vitals, bp: val });
                                                    }} 
                                                    onBlur={e => {
                                                        let val = e.target.value;
                                                        if (!val) return;
                                                        if (!val.includes('/')) {
                                                            if (val.length === 5) val = val.substring(0, 3) + "/" + val.substring(3);
                                                            else if (val.length === 4) val = val.substring(0, 2) + "/" + val.substring(2);
                                                            else {
                                                                showToast("⚠️ Invalid BP format. Must be Systolic/Diastolic (e.g., 120/80)", "warning");
                                                            }
                                                        }
                                                        setVitals({ ...vitals, bp: val });
                                                    }}
                                                    placeholder="120/80"
                                                    style={{
                                                        color: vitals.bp?.includes('/') && (parseInt(vitals.bp.split('/')[0]) > 140 || parseInt(vitals.bp.split('/')[1]) > 90 || parseInt(vitals.bp.split('/')[0]) < 90) ? '#ef4444' : '#1e293b',
                                                        fontWeight: vitals.bp?.includes('/') && (parseInt(vitals.bp.split('/')[0]) > 140 || parseInt(vitals.bp.split('/')[1]) > 90 || parseInt(vitals.bp.split('/')[0]) < 90) ? '800' : '500',
                                                        background: 'transparent'
                                                    }}
                                                />
                                                <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>Format: SYS/DIA (e.g. 120/80)</div>
                                            </div>
                                            <div className={vitals.heart_rate && (vitals.heart_rate > 110 || vitals.heart_rate < 50) ? 'vital-critical-alert' : ''} style={{ borderRadius: '8px', padding: '4px', transition: '0.3s' }}>
                                                <label className="label">HR (bpm)</label>
                                                <input 
                                                    type="number" 
                                                    className="input-field" 
                                                    value={vitals.heart_rate} 
                                                    onChange={e => setVitals({ ...vitals, heart_rate: e.target.value })} 
                                                    placeholder="72" 
                                                    style={{
                                                        color: vitals.heart_rate && (vitals.heart_rate > 100 || vitals.heart_rate < 60) ? '#ef4444' : '#1e293b',
                                                        fontWeight: vitals.heart_rate && (vitals.heart_rate > 100 || vitals.heart_rate < 60) ? '800' : '500',
                                                        background: 'transparent'
                                                    }}
                                                />
                                            </div>
                                            <div className={vitals.spo2 && vitals.spo2 < 92 ? 'vital-critical-alert' : ''} style={{ borderRadius: '8px', padding: '4px', transition: '0.3s' }}>
                                                <label className="label">SpO2 (%)</label>
                                                <input 
                                                    type="number" 
                                                    className="input-field" 
                                                    value={vitals.spo2} 
                                                    onChange={e => setVitals({ ...vitals, spo2: e.target.value })} 
                                                    placeholder="98" 
                                                    style={{
                                                        color: vitals.spo2 && vitals.spo2 < 95 ? '#ef4444' : '#1e293b',
                                                        fontWeight: vitals.spo2 && vitals.spo2 < 95 ? '800' : '500',
                                                        background: 'transparent'
                                                    }}
                                                />
                                            </div>
                                            <div className={vitals.respiratory_rate && (vitals.respiratory_rate > 24 || vitals.respiratory_rate < 10) ? 'vital-critical-alert' : ''} style={{ borderRadius: '8px', padding: '4px', transition: '0.3s' }}>
                                                <label className="label">Resp Rate (/min)</label>
                                                <input 
                                                    type="number" 
                                                    className="input-field" 
                                                    value={vitals.respiratory_rate} 
                                                    onChange={e => setVitals({ ...vitals, respiratory_rate: e.target.value })} 
                                                    placeholder="16" 
                                                    style={{
                                                        color: vitals.respiratory_rate && (vitals.respiratory_rate > 20 || vitals.respiratory_rate < 12) ? '#ef4444' : '#1e293b',
                                                        fontWeight: vitals.respiratory_rate && (vitals.respiratory_rate > 20 || vitals.respiratory_rate < 12) ? '800' : '500',
                                                        background: 'transparent'
                                                    }}
                                                />
                                            </div>
                                            <div className={vitals.hb && (vitals.hb < 9 || vitals.hb > 19) ? 'vital-critical-alert' : ''} style={{ borderRadius: '8px', padding: '4px', transition: '0.3s' }}>
                                                <label className="label">Hb (g/dL)</label>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    value={vitals.hb}
                                                    onChange={e => setVitals({ ...vitals, hb: e.target.value.replace(/[^0-9.]/g, '') })}
                                                    onBlur={e => {
                                                        let val = e.target.value;
                                                        if (!val) return;
                                                        if (!val.includes('.')) {
                                                            if (val.length === 2) val = val + ".0";
                                                            else if (val.length === 3) val = val.substring(0, 2) + "." + val.substring(2);
                                                        }
                                                        setVitals({ ...vitals, hb: val });
                                                    }}
                                                    placeholder="13.5"
                                                    style={{
                                                        color: vitals.hb ? (parseFloat(vitals.hb) < 12.0 ? '#ef4444' : parseFloat(vitals.hb) > 18.0 ? '#ef4444' : '#1e293b') : '#1e293b',
                                                        fontWeight: vitals.hb && (parseFloat(vitals.hb) < 12.0 || parseFloat(vitals.hb) > 18.0) ? '800' : '500',
                                                        background: 'transparent'
                                                    }}
                                                />
                                            </div>
                                            <div><label className="label">Weight (kg)</label><input type="number" className="input-field" value={vitals.weight} onChange={e => setVitals({ ...vitals, weight: e.target.value })} placeholder="70" /></div>
                                            <div><label className="label">Height (cm)</label><input type="number" className="input-field" value={vitals.height} onChange={e => setVitals({ ...vitals, height: e.target.value })} placeholder="170" /></div>
                                        </div>
                                    </div>

                                    <div style={{ background: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '20px' }}>Systemic Physical Examination</h3>
                                        
                                        {/* Systemic Physical Examination with Smart Quick-Picks & Management */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                            {[
                                                { label: 'General Appearance', key: 'general_appearance' },
                                                { label: 'Head & Neck', key: 'head_neck' },
                                                { label: 'HEENT (Eyes/Ears/Nose/Throat)', key: 'heent' },
                                                { label: 'Cardiovascular (Heart)', key: 'cardiovascular' },
                                                { label: 'Respiratory (Lungs)', key: 'respiratory' },
                                                { label: 'Abdomen (Palpation)', key: 'abdomen' },
                                                { label: 'Neurological', key: 'neurological' },
                                                { label: 'Musculoskeletal', key: 'musculoskeletal' },
                                                { label: 'Skin & Integumentary', key: 'skin_integumentary' },
                                                { label: 'Psychiatric', key: 'psychiatric' }
                                            ].map((section) => {
                                                const currentVal = physicalExam[section.key] || '';
                                                const lines = currentVal.split('\n');
                                                const lastLine = lines[lines.length - 1] || '';
                                                const activeSearchTerm = lastLine.replace(/^\d+\.\s*/, '').toLowerCase();

                                                const filteredOptions = clinicalQuickPicks[section.key].filter(opt => 
                                                    opt.toLowerCase().includes(activeSearchTerm)
                                                );

                                                return (
                                                    <div key={section.key} style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                            <label style={{ fontSize: '0.8rem', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                {section.label}
                                                            </label>
                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <button 
                                                                    onClick={() => addQuickPick(section.key)}
                                                                    title="Save current text as quick pick"
                                                                    style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                                                                >
                                                                    + Add
                                                                </button>
                                                                <button 
                                                                    onClick={() => setEditMode({ ...editMode, [section.key]: !editMode[section.key] })}
                                                                    style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                                                                >
                                                                    {editMode[section.key] ? 'Cancel' : 'Edit'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <textarea 
                                                            className="input-field" 
                                                            rows={1}
                                                            value={physicalExam[section.key] || ''} 
                                                            onChange={e => {
                                                                setPhysicalExam({ ...physicalExam, [section.key]: e.target.value });
                                                                e.target.style.height = 'auto';
                                                                e.target.style.height = e.target.scrollHeight + 'px';
                                                            }} 
                                                            onKeyDown={e => handleListKeyDown(e, physicalExam[section.key], setPhysicalExam, physicalExam, section.key)}
                                                            placeholder={`Type to search or record...`}
                                                            style={{ 
                                                                marginBottom: '12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                                                                minHeight: '60px', resize: 'vertical', padding: '10px'
                                                            }}
                                                        />
                                                        
                                                        <div style={{ maxHeight: '100px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '4px' }}>
                                                            {filteredOptions.length > 0 ? filteredOptions.map(opt => {
                                                                const currentVal = physicalExam[section.key] || '';
                                                                const rawLines = currentVal.split('\n').map(l => l.replace(/^\d+\.\s*/, '').trim());
                                                                const isSelected = rawLines.includes(opt);

                                                                return (
                                                                    <div key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                        {editMode[section.key] && (
                                                                            <input 
                                                                                type="checkbox" 
                                                                                checked={!!selectedForDelete[`${section.key}-${opt}`]} 
                                                                                onChange={() => setSelectedForDelete({
                                                                                    ...selectedForDelete,
                                                                                    [`${section.key}-${opt}`]: !selectedForDelete[`${section.key}-${opt}`]
                                                                                })}
                                                                            />
                                                                        )}
                                                                        <button 
                                                                            onClick={() => toggleNumberedItem(physicalExam[section.key], opt, setPhysicalExam, physicalExam, section.key)}
                                                                            style={{ 
                                                                                padding: '5px 10px', borderRadius: '6px', fontSize: '0.7rem', 
                                                                                background: isSelected ? '#2563eb' : 'white',
                                                                                color: isSelected ? 'white' : '#64748b',
                                                                                border: '1px solid',
                                                                                borderColor: isSelected ? '#2563eb' : '#e2e8f0',
                                                                                cursor: editMode[section.key] ? 'default' : 'pointer', fontWeight: '600', transition: '0.2s',
                                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                                            }}
                                                                        >
                                                                            {opt}
                                                                        </button>
                                                                    </div>
                                                                );
                                                            }) : (
                                                                <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic' }}>No matching findings. Click "+ Add" to save this.</div>
                                                            )}
                                                        </div>

                                                        {editMode[section.key] && Object.keys(selectedForDelete).some(k => k.startsWith(section.key) && selectedForDelete[k]) && (
                                                            <button 
                                                                onClick={() => deleteQuickPicks(section.key)}
                                                                style={{ marginTop: '12px', background: '#dc2626', color: 'white', border: 'none', padding: '6px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                                                            >
                                                                Delete Selected
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                </section>

                                <section id="investigations" style={{ scrollMarginTop: '20px', display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <FlaskConical size={20} color="#0891b2" /> Laboratory Investigations
                                        </h3>
                                    </div>

                                    {/* Render Lab Reports (Inline display) */}
                                    {labReports.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {labReports.map((report, i) => {
                                                let resultsObj = {};
                                                try {
                                                    resultsObj = typeof report.results === 'string' ? JSON.parse(report.results) : (report.results || {});
                                                } catch (e) { }
                                                return (
                                                    <div key={i} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                                        <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <div>
                                                                <div style={{ fontWeight: '800', color: '#1e293b' }}>{report.test_name}</div>
                                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Finalized: {new Date(report.created_at).toLocaleString()}</div>
                                                            </div>
                                                            <div style={{ background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700' }}>COMPLETED</div>
                                                        </div>
                                                        <div style={{ padding: '0' }}>
                                                            <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: '1px solid #e2e8f0' }}>
                                                                <thead>
                                                                    <tr style={{ background: '#f8fafc' }}>
                                                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Parameter</th>
                                                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Result</th>
                                                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Units</th>
                                                                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Ref Range</th>
                                                                        <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {Object.entries(resultsObj).map(([key, val], idx) => {
                                                                        const isComplex = typeof val === 'object' && val !== null;
                                                                        const resVal = isComplex ? val.value : val;
                                                                        const resUnit = isComplex ? val.unit : '--';
                                                                        const resRef = isComplex ? val.ref : '--';
                                                                        const resStatus = isComplex ? (val.status || 'Normal') : 'Normal';

                                                                        const getStatusColor = (s) => {
                                                                            const low = s.toLowerCase();
                                                                            if (low.includes('critical') || low.includes('high')) return '#ef4444';
                                                                            if (low.includes('low')) return '#3b82f6';
                                                                            if (low.includes('reactive') && !low.includes('non')) return '#f59e0b';
                                                                            return '#10b981';
                                                                        };

                                                                        return (
                                                                            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fcfdfe' }}>
                                                                                <td style={{ padding: '10px 16px', fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>
                                                                                    {key === 'undefined' || key.trim() === '' ? 'Unnamed Parameter' : key}
                                                                                </td>
                                                                                <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '0.9rem', fontWeight: '800', color: '#0f172a' }}>{resVal}</td>
                                                                                <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>{resUnit}</td>
                                                                                <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>{resRef}</td>
                                                                                <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: '0.75rem', fontWeight: '900', color: getStatusColor(resStatus) }}>
                                                                                    {resStatus.toUpperCase()}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                            {report.notes && (
                                                                <div style={{ padding: '12px 16px', background: '#fffbeb', borderTop: '1px solid #fde68a', fontSize: '0.8rem', color: '#b45309' }}>
                                                                    <strong>Tech Notes:</strong> {report.notes}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        labTracker.length === 0 && <div style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1', color: '#64748b', fontSize: '0.9rem' }}>No past or completed lab results found for this patient.</div>
                                    )}

                                    {labRequests.length > 0 && (
                                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Selected for Order ({labRequests.length})</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                                {labRequests.map((l, i) => (
                                                    <div key={i} style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '2px dashed #cbd5e1', position: 'relative' }}>
                                                        <button onClick={() => setLabRequests(labRequests.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                                        <div style={{ fontWeight: '800', color: '#475569', fontSize: '0.9rem' }}>{l.test_name}</div>
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>{l.urgency} • {l.specimen_type}</div>
                                                        <div style={{ marginTop: '8px', fontSize: '0.8rem', fontWeight: '800', color: '#10b981' }}>KES {Number(l.price || 0).toLocaleString()}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={() => {
                                            if (labTracker.length > 0 || labReports.length > 0 || labRequests.length > 0) {
                                                setNewLab({ test_name: '', urgency: 'Urgent', clinical_indication: 'ADDITIONAL/FOLLOW-UP TEST: Required based on preliminary findings.', specimen_type: '', order_notes: '' });
                                            }
                                            setShowLabModal(true);
                                        }}
                                        style={{
                                            marginTop: '24px',
                                            width: '100%',
                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            padding: '24px',
                                            borderRadius: '24px',
                                            border: 'none',
                                            color: 'white',
                                            fontWeight: '800',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '15px',
                                            boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)',
                                            transition: '0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '16px' }}>
                                            <FlaskConical size={24} />
                                        </div>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontSize: '1.1rem' }}>{labRequests.length > 0 ? 'Review & Order Tests' : 'Request Laboratory Tests'}</div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{labRequests.length} test(s) currently selected</div>
                                        </div>
                                    </button>

                                    {/* Lab Order Tracker (Pending) */}
                                    {labTracker.filter(l => l.status !== 'completed').length > 0 && (
                                        <div style={{ marginTop: '0', padding: '20px', background: '#f0fdf4', borderRadius: '16px', border: '1px solid #bbf7d0' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                                <Activity size={18} color="#10b981" />
                                                <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800', color: '#065f46', textTransform: 'uppercase' }}>Live Laboratory Status</h4>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {labTracker.filter(l => l.status !== 'completed').map((lab, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px 16px', borderRadius: '10px', border: lab.is_paid ? '1px solid #dcfce7' : '1px solid #fee2e2' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '0.9rem' }}>{lab.test_name}</div>
                                                                {lab.is_paid ? (
                                                                    <span style={{ fontSize: '0.65rem', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                        <CheckCircle size={10} /> PAID
                                                                    </span>
                                                                ) : (
                                                                    <span style={{ fontSize: '0.65rem', background: '#fef2f2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                        <Lock size={10} /> PENDING PAYMENT
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', gap: '12px', marginTop: '2px' }}>
                                                                <span style={{ fontWeight: '700', color: '#10b981' }}>KES {Number(lab.price || 0).toLocaleString()}</span>
                                                                <span>Ordered at {new Date(lab.created_at).toLocaleTimeString()}</span>
                                                                <span style={{ color: lab.is_paid ? '#0891b2' : '#94a3b8', fontWeight: '700' }}>
                                                                    ({Math.floor((currentTime - new Date(lab.created_at)) / 60000)} mins waiting)
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: lab.is_paid ? '#0891b2' : '#94a3b8', fontSize: '0.75rem', fontWeight: '700' }}>
                                                            {lab.is_paid ? (
                                                                <>
                                                                    <div className="pulse" style={{ width: '8px', height: '8px', background: '#0891b2', borderRadius: '50%' }}></div>
                                                                    {lab.status === 'pending' ? 'WAITING FOR SAMPLE' : (lab.status === 'processing' ? 'PROCESSING...' : lab.status.toUpperCase())}
                                                                </>
                                                            ) : (
                                                                <span style={{ color: '#ef4444' }}>AWAITING CLEARANCE</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {labRequests.length > 0 && (
                                        <div style={{ marginTop: '24px', padding: '24px', background: '#f0fdf4', borderRadius: '16px', border: '2px solid #bbf7d0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                <div style={{ fontSize: '0.85rem', fontWeight: '800', color: '#065f46', textTransform: 'uppercase' }}>
                                                    📋 {labRequests.length} LAB ORDER(S) READY TO SEND
                                                </div>
                                            </div>
                                            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {labRequests.map((l, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'white', borderRadius: '12px', borderLeft: '4px solid #10b981' }}>
                                                        <div>
                                                            <div style={{ fontWeight: '700', color: '#1e293b' }}>{l.test_name}</div>
                                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                                {l.urgency} • {l.specimen_type} • {l.clinical_indication?.substring(0, 60)}...
                                                            </div>
                                                        </div>
                                                        <button onClick={() => setLabRequests(labRequests.filter((_, idx) => idx !== i))} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }} title="Remove">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (isSendingLab) return;
                                                    if (technicians.length > 1 && !selectedTech) {
                                                        showToast("Please select a technician in the Lab Modal before sending.", "error");
                                                        setShowLabModal(true);
                                                        return;
                                                    }
                                                    instantSendLab();
                                                }}
                                                disabled={isSendingLab}
                                                style={{
                                                    width: '100%',
                                                    background: isSendingLab ? '#94a3b8' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                                    color: 'white',
                                                    padding: '16px',
                                                    borderRadius: '12px',
                                                    border: 'none',
                                                    fontWeight: '800',
                                                    fontSize: '1rem',
                                                    cursor: isSendingLab ? 'not-allowed' : 'pointer',
                                                    boxShadow: isSendingLab ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.4)',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '12px'
                                                }}
                                                onMouseEnter={e => { if (!isSendingLab) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                                onMouseLeave={e => { if (!isSendingLab) e.currentTarget.style.transform = 'translateY(0)'; }}
                                            >
                                                {isSendingLab ? (
                                                    <>
                                                        <div className="animate-spin" style={{ width: '20px', height: '20px', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }}></div>
                                                        Sending...
                                                    </>
                                                ) : (
                                                    <>Send to lab</>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </section>
                                {/* PROCEDURES STATUS SECTION */}
                                <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <Scissors size={20} color="#6366f1" /> Minor Theatre & Procedures
                                        </h3>
                                        <button 
                                            onClick={() => setShowProcedureModal(true)}
                                            style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Plus size={16} /> Manage Procedures
                                        </button>
                                    </div>
                                    
                                    {(sentProcedures.length > 0 || procedureOrders.length > 0) ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                                            {/* FINALIZED PROCEDURES */}
                                            {sentProcedures.map((proc) => (
                                                <div key={proc.id} style={{ background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', transition: '0.2s' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: '900', color: '#0f172a', fontSize: '1.05rem', lineHeight: '1.2' }}>{proc.procedure_name}</div>
                                                            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', marginTop: '4px' }}>Finalized Order</div>
                                                        </div>
                                                        <div style={{ 
                                                            fontSize: '0.7rem', padding: '6px 12px', borderRadius: '20px', fontWeight: '900',
                                                            background: proc.is_paid ? '#ecfdf5' : '#fef2f2',
                                                            color: proc.is_paid ? '#059669' : '#dc2626',
                                                            border: `1px solid ${proc.is_paid ? '#10b981' : '#ef4444'}`,
                                                            textTransform: 'uppercase', letterSpacing: '0.5px'
                                                        }}>
                                                            {proc.is_paid ? 'PAID' : 'UNPAID'}
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#475569', background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #f1f5f9', minHeight: '50px', marginBottom: '16px' }}>
                                                        {proc.notes || 'No specific clinical instructions provided.'}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#1e293b' }}>{proc.urgency?.toUpperCase()}</span>
                                                        <div style={{ fontSize: '1.1rem', fontWeight: '900', color: '#10b981' }}>KES {Number(proc.price || 0).toLocaleString()}</div>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* DRAFT PROCEDURES */}
                                            {procedureOrders.map((p, i) => (
                                                <div key={`draft-${i}`} style={{ background: '#f8fafc', borderRadius: '20px', border: '2px dashed #cbd5e1', padding: '24px', position: 'relative' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: '900', color: '#475569', fontSize: '1.05rem' }}>{p.procedure_name}</div>
                                                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginTop: '4px' }}>Draft Item</div>
                                                        </div>
                                                        <button onClick={() => setProcedureOrders(procedureOrders.filter((_, idx) => idx !== i))} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer' }}>
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', marginBottom: '16px' }}>
                                                        {p.notes || 'No notes added yet.'}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.75rem', fontWeight: '800', color: '#94a3b8' }}>{p.urgency?.toUpperCase()}</span>
                                                        <div style={{ fontSize: '1rem', fontWeight: '800', color: '#94a3b8' }}>KES {Number(p.price || 0).toLocaleString()}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '60px 20px', border: '2px dashed #e2e8f0', borderRadius: '24px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc' }}>
                                            <Scissors size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                                            <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>No surgical procedures requested for this session.</div>
                                        </div>
                                    )}

                                    {procedureOrders.length > 0 && (
                                        <button
                                            onClick={handleSendProcedureOrder}
                                            disabled={isSendingLab}
                                            style={{
                                                marginTop: '16px',
                                                width: '100%',
                                                background: '#0f172a',
                                                color: 'white',
                                                border: 'none',
                                                padding: '20px',
                                                borderRadius: '20px',
                                                fontWeight: '800',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '10px',
                                                boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.2)'
                                            }}
                                        >
                                            {isSendingLab ? 'SAVING...' : <><CheckCircle size={20} /> FINALIZE {procedureOrders.length} PROCEDURE(S)</>}
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setShowProcedureModal(true)}
                                        style={{
                                            marginTop: procedureOrders.length > 0 ? '12px' : '24px',
                                            width: '100%',
                                            background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                                            padding: '24px',
                                            borderRadius: '24px',
                                            border: 'none',
                                            color: 'white',
                                            fontWeight: '800',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '15px',
                                            boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
                                            transition: '0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '16px' }}>
                                            <Scissors size={24} />
                                        </div>
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontSize: '1.1rem' }}>Order Procedures</div>
                                            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{procedureOrders.length} ordered</div>
                                        </div>
                                    </button>
                                </div>

                                <section id="assessment" style={{ scrollMarginTop: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    {/* SOAP Guidance */}
                                    <div style={{ background: '#f5f3ff', padding: '16px', borderRadius: '8px', border: '1px solid #ede9fe', display: 'flex', gap: '12px' }}>
                                        <Info size={20} color="#5b21b6" />
                                        <p style={{ fontSize: '0.85rem', color: '#5b21b6' }}>
                                            <strong>Assessment (A):</strong> Your clinical diagnosis. Use the ICD-10 search to find the standard code. This section summarizes your reasoning for the diagnosis.
                                        </p>
                                    </div>

                                    {/* Diagnosis & Assessment Box */}
                                    <div style={{ background: 'white', padding: '32px', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a' }}>
                                                <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '12px' }}>
                                                    <Clipboard size={22} color="#2563eb" />
                                                </div>
                                                Clinical Assessment
                                            </h3>
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                            <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '20px', border: '1px solid #eff6ff', position: 'relative' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                                    <Stethoscope size={16} color="#2563eb" />
                                                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Primary Diagnosis (ICD-10 CODED)</span>
                                                </div>

                                                {/* Selected Diagnoses */}
                                                {(assessment.primary_diagnosis_code || assessment.secondary_diagnoses.length > 0) && (
                                                    <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                        {assessment.primary_diagnosis_code && (
                                                            <div style={{ 
                                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                                                padding: '16px 20px', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
                                                                border: '1px solid #bfdbfe', borderRadius: '16px',
                                                                boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.1)'
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                                    <div style={{ 
                                                                        fontSize: '1.1rem', background: '#2563eb', color: 'white', 
                                                                        width: '70px', height: '44px', borderRadius: '12px', 
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900',
                                                                        boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)'
                                                                    }}>
                                                                        {assessment.primary_diagnosis_code}
                                                                    </div>
                                                                    <div>
                                                                        <div style={{ fontWeight: '800', color: '#1e3a8a', fontSize: '1.05rem' }}>{assessment.diagnosis}</div>
                                                                        <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#3b82f6', textTransform: 'uppercase', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <CheckCircle size={10} /> Primary Clinical Finding
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button onClick={handleRemovePrimaryDiagnosis} style={{ background: '#fee2e2', border: 'none', color: '#ef4444', padding: '8px', borderRadius: '10px', cursor: 'pointer', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                                                    <X size={18} />
                                                                </button>
                                                            </div>
                                                        )}
                                                        {assessment.secondary_diagnoses.map(diag => (
                                                            <div key={diag.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                                    <span style={{ fontSize: '0.9rem', background: '#f1f5f9', color: '#475569', padding: '6px 12px', borderRadius: '8px', fontWeight: '800', border: '1px solid #e2e8f0' }}>{diag.code}</span>
                                                                    <div>
                                                                        <div style={{ fontWeight: '700', color: '#334155' }}>{diag.description}</div>
                                                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Secondary Diagnosis</div>
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => handleRemoveSecondaryDiagnosis(diag.code)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div style={{ position: 'relative' }}>
                                                    <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
                                                        <Search size={18} />
                                                    </div>
                                                    <input
                                                        style={{ 
                                                            width: '100%', padding: '18px 20px 18px 48px', fontSize: '1.05rem', 
                                                            borderRadius: '16px', border: '2px solid #e2e8f0', background: 'white',
                                                            outline: 'none', transition: '0.2s'
                                                        }}
                                                        onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 4px rgba(37, 99, 235, 0.1)'; if (icdSearchTerm) setShowIcdDropdown(true); }}
                                                        onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; setTimeout(() => setShowIcdDropdown(false), 200); }}
                                                        placeholder="Search by diagnosis name (e.g. 'Malaria') or ICD-10 code..."
                                                        value={icdSearchTerm}
                                                        onChange={e => setIcdSearchTerm(e.target.value)}
                                                    />
                                                    {isSearchingIcd && (
                                                        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }}>
                                                            <div className="animate-spin" style={{ width: '18px', height: '18px', border: '3px solid #2563eb', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
                                                        </div>
                                                    )}
                                                    {showIcdDropdown && icdResults.length > 0 && (
                                                        <div style={{
                                                            position: 'absolute', zIndex: 100, top: '100%', left: 0, right: 0,
                                                            background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px',
                                                            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', marginTop: '8px',
                                                            maxHeight: '280px', overflowY: 'auto', padding: '8px'
                                                        }}>
                                                            {icdResults.map(res => (
                                                                <div
                                                                    key={res.code}
                                                                    onClick={() => handleSelectDiagnosis(res)}
                                                                    style={{ padding: '12px 16px', cursor: 'pointer', borderRadius: '10px', display: 'flex', gap: '16px', alignItems: 'center' }}
                                                                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                                    onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                                                >
                                                                    <div style={{ fontSize: '0.9rem', fontWeight: '900', color: '#2563eb', minWidth: '60px', background: '#eff6ff', padding: '4px 8px', borderRadius: '6px', textAlign: 'center' }}>{res.code}</div>
                                                                    <span style={{ color: '#1e293b', fontWeight: '600', fontSize: '0.95rem' }}>{res.description}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                    <FileText size={16} color="#2563eb" />
                                                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Clinical Impression / Narrative Summary</span>
                                                </div>
                                                <textarea 
                                                    style={{ 
                                                        width: '100%', padding: '20px', borderRadius: '20px', border: '2px solid #f1f5f9',
                                                        fontSize: '1.05rem', lineHeight: '1.6', background: '#f8fafc', color: '#1e293b',
                                                        outline: 'none', transition: '0.2s', minHeight: '160px'
                                                    }}
                                                    onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.background = 'white'; }}
                                                    onBlur={e => { e.target.style.borderColor = '#f1f5f9'; e.target.style.background = '#f8fafc'; }}
                                                    value={assessment.clinical_impression} 
                                                    onChange={e => setAssessment({ ...assessment, clinical_impression: e.target.value })} 
                                                    placeholder="Describe your clinical reasoning, detailed findings, or patient-specific observations here..."
                                                ></textarea>
                                            </div>

                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                    <AlertTriangle size={16} color="#d97706" />
                                                    <span style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Differential Diagnoses</span>
                                                </div>
                                                <textarea 
                                                    style={{ 
                                                        width: '100%', padding: '16px 20px', borderRadius: '16px', border: '2px solid #f1f5f9',
                                                        fontSize: '1rem', background: '#fffbeb', color: '#92400e',
                                                        outline: 'none', transition: '0.2s', minHeight: '60px'
                                                    }} 
                                                    onFocus={e => { e.target.style.borderColor = '#f59e0b'; e.target.style.background = 'white'; }}
                                                    onBlur={e => { e.target.style.borderColor = '#f1f5f9'; e.target.style.background = '#fffbeb'; }}
                                                    value={assessment.differential_diagnoses.join(', ')} 
                                                    onChange={e => setAssessment({ ...assessment, differential_diagnoses: e.target.value.split(',').map(s => s.trim()) })} 
                                                    placeholder="List potential alternative diagnoses separated by commas..."
                                                ></textarea>
                                            </div>
                                        </div>
                                    </div>

                                </section>


                                <section id="plan" style={{ scrollMarginTop: '20px', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
                                    {/* Clinical Gate: Test-Before-Treat Logic (Downsized to small centered div) */}
                                    {labTracker.some(l => l.status === 'pending') && !ignoreLabGate && (
                                        <div style={{
                                            position: 'absolute', inset: 0, background: 'rgba(255, 255, 255, 0.6)',
                                            backdropFilter: 'blur(4px)', zIndex: 100, borderRadius: '24px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
                                        }}>
                                            <div style={{
                                                maxWidth: '440px', background: 'white', padding: '32px',
                                                borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                                                border: '1px solid #e2e8f0', textAlign: 'center'
                                            }}>
                                                <div style={{ background: '#fffbeb', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '1px solid #fef3c7' }}>
                                                    <Clock size={28} color="#d97706" className="animate-pulse" />
                                                </div>
                                                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#1e293b', marginBottom: '8px' }}>Investigations in Progress</h3>

                                                {labTracker.some(l => l.status === 'completed') && (
                                                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px', marginBottom: '16px', textAlign: 'left' }}>
                                                        <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#166534', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></div>
                                                            Partial Results Available
                                                        </div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                            {labTracker.filter(l => l.status === 'completed').map((l, idx) => (
                                                                <span key={idx} style={{ background: 'white', color: '#166534', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700', border: '1px solid #dcfce7' }}>
                                                                    {l.test_name} ✓
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '24px' }}>
                                                    The laboratory is still processing {labTracker.filter(l => l.status !== 'completed').length} test(s).
                                                    {labTracker.filter(l => l.status === 'pending').length > 0 && (
                                                        <span style={{ display: 'block', color: '#ef4444', fontWeight: '700', marginTop: '4px' }}>
                                                            Longest wait: {Math.max(...labTracker.filter(l => l.status === 'pending').map(l => Math.floor((currentTime - new Date(l.created_at)) / 60000)))} minutes
                                                        </span>
                                                    )}
                                                    <br />
                                                    Best practice recommends waiting before finalizing treatment.
                                                </p>
                                                <div style={{ display: 'flex', gap: '12px' }}>
                                                    <button
                                                        onClick={() => document.getElementById('lab-tracker').scrollIntoView({ behavior: 'smooth' })}
                                                        style={{ flex: 1, background: '#0f172a', color: 'white', padding: '12px', borderRadius: '10px', fontWeight: '700', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                                                    >
                                                        Track Labs
                                                    </button>
                                                    <button
                                                        onClick={() => setIgnoreLabGate(true)}
                                                        style={{ flex: 1.2, background: '#f1f5f9', color: '#475569', padding: '12px', borderRadius: '10px', fontWeight: '600', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
                                                    >
                                                        Proceed Anyway
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Clinical Action: Medication (Secondary Action after Lab results/Assessment) */}
                                    <div style={{ marginBottom: '8px' }}>
                                        <button
                                            onClick={() => setShowPrescriptionModal(true)}
                                            style={{
                                                width: '100%',
                                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                                padding: '24px',
                                                borderRadius: '20px',
                                                border: 'none',
                                                color: 'white',
                                                fontWeight: '800',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '16px',
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.2), 0 4px 6px -2px rgba(37, 99, 235, 0.1)',
                                                fontSize: '1.1rem',
                                                letterSpacing: '0.5px'
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px) scale(1.01)'; e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(37, 99, 235, 0.3)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(37, 99, 235, 0.2)'; }}
                                        >
                                            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '12px', borderRadius: '14px' }}>
                                                <Pill size={28} />
                                            </div>
                                            <span>PRESCRIBE MEDICATIONS / ADD DRUGS</span>
                                        </button>
                                    </div>

                                    {/* Summary Order List */}
                                    {(prescriptions.length > 0 || labRequests.length > 0) && (
                                        <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                <h4 style={{ fontSize: '0.85rem', fontWeight: '800', color: '#64748b', margin: 0, textTransform: 'uppercase' }}>Items Added to Visit</h4>
                                                {prescriptions.length > 0 && (
                                                    <button
                                                        onClick={() => setShowPreviewModal(true)}
                                                        style={{ background: '#f0f9ff', color: '#2563eb', border: '1px solid #bae6fd', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                    >
                                                        <FileText size={14} /> Preview & Print Rx
                                                    </button>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {prescriptions.map((p, i) => (
                                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '16px 20px', background: '#f8fafc', borderRadius: '12px', borderLeft: '4px solid #2563eb' }}>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '1.05rem' }}>{p.drug_name}</span>
                                                                <span style={{ fontSize: '0.8rem', padding: '2px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontWeight: '700' }}>{p.route}</span>
                                                            </div>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginTop: '6px', fontSize: '0.85rem', color: '#475569' }}>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={14} /> {p.dosage}</span>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={14} /> {p.frequency}</span>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> {p.duration}</span>
                                                                <span style={{ fontWeight: '700', color: '#2563eb' }}>{p.food_relation}</span>
                                                            </div>
                                                            {p.instructions && (
                                                                <div style={{ marginTop: '8px', padding: '8px 12px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>
                                                                    <strong>Note:</strong> {p.instructions}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button onClick={() => setPrescriptions(prescriptions.filter((_, idx) => idx !== i))} style={{ color: '#ef4444', border: 'none', background: 'white', padding: '8px', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}><Trash2 size={16} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>

                                <section id="disposition" style={{ scrollMarginTop: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div style={{ background: '#fff7ed', padding: '16px', borderRadius: '8px', border: '1px solid #ffedd5', display: 'flex', gap: '12px' }}>
                                        <UserCheck size={20} color="#9a3412" />
                                        <p style={{ fontSize: '0.85rem', color: '#9a3412' }}>
                                            <strong>Disposition:</strong> Finalize the visit. Decide if the patient is discharged, referred, or admitted.
                                        </p>
                                    </div>

                                    <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                                        <div style={{ background: 'linear-gradient(90deg, #f8fafc 0%, #ffffff 100%)', padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ padding: '10px', background: '#0f172a', borderRadius: '12px', color: 'white' }}><Activity size={20} /></div>
                                            <div>
                                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>FINAL VISIT OUTCOME</h3>
                                                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>Complete the encounter and update patient status</p>
                                            </div>
                                        </div>
                                        <div style={{ padding: '32px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                                <div>
                                                    <label className="label" style={{ color: '#475569', fontSize: '0.75rem' }}>PATIENT DISPOSITION</label>
                                                    <select className="input-field" style={{ marginTop: '8px', fontWeight: '700', color: '#1e293b', border: '1.5px solid #e2e8f0' }} value={disposition.status} onChange={e => setDisposition({ ...disposition, status: e.target.value })}>
                                                        <option>Discharge</option>
                                                        <option>Follow-up</option>
                                                        <option>Referral</option>
                                                        <option>Admission</option>
                                                    </select>
                                                </div>
                                                {disposition.status === 'Follow-up' && (
                                                    <div className="animate-in fade-in slide-in-from-top-2">
                                                        <label className="label" style={{ color: '#475569', fontSize: '0.75rem' }}>NEXT APPOINTMENT DATE</label>
                                                        <input type="date" className="input-field" style={{ marginTop: '8px' }} value={disposition.follow_up_date} onChange={e => setDisposition({ ...disposition, follow_up_date: e.target.value })} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '40px' }}>
                                        <button onClick={handleSave} className="btn-primary" style={{ background: '#10b981', color: 'white', padding: '16px 48px', borderRadius: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.1rem' }}>
                                            <Save size={24} />Save file
                                        </button>
                                    </div>
                                </section>
                                    </div>
                                </div>
                            </div>
                        </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .label { display: block; font-size: 0.85rem; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 10px; letter-spacing: 0.05em; }
                .input-field { width: 100%; padding: 14px 18px; border: 1.5px solid #e2e8f0; border-radius: 12px; font-size: 1rem; transition: 0.2s; background: white; }
                .input-field:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 5px rgba(37, 99, 235, 0.15); }
                .btn-primary { cursor: pointer; transition: 0.2s; padding: 14px 36px; border-radius: 12px; }
                .btn-primary:hover { opacity: 0.9; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
                .btn-primary:active { transform: translateY(0); }
                .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
                
                .vital-critical-alert {
                    animation: tremble 2s ease-in-out infinite;
                    border: 2px solid #ef4444 !important;
                    background: #fff1f2 !important;
                    box-shadow: 0 0 15px rgba(239, 68, 68, 0.2);
                }

                @keyframes tremble {
                    0%, 70%, 100% { transform: translate(0, 0); }
                    75% { transform: translate(-2px, 0); }
                    80% { transform: translate(2px, 0); }
                    85% { transform: translate(-2px, 0); }
                    90% { transform: translate(2px, 0); }
                    95% { transform: translate(-1px, 0); }
                }
            `}} />

            {/* MODALS */}
            {showPrescriptionModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: 'white', width: '100%', maxWidth: '1100px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Pill color="#2563eb" /> Prescription Workspace
                            </h3>
                            <button onClick={() => setShowPrescriptionModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={18} /></button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', flex: 1, overflow: 'hidden' }}>
                            {/* LEFT: FORM */}
                            <div style={{ padding: '32px', borderRight: '1px solid #f1f5f9', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ position: 'relative' }}>
                                    <label className="label">Search Medicine</label>
                                    <input
                                        className="input-field"
                                        placeholder="Search Pharmacy Stock..."
                                        value={medSearch || newDrug.drug_name}
                                        onChange={e => {
                                            setMedSearch(e.target.value);
                                            setNewDrug({ ...newDrug, drug_name: e.target.value });
                                        }}
                                        onFocus={() => { if (medResults.length > 0) setShowMedDropdown(true); }}
                                        onBlur={() => setTimeout(() => setShowMedDropdown(false), 200)}
                                        style={{ fontSize: '1.1rem', padding: '16px' }}
                                    />
                                    {showMedDropdown && medResults.length > 0 && (
                                        <div style={{ position: 'absolute', zIndex: 60, top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', marginTop: '4px', maxHeight: '250px', overflowY: 'auto' }}>
                                            {medResults.map(med => {
                                                const expiryDate = new Date(med.expiry_date);
                                                const today = new Date();
                                                const isExpired = expiryDate < today;
                                                const isNearingExpiry = !isExpired && expiryDate < new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                                                const isDepleted = med.stock_qty <= 0;
                                                const isLowStock = med.stock_qty < 20 && med.stock_qty > 0;

                                                return (
                                                    <div key={med.id} onClick={() => handleSelectMed(med)} style={{
                                                        padding: '16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                                                        display: 'flex', justifyContent: 'space-between',
                                                        opacity: isExpired ? 0.6 : 1,
                                                        background: isExpired ? '#fff5f5' : (isNearingExpiry ? '#fffaf0' : 'white')
                                                    }}>
                                                        <div>
                                                            <div style={{ fontWeight: '700', color: isExpired ? '#dc3545' : (isNearingExpiry ? '#fd7e14' : '#1e293b') }}>
                                                                {med.med_name}
                                                                {isExpired && <span style={{ fontSize: '0.65rem', background: '#dc3545', color: 'white', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>EXPIRED</span>}
                                                                {isNearingExpiry && <span style={{ fontSize: '0.65rem', background: '#fd7e14', color: 'white', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>EXPIRING SOON</span>}
                                                            </div>
                                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{med.generic_name} ({med.med_type || 'Tablet'})</div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{
                                                                fontSize: '0.9rem', fontWeight: '700',
                                                                color: isDepleted ? '#ef4444' : (isLowStock ? '#f59e0b' : '#10b981')
                                                            }}>
                                                                {isDepleted ? 'Out of Stock' : (isLowStock ? `Low Stock (${med.stock_qty})` : `${med.stock_qty} available`)}
                                                            </div>
                                                            <div style={{ fontSize: '0.7rem', color: isExpired ? '#dc3545' : (isNearingExpiry ? '#fd7e14' : '#94a3b8') }}>Exp: {med.expiry_date}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Allergy Alert */}
                                {newDrug.drug_name && patient?.allergies && (patient.allergies || '').toLowerCase().includes((newDrug.drug_name || '').toLowerCase()) && (
                                    <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '12px 16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', color: '#991b1b' }}>
                                        <AlertTriangle size={20} />
                                        <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>
                                            ALLERGY ALERT: Patient is allergic to {newDrug.drug_name}!
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                    <div><label className="label">Dosage</label><input className="input-field" placeholder="e.g. 500mg" value={newDrug.dosage} onChange={e => setNewDrug({ ...newDrug, dosage: e.target.value })} /></div>
                                    <div>
                                        <label className="label">Frequency</label>
                                        <select className="input-field" value={newDrug.frequency} onChange={e => setNewDrug({ ...newDrug, frequency: e.target.value })}>
                                            <option>Once a day (OD) [1x1]</option>
                                            <option>Twice a day (BD) [1x2]</option>
                                            <option>Three times a day (TDS) [1x3]</option>
                                            <option>Four times a day (QID) [1x4]</option>
                                            <option>As needed (PRN)</option>
                                            <option>Immediately (STAT)</option>
                                            <option>At Night</option>
                                            <option value="Custom">Custom Schedule...</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label">Route</label>
                                        <select className="input-field" value={newDrug.route} onChange={e => setNewDrug({ ...newDrug, route: e.target.value })}>
                                            <option>By Mouth (Oral)</option>
                                            <option>Injection into Vein (IV)</option>
                                            <option>Injection into Muscle (IM)</option>
                                            <option>Under the Skin (SC)</option>
                                            <option>Apply to Skin (Topical)</option>
                                            <option>Breathe in (Inhaler)</option>
                                            <option>Eye Drops (Ophthalmic)</option>
                                        </select>
                                    </div>
                                </div>

                                {newDrug.frequency === 'Custom' && (
                                    <div className="animate-in fade-in slide-in-from-top-1">
                                        <label className="label" style={{ color: '#2563eb' }}>Specify Custom Schedule</label>
                                        <input className="input-field" style={{ borderColor: '#2563eb' }} placeholder="e.g. Every 6 hours for 3 days..." onChange={e => setNewDrug({ ...newDrug, instructions: `Schedule: ${e.target.value}` })} />
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                    <div><label className="label">Duration</label><input className="input-field" placeholder="e.g. 5 days" value={newDrug.duration} onChange={e => setNewDrug({ ...newDrug, duration: e.target.value })} /></div>
                                    <div><label className="label">Qty to Dispense</label><input className="input-field" placeholder="e.g. 15 Tablets" value={newDrug.quantity} onChange={e => setNewDrug({ ...newDrug, quantity: e.target.value })} /></div>
                                    <div><label className="label">Refills</label><input type="number" className="input-field" value={newDrug.refills} onChange={e => setNewDrug({ ...newDrug, refills: e.target.value })} /></div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
                                    <div>
                                        <label className="label">Food Relation</label>
                                        <select className="input-field" value={newDrug.food_relation} onChange={e => setNewDrug({ ...newDrug, food_relation: e.target.value })}>
                                            <option>Before Food</option><option>After Food</option><option>With Food</option><option>Empty Stomach</option>
                                        </select>
                                    </div>
                                    <div><label className="label">Extra Instructions</label><input className="input-field" placeholder="e.g. Dissolve in water..." value={newDrug.instructions} onChange={e => setNewDrug({ ...newDrug, instructions: e.target.value })} /></div>
                                </div>

                                <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                                    <button
                                        onClick={handleAddDrug}
                                        style={{ flex: 2, background: newDrug.id ? '#10b981' : '#2563eb', color: 'white', padding: '18px', borderRadius: '12px', border: 'none', fontWeight: '800', cursor: 'pointer', fontSize: '1rem', transition: '0.2s' }}
                                    >
                                        {newDrug.id ? 'UPDATE MEDICINE RECORD' : 'CONFIRM & ADD TO LIST'}
                                    </button>
                                    {newDrug.id && (
                                        <button
                                            onClick={() => {
                                                setNewDrug({
                                                    id: null, drug_id: '', drug_name: '', brand_name: '', drug_form: 'Tablet', dosage: '500mg',
                                                    frequency: 'Twice a day (BD) [1x2]', route: 'By Mouth (Oral)', duration: '5 days', quantity: '',
                                                    refills: '0', food_relation: 'After Food', instructions: ''
                                                });
                                                setMedSearch('');
                                            }}
                                            style={{ flex: 1, background: '#f1f5f9', color: '#64748b', padding: '18px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: '700', cursor: 'pointer' }}
                                        >
                                            CANCEL EDIT
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT: LIVE LIST */}
                            <div style={{ background: '#f8fafc', padding: '32px', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Added Medications ({prescriptions.length})</h4>
                                    {prescriptions.length > 0 && <button onClick={() => setPrescriptions([])} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>Clear All</button>}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {prescriptions.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '0.9rem', border: '2px dashed #e2e8f0', borderRadius: '16px' }}>
                                            <Pill size={32} style={{ marginBottom: '10px', opacity: 0.3 }} />
                                            <div>No medicines added yet.</div>
                                        </div>
                                    ) : (
                                        prescriptions.map((p, i) => {
                                            const isExpired = p.expiry_date && new Date(p.expiry_date) < new Date();
                                            const isDepleted = p.stock !== undefined && p.stock <= 0;
                                            const isLowStock = p.stock !== undefined && p.stock < 20 && p.stock > 0;

                                            return (
                                                <div key={i} onClick={() => handleEditDrug(p)} style={{
                                                    background: 'white', padding: '16px', borderRadius: '12px',
                                                    border: p.id === newDrug.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)', position: 'relative',
                                                    cursor: 'pointer', transition: '0.2s',
                                                    borderLeft: isExpired ? '4px solid #be123c' : (isDepleted ? '4px solid #ef4444' : '1px solid #e2e8f0')
                                                }}>
                                                    <button onClick={(e) => { e.stopPropagation(); setPrescriptions(prescriptions.filter((_, idx) => idx !== i)); }} style={{ position: 'absolute', top: '10px', right: '10px', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                                    <div style={{ fontWeight: '800', color: isExpired ? '#be123c' : '#1e293b', fontSize: '0.95rem', paddingRight: '25px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {p.drug_name}
                                                        {isExpired && <span style={{ fontSize: '0.6rem', background: '#be123c', color: 'white', padding: '2px 4px', borderRadius: '4px' }}>EXPIRED</span>}
                                                        {isDepleted && <span style={{ fontSize: '0.6rem', background: '#ef4444', color: 'white', padding: '2px 4px', borderRadius: '4px' }}>OUT OF STOCK</span>}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>{p.dosage} • {p.frequency}</div>
                                                    <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: '700', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>{p.duration} ({p.food_relation})</span>
                                                        {p.stock !== undefined && !isDepleted && (
                                                            <span style={{ color: isLowStock ? '#f59e0b' : '#10b981', fontSize: '0.75rem' }}>
                                                                {isLowStock ? `Low Stock: ${p.stock}` : `In Stock: ${p.stock}`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}

                                    <style dangerouslySetInnerHTML={{
                                        __html: `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
            `}} />
                                </div>

                                {prescriptions.length > 0 && (
                                    <div style={{ marginTop: '32px', padding: '20px', background: '#e0f2fe', borderRadius: '16px', border: '1px solid #bae6fd' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#0369a1', marginBottom: '8px', textTransform: 'uppercase' }}>Quick Action</div>
                                        <button onClick={() => setShowPrescriptionModal(false)} style={{ width: '100%', background: '#0369a1', color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Close & Finish Plan</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showLabModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: 'white', width: '100%', maxWidth: '950px', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        {/* Header: Patient & Encounter info */}
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Electronic Lab Order</div>
                                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: '900', color: '#0f172a' }}>{patient?.pname || 'Patient'}</h3>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>Encounter ID: <span style={{ fontWeight: '700', color: '#2563eb' }}>#ENC-{appoid}</span></div>
                            </div>
                            <button onClick={() => setShowLabModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'} onMouseLeave={e => e.currentTarget.style.background = '#f1f5f9'}>
                                <X size={20} color="#64748b" />
                            </button>
                        </div>

                        <div style={{ display: 'flex', minHeight: '500px' }}>
                            {/* LEFT SIDE: Order Form */}
                            <div style={{ flex: '1.2', padding: '32px', borderRight: '1px solid #f1f5f9', overflowY: 'auto', maxHeight: '70vh' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div style={{ position: 'relative' }}>
                                        <label className="label" style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FlaskConical size={16} /> SELECT INVESTIGATION
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                            <input
                                                type="text"
                                                className="input-field"
                                                style={{ paddingLeft: '48px', height: '56px', border: '1.5px solid #e2e8f0' }}
                                                placeholder="Search test name (e.g. FBC, Malaria...)"
                                                value={newLab.test_name}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setNewLab({ ...newLab, test_name: val });
                                                    const match = catalog.find(t => (t.test_name || '').toLowerCase() === val.toLowerCase());
                                                    if (match) {
                                                        setNewLab({ ...newLab, test_name: match.test_name, specimen_type: match.required_sample || '', price: match.price || 0 });
                                                    }
                                                }}
                                            />
                                            {catalog.length > 0 && newLab.test_name && (
                                                <div style={{ position: 'absolute', zIndex: 100, top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', marginTop: '4px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                                                    {newLab.test_name && catalog
                                                        .filter(t => (t.test_name || '').toLowerCase().includes((newLab.test_name || '').toLowerCase()) && t.is_enabled && t.test_name !== newLab.test_name)
                                                        .slice(0, 10)
                                                        .map(t => (
                                                            <div
                                                                key={t.id}
                                                                onClick={() => {
                                                                    setNewLab({
                                                                        ...newLab,
                                                                        test_name: t.test_name,
                                                                        specimen_type: t.required_sample || 'Blood',
                                                                        price: t.price || 0,
                                                                        clinical_indication: `Test: ${t.test_name} (${t.category})`
                                                                    });
                                                                    document.activeElement.blur();
                                                                }}
                                                                style={{
                                                                    padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc',
                                                                    fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between',
                                                                    background: newLab.test_name === t.test_name ? '#eff6ff' : 'white'
                                                                }}
                                                            >
                                                                <span style={{ fontWeight: '600' }}>{t.test_name}</span>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#10b981' }}>KES {Number(t.price || 0).toLocaleString()}</span>
                                                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{t.required_sample} • {t.category}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <label className="label">Urgency</label>
                                            <select className="input-field" value={newLab.urgency} onChange={e => setNewLab({ ...newLab, urgency: e.target.value })}>
                                                <option value="Routine">Routine</option>
                                                <option value="Urgent (STAT)">Urgent (STAT)</option>
                                                <option value="Pre-Op">Pre-Op</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label">Specimen</label>
                                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontWeight: '600' }}>
                                                <Droplets size={16} color="#ef4444" /> {newLab.specimen_type || 'Specify test first'}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="label">CLINICAL NOTES / ICD-10 INDICATIONS</label>
                                        <textarea
                                            className="input-field"
                                            style={{ height: '80px', paddingTop: '12px', resize: 'none' }}
                                            placeholder="Reason for investigation..."
                                            value={newLab.clinical_indication}
                                            onChange={e => setNewLab({ ...newLab, clinical_indication: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="label">MESSAGE TO LAB (ORDER NOTES)</label>
                                        <textarea
                                            className="input-field"
                                            style={{ height: '80px', paddingTop: '12px', resize: 'none' }}
                                            placeholder="Any specific instructions or message for the lab technician..."
                                            value={newLab.order_notes || ''}
                                            onChange={e => setNewLab({ ...newLab, order_notes: e.target.value })}
                                        />
                                    </div>

                                    {technicians.length > 1 && (
                                        <div>
                                            <label className="label" style={{ color: '#0369a1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <UserCheck size={16} /> Assign to Lab Technician
                                            </label>
                                            <select
                                                className="input-field"
                                                style={{ height: '48px', border: '1px solid #0369a1' }}
                                                value={selectedTech || ''}
                                                onChange={e => setSelectedTech(e.target.value)}
                                            >
                                                <option value="">-- Choose Account --</option>
                                                {technicians.map(t => (
                                                    <option key={t.labid} value={t.user_id || t.labid}>{t.labname}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div style={{ marginTop: '10px' }}>
                                        <button
                                            onClick={() => {
                                                if (newLab.test_name) {
                                                    setLabRequests([...labRequests, { ...newLab, id: Date.now() }]);
                                                    setNewLab({ test_name: '', urgency: 'Routine', clinical_indication: '', specimen_type: '', order_notes: '' });
                                                    showToast(`Added ${newLab.test_name} to visit plan.`, "success");
                                                } else {
                                                    showToast("Please select a test first.", "warning");
                                                }
                                            }}
                                            style={{
                                                width: '100%',
                                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                                color: 'white', padding: '16px', borderRadius: '16px',
                                                border: 'none', fontWeight: '800', cursor: 'pointer', transition: '0.2s',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                                        >
                                            <Plus size={20} /> ADD TO LAB REQUESTS
                                        </button>

                                        <button
                                            onClick={() => {
                                                setNewLab({ test_name: '', urgency: 'Routine', clinical_indication: '', specimen_type: '', order_notes: '' });
                                                setShowLabModal(false);
                                            }}
                                            style={{
                                                width: '100%',
                                                background: 'transparent', color: '#64748b', padding: '12px', borderRadius: '12px',
                                                border: '1.5px solid #e2e8f0', fontWeight: '700', cursor: 'pointer', transition: '0.2s',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                                marginTop: '12px'
                                            }}
                                        >
                                            DONE / CLOSE
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT SIDE: Selected Tests */}
                            <div style={{ flex: '0.8', background: '#f8fafc', padding: '32px', overflowY: 'auto', maxHeight: '70vh' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Orders for this visit ({labRequests.length})</h4>
                                    {labRequests.length > 0 && <button onClick={() => setLabRequests([])} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer' }}>Clear All</button>}
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {labRequests.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '24px' }}>
                                            <FlaskConical size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                                            <div style={{ fontSize: '0.9rem' }}>No investigations selected.</div>
                                        </div>
                                    ) : (
                                        labRequests.map((l, i) => (
                                            <div key={l.id} style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'relative' }}>
                                                <button onClick={() => setLabRequests(labRequests.filter(item => item.id !== l.id))} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                                <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>{l.test_name}</div>
                                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '0.65rem', background: l.urgency === 'Routine' ? '#f1f5f9' : '#fee2e2', color: l.urgency === 'Routine' ? '#475569' : '#ef4444', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>{l.urgency.toUpperCase()}</span>
                                                    <span style={{ fontSize: '0.65rem', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontWeight: '800' }}>{l.specimen_type}</span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>{l.clinical_indication}</div>
                                                <div style={{ marginTop: '10px', fontSize: '0.8rem', fontWeight: '700', color: '#10b981' }}>Price: KES {Number(l.price || 0).toLocaleString()}</div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {labRequests.length > 0 && (
                                    <button
                                        onClick={handleSendLabOrder}
                                        disabled={isSendingLab}
                                        style={{ width: '100%', marginTop: '32px', background: '#0f172a', color: 'white', border: 'none', padding: '18px', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                                    >
                                        {isSendingLab ? 'SENDING ORDERS...' : <><Send size={20} /> FINALIZE & SEND TO LAB</>}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showProcedureModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: 'white', width: '100%', maxWidth: '900px', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Minor Theatre & Procedures</div>
                                <h3 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: '900', color: '#0f172a' }}>{patient?.pname}</h3>
                            </div>
                            <button onClick={() => setShowProcedureModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '36px', height: '36px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
                        </div>

                        <div style={{ display: 'flex', minHeight: '500px' }}>
                            <div style={{ flex: '1.2', padding: '32px', borderRight: '1px solid #f1f5f9', overflowY: 'auto', maxHeight: '70vh' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div>
                                        <label className="label">SELECT PROCEDURE</label>
                                        <select 
                                            className="input-field" 
                                            value={newProcedure.procedure_name}
                                            onChange={e => {
                                                const match = procedureCatalog.find(p => p.item_name === e.target.value);
                                                if (match) {
                                                    setNewProcedure({ ...newProcedure, procedure_name: match.item_name, price: match.price });
                                                } else {
                                                    setNewProcedure({ ...newProcedure, procedure_name: e.target.value });
                                                }
                                            }}
                                        >
                                            <option value="">-- Search / Select Procedure --</option>
                                            {procedureCatalog.map(p => (
                                                <option key={p.id} value={p.item_name}>{p.item_name} (KES {p.price})</option>
                                            ))}
                                            {profile?.usertype === 'admin' && (
                                                <option value="Manual">-- Add Custom Procedure --</option>
                                            )}
                                        </select>
                                    </div>
                                    {newProcedure.procedure_name === 'Manual' && (
                                        <input 
                                            type="text" 
                                            placeholder="Type procedure name..." 
                                            className="input-field" 
                                            onChange={e => setNewProcedure({ ...newProcedure, procedure_name: e.target.value })} 
                                        />
                                    )}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                        <div>
                                            <label className="label">Standard Fee</label>
                                            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontWeight: '800', color: '#10b981' }}>
                                                KES {Number(newProcedure.price || 0).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label">PROCEDURE NOTES / INSTRUCTIONS</label>
                                        <textarea 
                                            className="input-field" 
                                            style={{ height: '100px' }} 
                                            placeholder="Specific details for the surgical team..."
                                            value={newProcedure.notes}
                                            onChange={e => setNewProcedure({ ...newProcedure, notes: e.target.value })}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (!newProcedure.procedure_name) return showToast("Select a procedure", "error");
                                            setProcedureOrders([...procedureOrders, { ...newProcedure, id: Date.now() }]);
                                            setNewProcedure({ procedure_name: '', notes: '', urgency: 'Routine', price: 0 });
                                        }}
                                        style={{ background: '#2563eb', color: 'white', border: 'none', padding: '18px', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                                    >
                                        <Plus size={20} /> ADD TO PROCEDURE LIST
                                    </button>
                                </div>
                            </div>

                            <div style={{ flex: '0.8', background: '#f8fafc', padding: '32px', overflowY: 'auto', maxHeight: '70vh' }}>
                                <h4 style={{ margin: '0 0 20px 0', fontSize: '0.85rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Ordered Procedures ({procedureOrders.length + sentProcedures.length})</h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {/* SENT PROCEDURES */}
                                    {sentProcedures.map((p) => (
                                        <div key={p.id} style={{ background: '#f0fdfa', padding: '20px', borderRadius: '16px', border: '1px solid #ccfbf1', position: 'relative' }}>
                                            {!p.is_paid && (
                                                <button 
                                                    onClick={async () => {
                                                        if (window.confirm('Delete this procedure order?')) {
                                                            const { error } = await supabase.from('procedures').delete().eq('id', p.id);
                                                            if (!error) refreshData();
                                                        }
                                                    }} 
                                                    style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                                <div style={{ fontWeight: '800', color: '#0f172a' }}>{p.procedure_name}</div>
                                                <div style={{ 
                                                    fontSize: '0.65rem', padding: '4px 8px', borderRadius: '6px', fontWeight: '900',
                                                    background: p.is_paid ? '#dcfce7' : '#fee2e2',
                                                    color: p.is_paid ? '#166534' : '#991b1b',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {p.is_paid ? 'PAID' : 'UNPAID'}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '800', marginTop: '4px' }}>{p.urgency?.toUpperCase()}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>{p.notes}</div>
                                            <div style={{ marginTop: '10px', fontSize: '0.8rem', fontWeight: '700', color: '#10b981' }}>KES {Number(p.price || 0).toLocaleString()}</div>
                                        </div>
                                    ))}

                                    {/* DRAFT PROCEDURES */}
                                    {procedureOrders.map((p, i) => (
                                        <div key={p.id} style={{ background: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #e2e8f0', borderStyle: 'dashed', position: 'relative' }}>
                                            <button onClick={() => setProcedureOrders(procedureOrders.filter(item => item.id !== p.id))} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#ef4444' }}><Trash2 size={16} /></button>
                                            <div style={{ fontWeight: '800', color: '#0f172a' }}>{p.procedure_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: '800', marginTop: '4px' }}>{p.urgency.toUpperCase()}</div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>{p.notes}</div>
                                            <div style={{ marginTop: '10px', fontSize: '0.8rem', fontWeight: '700', color: '#10b981' }}>KES {Number(p.price || 0).toLocaleString()}</div>
                                            <div style={{ fontSize: '0.6rem', color: '#94a3b8', marginTop: '4px' }}>Draft - Not yet sent</div>
                                        </div>
                                    ))}

                                    {(procedureOrders.length === 0 && sentProcedures.length === 0) && (
                                        <div style={{ textAlign: 'center', padding: '64px 20px', color: '#94a3b8', border: '2px dashed #e2e8f0', borderRadius: '24px' }}>
                                            <Scissors size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                                            <div>No procedures ordered.</div>
                                        </div>
                                    )}
                                </div>
                                {procedureOrders.length > 0 && (
                                    <button
                                        onClick={handleSendProcedureOrder}
                                        disabled={isSendingLab}
                                        style={{ width: '100%', marginTop: '32px', background: '#0f172a', color: 'white', border: 'none', padding: '18px', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                                    >
                                        {isSendingLab ? 'SAVING...' : <><CheckCircle size={20} /> FINALIZE PROCEDURES</>}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* PRESCRIPTION PREVIEW MODAL */}
            {showPreviewModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div style={{ background: 'white', width: '100%', maxWidth: '850px', height: '90vh', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#1e293b', fontWeight: '800' }}>
                                <ShieldCheck size={20} color="#10b981" /> OFFICIAL CLINICAL PRESCRIPTION
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => window.print()} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}>Print Prescription</button>
                                <button onClick={() => setShowPreviewModal(false)} style={{ background: '#f1f5f9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' }}><X size={16} /></button>
                            </div>
                        </div>

                        <div id="printable-rx" style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
                            {/* Hospital Header */}
                            <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #1e293b', paddingBottom: '20px' }}>
                                <h1 style={{ margin: 0, fontSize: '2rem', color: '#1e293b', textTransform: 'uppercase' }}>MOONVIEW MEDICAL CENTER</h1>
                                <p style={{ margin: '5px 0', color: '#64748b' }}>123 Clinical Way, Medical District • Tel: +254 700 000 000</p>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '10px', fontSize: '0.85rem', fontWeight: '700' }}>
                                    <span>License: MED-99283-A</span>
                                    <span>Date: {new Date().toLocaleDateString()}</span>
                                </div>
                            </div>

                            {/* Patient Info Section */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '30px', background: '#f8fafc', padding: '20px', borderRadius: '12px' }}>
                                <div>
                                    <h5 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Patient Details</h5>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '800', color: '#1e293b' }}>{patient?.pname || 'N/A'}</div>
                                    <div style={{ color: '#475569', marginTop: '4px' }}>Age: {patient?.age || 'N/A'} • Gender: {patient?.pgender || 'N/A'}</div>
                                    <div style={{ color: '#475569' }}>PID: {patient?.pid || 'N/A'}</div>
                                </div>
                                <div>
                                    <h5 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase' }}>Clinical Context</h5>
                                    <div style={{ fontWeight: '700', color: '#1e293b' }}>Diagnosis: {assessment.diagnosis || 'Clinical Impression'}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>ICD Code: {assessment.primary_diagnosis_code || 'N/A'}</div>
                                    {patient?.allergies && (
                                        <div style={{ color: '#ef4444', fontWeight: '800', marginTop: '5px' }}>⚠️ ALLERGIES: {patient.allergies}</div>
                                    )}
                                </div>
                            </div>

                            {/* Rx Symbol */}
                            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#1e293b', marginBottom: '20px', fontFamily: 'serif' }}>℞</div>

                            {/* Medications Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                                        <th style={{ padding: '12px 0', fontSize: '0.9rem' }}>Medication & Dosage</th>
                                        <th style={{ padding: '12px 0', fontSize: '0.9rem' }}>Route & Freq</th>
                                        <th style={{ padding: '12px 0', fontSize: '0.9rem' }}>Duration</th>
                                        <th style={{ padding: '12px 0', fontSize: '0.9rem', textAlign: 'right' }}>Dispense Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prescriptions.map((p, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '16px 0' }}>
                                                <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#1e293b' }}>{p.drug_name}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{p.dosage} • {p.food_relation}</div>
                                                {p.instructions && <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#94a3b8' }}>Inst: {p.instructions}</div>}
                                            </td>
                                            <td style={{ padding: '16px 0', verticalAlign: 'top' }}>
                                                <div style={{ fontWeight: '700' }}>{p.route}</div>
                                                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{p.frequency}</div>
                                            </td>
                                            <td style={{ padding: '16px 0', verticalAlign: 'top' }}>{p.duration}</td>
                                            <td style={{ padding: '16px 0', textAlign: 'right', verticalAlign: 'top' }}>
                                                <div style={{ fontWeight: '800' }}>{p.quantity || 'Course Qty'}</div>
                                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Refills: {p.refills}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Footer / Signature */}
                            <div style={{ marginTop: '60px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'end' }}>
                                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '40px' }}>Doctor's Signature</div>
                                    <div style={{ fontWeight: '800', color: '#1e293b' }}>Dr. Specialist</div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Reg: KMDC-2024-XP</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>This prescription is valid for 7 days from the date of issue.</div>
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '5px' }}>Generated by eDoc Clinical Terminal</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <ClinicalModal
                isOpen={clinicalModal.open}
                onClose={() => setClinicalModal({ ...clinicalModal, open: false })}
                type={clinicalModal.type}
                title={clinicalModal.title}
                message={clinicalModal.message}
                onConfirm={clinicalModal.onConfirm}
                confirmText="Proceed Anyway"
                cancelText="Cancel"
            />

            {/* Toast Notification */}
            {toast.show && (
                <div style={{
                    position: 'fixed', bottom: '30px', right: '30px', zIndex: 9999,
                    background: toast.type === 'success' ? '#10b981' : '#ef4444',
                    color: 'white', padding: '16px 24px', borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    animation: 'slideIn 0.3s ease-out', fontWeight: '700'
                }}>
                    {toast.type === 'success' ? <ClipboardCheck size={20} /> : <AlertTriangle size={20} />}
                    {toast.message}
                    <button onClick={() => setToast({ ...toast, show: false })} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginLeft: '10px' }}><X size={16} /></button>
                </div>
            )}
        </div>
    );
};

export default ConsultationModule;
