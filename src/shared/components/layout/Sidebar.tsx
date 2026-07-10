import { NavLink } from "react-router-dom";
import {
  Users,
  UserCog,
  CalendarDays,
  ClipboardList,
  Receipt,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { useAuthStore } from "@store/auth-store";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  masterOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: "/patients", label: "Pacientes", icon: <Users size={20} /> },
  { to: "/doctors", label: "Doctores", icon: <UserCog size={20} /> },
  { to: "/appointments", label: "Citas", icon: <CalendarDays size={20} /> },
  { to: "/procedures", label: "Procedimientos", icon: <ClipboardList size={20} /> },
  { to: "/consents", label: "Consentimientos", icon: <ShieldCheck size={20} /> },
  { to: "/billing", label: "Facturación", icon: <Receipt size={20} /> },
  { to: "/users", label: "Usuarios", icon: <UsersRound size={20} />, masterOnly: true },
  { to: "/settings", label: "Configuración", icon: <Settings size={20} /> },
];

export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const visibleItems = navItems.filter(
    (item) => !item.masterOnly || user?.role === "master"
  );

  return (
    <aside className="flex h-full w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-center border-b border-gray-200 px-4">
        <h1 className="text-lg font-bold text-blue-600">🦷 DentalSystem</h1>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
