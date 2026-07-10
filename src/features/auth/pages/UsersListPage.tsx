import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button, Badge, Table, type Column } from "@shared/components/ui";
import { Plus, RotateCcw } from "lucide-react";
import { useToast } from "@shared/components/ui";
import type { UserInfo } from "@store/auth-store";
import UserFormModal from "../components/UserFormModal";
import ResetPasswordModal from "../components/ResetPasswordModal";

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

export default function UsersListPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [resetUser, setResetUser] = useState<UserInfo | null>(null);

  const fetchUsers = async () => {
    try {
      const data = await invoke<UserInfo[]>("list_users");
      setUsers(data);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleEdit = (user: UserInfo) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingUser(null);
    fetchUsers();
  };

  const handleResetSuccess = () => {
    setResetUser(null);
    toast("success", "Contraseña restablecida exitosamente.");
  };

  const columns: Column<UserInfo & Record<string, unknown>>[] = [
    { key: "username", header: "Usuario", sortable: true },
    { key: "display_name", header: "Nombre", sortable: true },
    {
      key: "role",
      header: "Rol",
      sortable: true,
      render: (item) => (
        <Badge variant={roleVariants[item.role]} dot>
          {roleLabels[item.role]}
        </Badge>
      ),
    },
    {
      key: "must_change_password",
      header: "Estado",
      render: (item) =>
        item.must_change_password ? (
          <Badge variant="warning">Pendiente cambio</Badge>
        ) : (
          <Badge variant="success">Activo</Badge>
        ),
    },
    {
      key: "actions",
      header: "Acciones",
      render: (item) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              setResetUser(item);
            }}
          >
            Reset
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Cargando usuarios...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Gestión de Usuarios
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Crear y administrar cuentas de acceso al sistema.
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={handleCreate}>
          Nuevo Usuario
        </Button>
      </div>

      <Table
        columns={columns}
        data={users as (UserInfo & Record<string, unknown>)[]}
        keyExtractor={(item) => item.id}
        emptyMessage="No hay usuarios registrados."
      />

      {showForm && (
        <UserFormModal
          user={editingUser}
          onClose={() => setShowForm(false)}
          onSuccess={handleFormSuccess}
        />
      )}

      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSuccess={handleResetSuccess}
        />
      )}
    </div>
  );
}
