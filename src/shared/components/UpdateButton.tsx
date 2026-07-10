import { useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Download, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@shared/components/ui";

type UpdateState = "idle" | "checking" | "available" | "downloading" | "ready" | "error" | "up-to-date";

export default function UpdateButton() {
  const [state, setState] = useState<UpdateState>("idle");
  const [progress, setProgress] = useState(0);
  const [version, setVersion] = useState("");
  const [error, setError] = useState("");

  const checkForUpdates = async () => {
    setState("checking");
    setError("");

    try {
      const update = await check();

      if (update) {
        setVersion(update.version);
        setState("available");
      } else {
        setState("up-to-date");
        setTimeout(() => setState("idle"), 3000);
      }
    } catch (err) {
      // Network errors, 404 (no release yet), etc. = treat as up to date
      const errMsg = String(err).toLowerCase();
      if (errMsg.includes("network") || errMsg.includes("404") || errMsg.includes("fetch") || errMsg.includes("endpoint")) {
        setState("up-to-date");
        setTimeout(() => setState("idle"), 3000);
      } else {
        setError(String(err));
        setState("error");
        setTimeout(() => setState("idle"), 5000);
      }
    }
  };

  const downloadAndInstall = async () => {
    setState("downloading");
    setProgress(0);

    try {
      const update = await check();
      if (!update) return;

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case "Finished":
            setProgress(100);
            break;
        }
      });

      setState("ready");
    } catch (err) {
      setError(String(err));
      setState("error");
    }
  };

  const handleRelaunch = async () => {
    await relaunch();
  };

  // Render based on state
  if (state === "idle") {
    return (
      <Button
        variant="ghost"
        size="sm"
        icon={<RefreshCw size={14} />}
        onClick={checkForUpdates}
      >
        Buscar actualizaciones
      </Button>
    );
  }

  if (state === "checking") {
    return (
      <Button variant="ghost" size="sm" disabled>
        <RefreshCw size={14} className="animate-spin" />
        Verificando...
      </Button>
    );
  }

  if (state === "up-to-date") {
    return (
      <Button variant="ghost" size="sm" disabled>
        <CheckCircle size={14} className="text-green-500" />
        Está actualizado
      </Button>
    );
  }

  if (state === "available") {
    return (
      <Button
        variant="primary"
        size="sm"
        icon={<Download size={14} />}
        onClick={downloadAndInstall}
      >
        Actualizar a v{version}
      </Button>
    );
  }

  if (state === "downloading") {
    return (
      <div className="flex items-center gap-2">
        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-gray-500">{progress}%</span>
      </div>
    );
  }

  if (state === "ready") {
    return (
      <Button
        variant="primary"
        size="sm"
        icon={<RefreshCw size={14} />}
        onClick={handleRelaunch}
      >
        Reiniciar para actualizar
      </Button>
    );
  }

  if (state === "error") {
    return (
      <div className="flex items-center gap-2">
        <AlertCircle size={14} className="text-red-500" />
        <span className="text-xs text-red-500" title={error}>
          Error al actualizar
        </span>
      </div>
    );
  }

  return null;
}
