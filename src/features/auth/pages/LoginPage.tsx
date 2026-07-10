import { useState, type FormEvent } from "react";
import { useAuth } from "@shared/hooks/useAuth";
import { Button } from "@shared/components/ui";
import { Input } from "@shared/components/ui";
import { Lock, User } from "lucide-react";

interface LoginPageProps {
  onSuccess: () => void;
}

export default function LoginPage({ onSuccess }: LoginPageProps) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username, password);
      onSuccess();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="w-full max-w-sm">
        <div className="rounded-xl bg-white p-8 shadow-lg">
          <div className="mb-8 text-center">
            <div className="mb-3 text-4xl">🦷</div>
            <h1 className="text-2xl font-bold text-gray-800">DentalSystem</h1>
            <p className="mt-1 text-sm text-gray-500">
              Ingrese sus credenciales
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              leftIcon={<User size={16} />}
              required
              autoFocus
              autoComplete="username"
            />
            <Input
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock size={16} />}
              required
              autoComplete="current-password"
            />

            {error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              disabled={!username || !password}
            >
              Iniciar Sesión
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-gray-400">
            Primera vez: usuario <strong>admin</strong> / contraseña{" "}
            <strong>admin123</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
