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
import RewardsPage from "@features/rewards/pages/RewardsPage";
import SettingsPage from "@features/settings/pages/SettingsPage";
import UsersListPage from "@features/auth/pages/UsersListPage";

interface TrialStatusFull {
  is_expired: boolean;
  days_remaining: number;
  days_used: number;
  trial_start: string;
  trial_end: string;
  installation_id: string;
  licensed: boolean;
  is_permanent: boolean;
  warning: boolean;
  license_expires: string | null;
}

function App() {
  const { user, isAuthenticated, checkSession } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trialExpired, setTrialExpired] = useState(false);
  const [trialInfo, setTrialInfo] = useState<TrialStatusFull | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Dark mode is disabled for now: force light theme and clear any stored
  // preference so previously-enabled dark mode doesn't linger.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("theme");
  }, []);

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

      // Evaluate access (trial or license). check_trial already accounts for
      // an active license and its expiration, so it is the single source here.
      const trial = await invoke<TrialStatusFull>("check_trial");
      setTrialInfo(trial);
      if (trial.is_expired) {
        setTrialExpired(true);
        setLoading(false);
        return;
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
      {trialInfo?.warning && (
        <LicenseWarningBanner
          days={trialInfo.days_remaining}
          licensed={trialInfo.licensed}
          expires={trialInfo.license_expires}
        />
      )}
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
          <Route path="rewards" element={<RewardsPage />} />
          <Route path="settings" element={<ProtectedRoute allowedRoles={["master"]}><SettingsPage /></ProtectedRoute>} />
          <Route path="users" element={<ProtectedRoute allowedRoles={["master"]}><UsersListPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function LicenseWarningBanner({
  days,
  licensed,
  expires,
}: {
  days: number;
  licensed: boolean;
  expires: string | null;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const label = licensed ? "Tu licencia" : "Tu período de prueba";
  const when = expires ? ` (vence el ${new Date(expires).toLocaleDateString("es-CO")})` : "";
  const dayText = days === 0 ? "hoy" : days === 1 ? "en 1 día" : `en ${days} días`;

  return (
    <div className="flex items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
      <span>
        {label} vence <strong>{dayText}</strong>
        {when}. Para renovar, contacta al desarrollador.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="rounded px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200"
      >
        Ocultar
      </button>
    </div>
  );
}

export default App;
