
// =============================================================
// FILE: api.js
// PURPOSE: Central data-access layer — replaces all old fetch('/api/...')
//          calls that used to go to the Express backend.
//          All functions now use the Supabase JS client directly.
// =============================================================

import { supabase, supabaseAdmin } from './supabase';

// ----------------------------------------------------------------
// AUTH
// ----------------------------------------------------------------

export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// ----------------------------------------------------------------
// PATIENTS
// ----------------------------------------------------------------

export const getPatients = () =>
  supabase.from('patient').select('pid, pname, ptel, patient_display_id, pgender, paddress, pcity, pdob, pbloodgroup, pallergies, pconditions').order('pid', { ascending: false });

export const getRegistrarPatients = getPatients;
export const getRegistrations = getPatients;

export const searchPatients = (query) =>
  supabase
    .from('patient')
    .select('pid, pname, ptel, patient_display_id, pdob')
    .or(`pname.ilike.%${query}%,ptel.ilike.%${query}%,patient_display_id.ilike.%${query}%`)
    .limit(20);

export const searchRegistrarPatients = searchPatients;

export const getPatientById = (pid) =>
  supabase.from('patient').select('pid, pname, ptel, patient_display_id, pgender, paddress, pcity, pdob, pbloodgroup, pallergies, pconditions, ptemp, pbp, pheartrate, prespiratory, pspo2, pweight, pheight').eq('pid', pid);

export const getPatientFullRecord = getPatientById;

export const createPatient = (data) =>
  supabase.from('patient').insert([data]).select();

export const addPatient = createPatient;

export const updatePatient = (pid, data) =>
  supabase.from('patient').update(data).eq('pid', pid);

export const updatePatientRecord = updatePatient;

export const deletePatient = (pid) =>
  supabase.from('patient').delete().eq('pid', pid);

export const deletePatientRecord = deletePatient;

export const signUpPatient = (data) =>
  supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: { data: { usertype: 'patient', full_name: `${data.fname} ${data.lname}`, nic: data.nic } }
  });

export const getPatientHistory = async (pid) => {
  const { data: patient, error: patientError } = await supabase.from('patient').select('*').eq('pid', pid);
  const { data: appointments } = await supabase.from('appointment').select(`apponum, appodate, status, doctor:docid(docname)`).eq('pid', pid);
  const { data: prescriptions } = await supabase.from('prescriptions').select(`prescid, date, drug_name, docid, doctor:docid(docname)`).eq('pid', pid);
  const { data: labResults } = await supabase.from('lab_reports').select('lab_res_id, test_date, test_name, pid');
  return {
    patient,
    events: [
      ...(appointments || []).map(a => ({ type: 'appointment', id: a.apponum, event_date: a.appodate, provider: a.doctor?.docname || 'Doctor', detail: a.status })),
      ...(prescriptions || []).map(p => ({ type: 'prescription', id: p.prescid, event_date: p.date, provider: p.doctor?.docname || 'Doctor', detail: p.drug_name || p.medicine_name || 'Prescription' })),
      ...(labResults || []).map(l => ({ type: 'lab', id: l.lab_res_id, event_date: l.test_date, provider: 'Lab Technician', detail: l.test_name })),
    ].sort((a, b) => new Date(b.event_date) - new Date(a.event_date)),
    patientError,
  };
};

// ----------------------------------------------------------------
// DOCTORS & STAFF
// ----------------------------------------------------------------

export const getDoctors = () =>
  supabase.from('doctor').select('docid, docname, specialties, docemail');

export const getRegistrarDoctors = getDoctors;

export const getDoctorByEmail = (email) =>
  supabase.from('doctor').select('*').eq('docemail', email);

export const getAllStaff = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true });

  const roleMap = { a: 'Admin', d: 'Doctor', r: 'Receptionist', l: 'Lab', ph: 'Pharmacy' };

  return {
    staff: (data || []).map(p => ({
      ...p,
      role: roleMap[p.role] || 'Staff',
      name: p.full_name,
    })),
    errors: error ? [error] : [],
  };
};

