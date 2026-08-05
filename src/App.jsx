import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import MainLayout from './components/layouts/MainLayout';
import { getSystemConfig } from './lib/api';
import Maintenance from './pages/Maintenance';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminRegisterPatient from './pages/admin/AdminRegisterPatient';
import AdminStaff from './pages/admin/AdminStaff';
import AdminFinancials from './pages/admin/AdminFinancials';
import AdminLogs from './pages/admin/AdminLogs';
import AdminSettings from './pages/admin/AdminSettings';
import AdminExpenses from './pages/admin/AdminExpenses';
import AdminAttendance from './pages/admin/AdminAttendance';


import DoctorDashboard from './pages/doctor/DoctorDashboard';
import ConsultationModule from './pages/doctor/ConsultationModule';
import DoctorAppointments from './pages/doctor/DoctorAppointments';
import DoctorPatients from './pages/doctor/DoctorPatients';
import DoctorPrescriptions from './pages/doctor/DoctorPrescriptions';
import DoctorLabs from './pages/doctor/DoctorLabs';
import DoctorMessages from './pages/doctor/DoctorMessages';
import DoctorReports from './pages/doctor/DoctorReports';
import DoctorSettings from './pages/doctor/DoctorSettings';
import PatientProfile from './pages/doctor/PatientProfile';
import RegistrarDashboard from './pages/registrar/RegistrarDashboard';
import RegistrarRegistration from './pages/registrar/RegistrarRegistration';
import RegistrarPatients from './pages/registrar/RegistrarPatients';
import RegistrarHistory from './pages/registrar/RegistrarHistory';
import RegistrarPrint from './pages/registrar/RegistrarPrint';
import RegistrarBilling from './pages/registrar/RegistrarBilling';
import RegistrarSettings from './pages/registrar/RegistrarSettings';
import LabDashboard from './pages/lab/LabDashboard';
import LabWorkbench from './pages/lab/LabWorkbench';
import LabResults from './pages/lab/LabResults';
import LabCatalog from './pages/lab/LabCatalog';
import LabInventory from './pages/lab/LabInventory';
import LabAnalytics from './pages/lab/LabAnalytics';
import LabSettings from './pages/lab/LabSettings';
import PharmaDashboard from './pages/pharmacy/PharmaDashboard';
import PharmaWorkbench from './pages/pharmacy/PharmaWorkbench';
import PharmaInventory from './pages/pharmacy/PharmaInventory';
import PharmaSales from './pages/pharmacy/PharmaSales';
import PharmaSettings from './pages/pharmacy/PharmaSettings';
import PharmaSuppliers from './pages/pharmacy/PharmaSuppliers';
import PharmaProcurement from './pages/pharmacy/PharmaProcurement';
import MedicineStatus from './pages/pharmacy/MedicineStatus';
import PharmaReports from './pages/pharmacy/PharmaReports';
import RegistrarReports from './pages/registrar/RegistrarReports';
import AdminReports from './pages/admin/AdminReports';
import { NotificationProvider } from './components/NotificationContext';
import ICD10Search from './components/ICD10Search';
import PwaInstallPrompt from './components/PwaInstallPrompt';

