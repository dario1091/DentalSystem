import { LogOut, User } from "lucide-react";
import { useAuth } from "@shared/hooks/useAuth";
import { Badge } from "@shared/components/ui";
import UpdateButton from "@shared/components/UpdateButton";
import DarkModeToggle from "@shared/components/DarkModeToggle";

const roleLabels: Record<string, string> = {
  master: "Administrador",
  doctor: "Doctor",
  auxiliary: "Auxiliar",
};

const roleVariants: Record<string, "info" | "success" | "warning"> = {
  master: "info",
  doctor: "success",
  auxiliary: "warning",
};

export function Header() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 dark:border-gray-700 dark:bg-gray-800">
      <div>
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
          Consultorio Odontológico
        </h2>
      </div>
      <div className="flex items-center gap-4">
        <UpdateButton />
        <DarkModeToggle />
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <User size={16} />
          <span>{user?.display_name || "Usuario"}</span>
          <Badge variant={roleVariants[user?.role || "master"]} dot>
            {roleLabels[user?.role || "master"]}
          </Badge>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-red-600"
        >
          <LogOut size={16} />
          Salir
        </button>
      </div>
    </header>
  );
}