export const createStaffAccount = async ({ role, name, email, password, phone, username }) => {
  const typeMap = { Doctor: 'd', Receptionist: 'r', Lab: 'l', Pharmacy: 'ph', Admin: 'a' };
  const type = typeMap[role];
  if (!type) throw new Error('Unsupported staff role');

  // Validation
  if (username) {
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return { error: { message: 'Username can only contain letters, numbers, and underscores.' } };
    }
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle();
    if (existingUser) {
      return { error: { message: 'This username is already taken. Please choose another.' } };
    }
  }

  // Require admin client
  if (!supabaseAdmin) {
    return { error: { message: 'Admin client not configured. Check VITE_SUPABASE_SERVICE_ROLE_KEY in .env' } };
  }

  // Create auth user via admin API — email_confirm:true means NO confirmation email is sent.
  // This avoids Supabase's client-side email rate limit entirely.
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { usertype: type, full_name: name, username },
  });

  if (authError) return { error: authError };

  const userId = authData.user.id;

  // Upsert profiles row (DB trigger may already create it, upsert is safe)
  await supabaseAdmin.from('profiles').upsert({
    id: userId,
    email,
    full_name: name,
    username: username || null,
    role: type,
  }, { onConflict: 'id' });

  // Insert into legacy role table
  const legacyMap = {
    d:  { table: 'doctor',         fields: { docname: name, docemail: email, doctel: phone, user_id: userId } },
    r:  { table: 'registrar',      fields: { regname: name, regemail: email, regtel: phone, user_id: userId } },
    l:  { table: 'lab_technician', fields: { labname: name, labemail: email, labtel: phone, user_id: userId } },
    ph: { table: 'pharmacist',     fields: { phname:  name, phemail:  email, phtel:  phone, user_id: userId } },
  };

  if (legacyMap[type]) {
    await supabaseAdmin.from(legacyMap[type].table).insert([legacyMap[type].fields]);
  }

  return { data: authData, error: null };
};


export const updateStaffStatus = (email, status) =>
  supabase.from('profiles').update({ status }).eq('email', email);

export const updateStaffAccount = async (email, { name, phone, username, role }) => {
  const typeMap = { Doctor: 'd', Receptionist: 'r', Lab: 'l', Pharmacy: 'ph' };
  const type = typeMap[role];

  if (username) {
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('email')
      .ilike('username', username)
      .maybeSingle();

    if (existingUser && existingUser.email !== email) {
      return { error: { message: 'This username is already taken. Please choose another.' } };
    }
  }

  // 1. Update Profiles table
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ full_name: name, username })
    .eq('email', email);

  if (profileError) return { error: profileError };

  // 2. Update Legacy table
  const legacyMap = {
    d: { table: 'doctor', nameField: 'docname', telField: 'doctel', emailField: 'docemail' },
    r: { table: 'registrar', nameField: 'regname', telField: 'regtel', emailField: 'regemail' },
    l: { table: 'lab_technician', nameField: 'labname', telField: 'labtel', emailField: 'labemail' },
    ph: { table: 'pharmacist', nameField: 'phname', telField: 'phtel', emailField: 'phemail' },
  };

  if (legacyMap[type]) {
    const { table, nameField, telField, emailField } = legacyMap[type];
    const updateData = {};
    if (name) updateData[nameField] = name;
    if (phone) updateData[telField] = phone;

    const { error: legacyError } = await supabase
      .from(table)
      .update(updateData)
      .eq(emailField, email);

    if (legacyError) return { error: legacyError };
  }

  return { error: null };
};

export const deleteStaffAccount = async (email) => {
  // We delete from profiles, but note that the Auth user still exists 
  // (requires service role to delete auth user via API)
  const { error: profileError } = await supabase.from('profiles').delete().eq('email', email);

  // Also clean up legacy tables
  const legacyTables = [
    { t: 'doctor', e: 'docemail' },
    { t: 'registrar', e: 'regemail' },
    { t: 'lab_technician', e: 'labemail' },
    { t: 'pharmacist', e: 'phemail' },
  ];

  for (const item of legacyTables) {
    await supabase.from(item.t).delete().eq(item.e, email);
  }

  return { error: profileError };
};

// ----------------------------------------------------------------
// SCHEDULES & APPOINTMENTS
// ----------------------------------------------------------------

export const getScheduleForDoctor = (docid, date) =>
  supabase.from('schedule').select('*').eq('docid', docid).eq('scheduledate', date);

