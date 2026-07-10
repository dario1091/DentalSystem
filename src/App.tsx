import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@shared/components/layout";
import { useAuth } from "@shared/hooks/useAuth";
import LoginPage from "@features/auth/pages/LoginPage";
import ChangePasswordPage from "@features/auth/pages/ChangePasswordPage";
import PatientListPage from "@features/patients/pages/PatientListPage";
import PatientFormPage from "@features/patients/pages/PatientFormPage";
import PatientDetailPage from "@features/patients/pages/PatientDetailPage";
import DoctorListPage from "@features/doctors/pages/DoctorListPage";
import AppointmentCalendarPage from "@features/appointments/pages/AppointmentCalendarPage";
import ProcedureListPage from "@features/procedures/pages/ProcedureListPage";
import OdontogramPage from "@features/odontogram/pages/OdontogramPage";
import ClinicalHistoryPage from "@features/clinical-history/pages/ClinicalHistoryPage";
import DocumentsPage from "@features/documents/pages/DocumentsPage";
import ConsentListPage from "@features/consents/pages/ConsentListPage";
import BillingPage from "@features/billing/pages/BillingPage";
import SettingsPage from "@features/settings/pages/SettingsPage";
import UsersListPage from "@features/auth/pages/UsersListPage";

function App() {
  const { user, isAuthenticated, checkSession } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-3 text-4xl">🦷</div>
          <p className="text-sm text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  // Not authenticated: show login
  if (!isAuthenticated) {
    return <LoginPage onSuccess={() => {}} />;
  }

  // Must change password
  if (user?.must_change_password) {
    return <ChangePasswordPage onSuccess={() => {}} />;
  }

  // Authenticated: show app
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/patients" replace />} />
          <Route path="patients" element={<PatientListPage />} />
          <Route path="patients/new" element={<PatientFormPage />} />
          <Route path="patients/:id" element={<PatientDetailPage />} />
          <Route path="patients/:id/edit" element={<PatientFormPage />} />
          <Route path="doctors" element={<DoctorListPage />} />
          <Route path="appointments" element={<AppointmentCalendarPage />} />
          <Route path="procedures" element={<ProcedureListPage />} />
          <Route path="odontogram" element={<OdontogramPage />} />
          <Route path="clinical-history" element={<ClinicalHistoryPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="consents" element={<ConsentListPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="users" element={<UsersListPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
