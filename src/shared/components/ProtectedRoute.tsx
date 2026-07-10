import { Navigate } from "react-router-dom";
import { useAuthStore } from "@store/auth-store";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-400">
        <p className="text-lg font-medium">Acceso restringido</p>
        <p className="text-sm">No tiene permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return <>{children}</>;
}