export const getDoctorQueue = async (docEmail) => {
  const { data: docList } = await getDoctorByEmail(docEmail);
  const doc = Array.isArray(docList) ? docList[0] : docList;
  if (!doc || !doc.docid) {
    // If no docid mapping, return all appointments so queue is never artificially empty
    return supabase
      .from('appointment')
      .select(`appoid, apponum, status, created_at, patient:pid(pid, pname, ptel, patient_display_id, pgender), schedule:scheduleid(scheduletime, scheduledate)`)
      .order('appoid', { ascending: true });
  }
  return supabase
    .from('appointment')
    .select(`appoid, apponum, status, created_at, patient:pid(pid, pname, ptel, patient_display_id, pgender), schedule:scheduleid(scheduletime, scheduledate)`)
    .eq('docid', doc.docid)
    .order('apponum', { ascending: true });
};

export const getRegistrarActiveQueue = async () => {
  return supabase
    .from('appointment')
    .select(`appoid, status, apponum, patient:pid(pname,patient_display_id), doctor:docid(docname), consultations:consultations(id), lab_requests:lab_requests(id)`)
    .order('appoid', { ascending: false });
};

export const bookAppointment = (data) =>
  supabase.from('appointment').insert([data]).select();

export const bookRegistrarAppointment = bookAppointment;

export const updateAppointmentStatus = (appoid, status) =>
  supabase.from('appointment').update({ status }).eq('appoid', appoid);

export const getBookedPids = (date) =>
  supabase.from('appointment').select('pid').eq('appodate', date).order('pid', { ascending: true });

// ----------------------------------------------------------------
// CLINICAL
// ----------------------------------------------------------------

export const saveConsultation = (data) =>
  supabase.from('consultations').insert([data]).select();

export const getDraftConsultation = (appoid) =>
  supabase.from('consultations').select('id, appointment_id, pid, docid, status, hpi, pmh, ros, clinical_impression').eq('appointment_id', appoid).eq('status', 'draft');

export const saveVitals = (data) =>
  supabase.from('vitals_records').insert([data]);

export const getVitalsForConsultation = (consultationId) =>
  supabase.from('vitals_records').select('*').eq('consultation_id', consultationId);

export const savePrescriptions = (prescriptions) =>
  supabase.from('prescriptions').insert(prescriptions);

export const getPrescriptionsForConsultation = (consultationId) =>
  supabase.from('prescriptions').select('*').eq('consultation_id', consultationId);

// ----------------------------------------------------------------
// LAB
// ----------------------------------------------------------------

export const getLabCatalog = () =>
  supabase.from('lab_catalog').select('id, test_name, category, price, is_enabled, description, required_sample').eq('is_enabled', true).order('category');

export const getLabTests = () =>
  supabase.from('lab_catalog').select('*').order('category').order('test_name');

export const createLabTest = (data) =>
  supabase.from('lab_catalog').insert([data]).select();

export const updateLabTest = (id, data) =>
  supabase.from('lab_catalog').update(data).eq('id', id).select();

export const deleteLabTest = (id) =>
  supabase.from('lab_catalog').delete().eq('id', id);

export const saveLabRequests = (requests) =>
  supabase.from('lab_requests').insert(requests);

export const getLabRequestsForAppointment = (appoid) =>
  supabase.from('lab_requests').select('*').eq('appointment_id', appoid);

export const getDoctorLabOrders = () =>
  supabase.from('lab_requests').select('*, patient:patient(pname, pid), appointment:appointment(status)').order('created_at', { ascending: false });

export const fileLabResult = (data) =>
  supabase.from('lab_reports').insert([data]).select();

export const updateLabRequestStatus = (id, status) =>
  supabase.from('lab_requests').update({ status }).eq('id', id);

export const getLabInventory = () =>
  supabase.from('lab_inventory').select('*').order('id', { ascending: false });

export const createLabInventory = (data) =>
  supabase.from('lab_inventory').insert([data]).select();

export const updateLabInventory = (id, data) =>
  supabase.from('lab_inventory').update(data).eq('id', id);

export const updateLabCatalogItem = updateLabTest;

export const createLabCatalogItem = createLabTest;

export const getLabSamples = () =>
  supabase.from('lab_samples').select('*').order('created_at', { ascending: false });

export const collectLabSample = (data) =>
  supabase.from('lab_samples').insert([data]).select();

export const getLabAnalytics = async () => {
  const { data: requests } = await supabase.from('lab_requests').select('*');
  const { data: reports } = await supabase.from('lab_reports').select('*');
  return { requests: requests || [], reports: reports || [] };
};

// ----------------------------------------------------------------
// PHARMACY
// ----------------------------------------------------------------

