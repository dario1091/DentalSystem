import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { AppShell } from "@shared/components/layout";
import { useAuth } from "@shared/hooks/useAuth";
import TrialExpiredScreen from "@shared/components/TrialExpiredScreen";
import InitialSetup from "@shared/components/InitialSetup";
import { ProtectedRoute } from "@shared/components/ProtectedRoute";
import LoginPage from "@features/auth/pages/LoginPage";
import ChangePasswordPage from "@features/auth/pages/ChangePasswordPage";
import PatientListPage from "@features/patients/pages/PatientListPage";
import PatientFormPage from "@features/patients/pages/PatientFormPage";
import PatientDetailPage from "@features/patients/pages/PatientDetailPage";
import DoctorListPage from "@features/doctors/pages/DoctorListPage";
import AppointmentCalendarPage from "@features/appointments/pages/AppointmentCalendarPage";
import ProcedureListPage from "@features/procedures/pages/ProcedureListPage";
import ConsentListPage from "@features/consents/pages/ConsentListPage";
import BillingPage from "@features/billing/pages/BillingPage";
import SettingsPage from "@features/settings/pages/SettingsPage";
import UsersListPage from "@features/auth/pages/UsersListPage";

interface TrialStatus {
  is_expired: boolean;
  days_remaining: number;
  days_used: number;
  trial_start: string;
  trial_end: string;
  installation_id: string;
}

function App() {
  const { user, isAuthenticated, checkSession } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trialExpired, setTrialExpired] = useState(false);
  const [trialInfo, setTrialInfo] = useState<TrialStatus | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    try {
      // Check if initial setup is needed
      const setupDone = await invoke<boolean>("is_setup_completed");
      if (!setupDone) {
        setNeedsSetup(true);
        setLoading(false);
        return;
      }

      // Check license
      const licensed = await invoke<boolean>("is_licensed");
      if (!licensed) {
        const trial = await invoke<TrialStatus>("check_trial");
        setTrialInfo(trial);
        if (trial.is_expired) {
          setTrialExpired(true);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      // If license/trial check fails due to DB not ready, allow through
      // but only if setup is completed (prevents bypass)
      console.error("Trial check error:", err);
    }

    await checkSession();
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <div className="text-center">
          <div className="mb-4 text-6xl">🦷</div>
          <h1 className="mb-2 text-2xl font-bold text-gray-800">DentalSystem</h1>
          <p className="mb-4 text-sm text-gray-500">Sistema de gestión odontológica</p>
          <div className="mx-auto h-1 w-32 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full w-full animate-pulse rounded-full bg-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  // Initial setup on first run
  if (needsSetup) {
    return (
      <InitialSetup
        onCompleted={() => {
          setNeedsSetup(false);
          setLoading(true);
          initApp();
        }}
      />
    );
  }

  // Trial expired: block everything
  if (trialExpired && trialInfo) {
    return (
      <TrialExpiredScreen
        daysUsed={trialInfo.days_used}
        trialEnd={trialInfo.trial_end}
        installationId={trialInfo.installation_id}
        onActivated={() => {
          setTrialExpired(false);
          checkSession();
        }}
      />
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
          <Route path="consents" element={<ConsentListPage />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="settings" element={<ProtectedRoute allowedRoles={["master"]}><SettingsPage /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute allowedRoles={["master"]}><UsersListPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