// ProtectedRoute Logic
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ width: 50, height: 50, border: '4px solid #e2e8f0', borderTopColor: '#007bff', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 24 }} />
        <h2 style={{ color: '#1e293b', fontWeight: 800, fontSize: '1.2rem', margin: 0 }}>Moonview Medical</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 8, fontWeight: 500 }}>Authenticating session...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  const { profile, loading: authLoading } = useAuth();
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getSystemConfig()
      .then(({ data }) => {
        if (!mounted || !data) return;
        const status = data.find(c => c.key === 'system_status')?.value;
        if (status === 'Maintenance Mode') {
          setIsMaintenance(true);
        }
      })
      .catch((err) => {
        console.error('Failed to check maintenance status', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  if (loading || authLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
        <div style={{ width: 50, height: 50, border: '4px solid #e2e8f0', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: 24 }} />
        <h2 style={{ color: '#1e293b', fontWeight: 800, fontSize: '1.2rem', margin: 0 }}>Moonview Medical</h2>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: 8, fontWeight: 500 }}>Initializing environment...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isAdmin = profile?.role === 'a' || profile?.role === 'Admin';
  const isLoginPage = window.location.pathname === '/login';

  if (isMaintenance && !isAdmin && !isLoginPage) {
    return <Maintenance />;
  }

  return (
    <NotificationProvider>
      <Router 
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />

          {/* PROTECTED APP SHELL */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            
            {/* Admin */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/register-patient" element={<RegistrarRegistration />} />
            <Route path="/admin/patients" element={<RegistrarPatients />} />
            <Route path="/admin/history" element={<RegistrarHistory />} />
            <Route path="/admin/billing" element={<RegistrarBilling />} />
            <Route path="/admin/print" element={<RegistrarPrint />} />
            <Route path="/admin/registrar-reports" element={<RegistrarReports />} />
            <Route path="/admin/staff" element={<AdminStaff />} />

            <Route path="/admin/financials" element={<AdminFinancials />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
            <Route path="/admin/logs" element={<AdminLogs />} />
            <Route path="/admin/expenses" element={<AdminExpenses />} />
            <Route path="/admin/attendance" element={<AdminAttendance />} />
            <Route path="/admin/reports" element={<AdminReports />} />

            {/* Doctor */}
            <Route path="/doctor" element={<DoctorDashboard />} />
            <Route path="/doctor/consultation" element={<ConsultationModule />} />
            <Route path="/doctor/appointments" element={<DoctorAppointments />} />
            <Route path="/doctor/patients" element={<DoctorPatients />} />
            <Route path="/doctor/prescriptions" element={<DoctorPrescriptions />} />
            <Route path="/doctor/labs" element={<DoctorLabs />} />
            <Route path="/doctor/settings" element={<DoctorSettings />} />
            <Route path="/doctor/reports" element={<DoctorReports />} />
            <Route path="/doctor/messages" element={<DoctorMessages />} />
            <Route path="/doctor/patient/:id" element={<PatientProfile />} />

            {/* Registrar */}
            <Route path="/registrar" element={<RegistrarDashboard />} />
            <Route path="/registrar/new-patient" element={<RegistrarRegistration />} />
            <Route path="/registrar/patients" element={<RegistrarPatients />} />
            <Route path="/registrar/history" element={<RegistrarHistory />} />
            <Route path="/registrar/billing" element={<RegistrarBilling />} />
            <Route path="/registrar/print" element={<RegistrarPrint />} />
            <Route path="/registrar/settings" element={<RegistrarSettings />} />
            <Route path="/registrar/reports" element={<RegistrarReports />} />

            {/* Lab */}
            <Route path="/lab" element={<LabDashboard />} />
            <Route path="/lab/workbench" element={<LabWorkbench />} />
            <Route path="/lab/results" element={<LabResults />} />
            <Route path="/lab/catalog" element={<LabCatalog />} />
            <Route path="/lab/inventory" element={<LabInventory />} />
            <Route path="/lab/analytics" element={<LabAnalytics />} />
            <Route path="/lab/settings" element={<LabSettings />} />

            {/* Pharmacy */}
            <Route path="/pharmacy" element={<PharmaDashboard />} />
            <Route path="/pharmacy/workbench" element={<PharmaWorkbench />} />
            <Route path="/pharmacy/inventory" element={<PharmaInventory />} />
            <Route path="/pharmacy/procurement" element={<PharmaProcurement />} />
            <Route path="/pharmacy/status" element={<MedicineStatus />} />
            <Route path="/pharmacy/suppliers" element={<PharmaSuppliers />} />
            <Route path="/pharmacy/sales" element={<PharmaSales />} />
            <Route path="/pharmacy/settings" element={<PharmaSettings />} />
            <Route path="/pharmacy/reports" element={<PharmaReports />} />

          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <PwaInstallPrompt />
    </NotificationProvider>
  );
}

export default App;