export const getMedicines = () =>
  supabase.from('medicine').select('*').order('med_name');

export const getPharmacyInventory = getMedicines;
export const getInventoryForPharmacy = getMedicines;

export const searchMedicines = (query) =>
  supabase
    .from('medicine')
    .select('id, med_name, generic_name, med_type, stock_qty, expiry_date, buying_price, selling_price, unit')
    .or(`med_name.ilike.%${query}%,generic_name.ilike.%${query}%`)
    .range(0, 19);

export const createMedicine = (data) =>
  supabase.from('medicine').insert([data]).select();

export const updateMedicine = (medId, data) =>
  supabase.from('medicine').update(data).eq('id', medId);

export const updateMedicineInventory = updateMedicine;

export const deleteMedicine = (medId) =>
  supabase.from('medicine').delete().eq('id', medId);

export const getMedicineStatus = () =>
  supabase.from('medicine').select('*').order('med_name');

export const getSuppliers = () =>
  supabase.from('suppliers').select('*').order('name');

export const getSuppliersList = getSuppliers;
export const getPharmacySuppliers = getSuppliers;

export const createSupplier = (data) =>
  supabase.from('suppliers').insert([data]).select();

export const createProcurementOrder = (data) =>
  supabase.from('procurement_orders').insert([data]).select();

export const createProcurement = createProcurementOrder;

export const createProcurementItems = (items) =>
  supabase.from('procurement_items').insert(items);

export const getProcurementOrders = () =>
  supabase.from('procurement_orders').select('*, supplier:suppliers(name), items:procurement_items(*)').order('created_at', { ascending: false });

export const receiveProcurementOrder = (id, data) =>
  supabase.from('procurement_orders').update(data).eq('id', id);

export const updateProcurementReceipt = receiveProcurementOrder;

export const createSale = (saleData) =>
  supabase.from('sales').insert([saleData]).select();

export const createPharmacySale = createSale;

export const createSaleItems = (items) =>
  supabase.from('pharmacy_sale_item').insert(items);

export const getSales = () =>
  supabase.from('sales').select('*, patient:patient(pname)').order('created_at', { ascending: false });

export const getPharmacySales = getSales;
export const getMedicineSales = getSales;
export const getMedicineOrderHistory = getSales;

export const getPharmacyRequests = () =>
  supabase.from('prescriptions').select('*').order('created_at', { ascending: false });

export const getPharmacyStats = async () => {
  const { data: pharmacySales } = await supabase.from('pharmacy_sale').select('total_amount');
  const { data: inventory } = await supabase.from('medicine').select('stock_qty');
  return {
    totalSales: pharmacySales?.reduce((sum, item) => sum + Number(item.total_amount || 0), 0) || 0,
    inventoryCount: inventory?.reduce((sum, item) => sum + Number(item.stock_qty || 0), 0) || 0,
  };
};

// ----------------------------------------------------------------
// ADMIN & CONFIG
// ----------------------------------------------------------------

export const getAdminStats = async () => {
  const today = new Date().toISOString().split('T')[0];
  const startOfDay = `${today}T00:00:00`;
  const endOfDay = `${today}T23:59:59`;

  const [
    patientResult,
    profileResult,
    pharmacyResult,
    labResult,
    prescriptionResult
  ] = await Promise.all([
    supabase.from('patient').select('pid'),
    supabase.from('profiles').select('role'),
    supabase.from('pharmacy_sale').select('*'),
    supabase.from('lab_reports').select('id, cost, created_at'),
    supabase.from('prescriptions').select('id').gte('created_at', startOfDay).lte('created_at', endOfDay),
  ]);

  const patients = patientResult.data || [];
  const profiles = profileResult.data || [];
  const pharmacySales = pharmacyResult.data || [];
  const labReports = labResult.data || [];
  const todaysPrescriptions = prescriptionResult.data || [];

  const staffCounts = profiles.reduce((acc, p) => {
    if (p.role === 'd') acc.doctors++;
    if (p.role === 'r') acc.registrars++;
    if (p.role === 'l') acc.lab_techs++;
    if (p.role === 'ph') acc.pharmacists++;
    return acc;
  }, { doctors: 0, registrars: 0, lab_techs: 0, pharmacists: 0 });

  const pharmacyRevenue = pharmacySales.reduce((sum, row) => sum + Number(row.total_amount || 0), 0) || 0;
  const labRevenue = labReports.reduce((sum, row) => sum + Number(row.cost || 0), 0) || 0;

  return {
    totalPatients: patients.length || 0,
    staff: staffCounts,
    revenue: { pharmacy: pharmacyRevenue, lab: labRevenue, total: pharmacyRevenue + labRevenue },
    todayClinicalVolume: todaysPrescriptions.length || 0,
  };
};

export const getAdminFinancials = async () => {
  const { data: phSales } = await supabase.from('pharmacy_sale').select('*').order('created_at', { ascending: false });
  const { data: lSales } = await supabase.from('lab_reports').select('*').order('created_at', { ascending: false });
  return { pharmacy_sales: phSales || [], lab_sales: lSales || [] };
};

export const getAdminProfitStats = async () => {
  const { data: pharmacyData } = await supabase.from('pharmacy_sale').select('*');
  const { data: labData } = await supabase.from('lab_reports').select('id, cost');
  const { data: expenseData } = await supabase.from('expenses').select('amount');
  const { data: saleItems } = await supabase.from('pharmacy_sale_item').select('*');
  const grossRevenue = (pharmacyData?.reduce((sum, row) => sum + Number(row.total_amount || 0), 0) || 0) + (labData?.reduce((sum, row) => sum + Number(row.cost || 0), 0) || 0);
  const opex = expenseData?.reduce((sum, row) => sum + Number(row.amount || 0), 0) || 0;
  const cogs = saleItems?.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.buying_price || 0), 0) || 0;
  return { gross_revenue: grossRevenue, cogs, opex, net_profit: grossRevenue - (cogs + opex) };
};

export const getPasswordChangeRequests = () =>
  supabase.from('password_change_requests').select('*').order('created_at', { ascending: false });

export const updatePasswordChangeRequestStatus = (id, status) =>
  supabase.from('password_change_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id);

export const createPasswordChangeRequest = (data) =>
  supabase.from('password_change_requests').insert([data]).select();

export const updateCurrentUserProfile = async (data) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No active session');

  const currentEmail = user.email;

  const updates = {};
  if (data.full_name) updates.full_name = data.full_name;
  if (data.email) updates.email = data.email;

  if (Object.keys(updates).length > 0) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('email', currentEmail);

    if (profileError) return { error: profileError };
  }

  const authUpdates = {};
  if (data.email) authUpdates.email = data.email;
  if (data.password) authUpdates.password = data.password;

  if (Object.keys(authUpdates).length > 0) {
    const { error: authError } = await supabase.auth.updateUser(authUpdates);
    if (authError) return { error: authError };
  }

  return { error: null };
};

export const getAdminLogs = () =>
  supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);

export const getAdminExpenses = () =>
  supabase.from('expenses').select('*').order('expense_date', { ascending: false });

export const createExpense = (data) =>
  supabase.from('expenses').insert([data]).select();

export const getSystemConfig = () =>
  supabase.from('system_config').select('*');

export const updateSystemConfig = async (configUpdates) => {
  const operations = Object.entries(configUpdates).map(([key, value]) =>
    supabase.from('system_config').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  );
  return Promise.all(operations);
};

export const getTreatmentBundles = () =>
  supabase.from('treatment_bundles').select('*').eq('is_active', true).order('id', { ascending: true });

export const createTreatmentBundle = (bundle) =>
  supabase.from('treatment_bundles').insert([bundle]).select();

export const deleteTreatmentBundle = (id) =>
  supabase.from('treatment_bundles').update({ is_active: false }).eq('id', id);

export const getPricingMatrix = () =>
  supabase.from('pricing_matrix').select('*').eq('is_active', true).order('category');

export const createPricingMatrix = (data) =>
  supabase.from('pricing_matrix').insert([data]).select();

export const updatePricingMatrix = (id, data) =>
  supabase.from('pricing_matrix').update(data).eq('id', id);

// ----------------------------------------------------------------
// MISC
// ----------------------------------------------------------------

export const searchIcd10 = (query) =>
  supabase.from('icd10')
    .select('id, code, name')
    .or(`code.ilike.%${query}%,name.ilike.%${query}%`)
    .limit(50);

export const getNotifications = (email) =>
  supabase.from('notifications').select('*').eq('recipient_email', email).order('created_at', { ascending: false }).limit(20);

export const markAllNotificationsRead = (email) =>
  supabase.from('notifications').update({ status: 'read' }).eq('recipient_email', email);
