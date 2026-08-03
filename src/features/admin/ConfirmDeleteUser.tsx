import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export type DeletionSummary = {
  email: string;
  name: string;
  applications: number;
  has_cv: boolean;
  has_photo: boolean;
  has_video: boolean;
};

type Props = {
  summary: DeletionSummary;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
};

function listarQueSePierde(s: DeletionSummary): string {
  const partes: string[] = [];
  if (s.applications > 0) {
    partes.push(`${s.applications} ${s.applications === 1 ? "postulación" : "postulaciones"}`);
  }
  if (s.has_cv) partes.push("el CV");
  if (s.has_photo) partes.push("la foto");
  if (s.has_video) partes.push("el video");
  if (partes.length === 0) return "la cuenta y el perfil";
  return `la cuenta, el perfil, ${partes.slice(0, -1).join(", ")}${partes.length > 1 ? " y " : ""}${partes[partes.length - 1]}`;
}

/**
 * Confirmación de un borrado irreversible. Exige tipear el email a propósito:
 * un click distraído no puede borrar a nadie.
 */
export default function ConfirmDeleteUser({ summary, onCancel, onConfirm, loading }: Props) {
  const [tipeado, setTipeado] = useState("");
  const coincide = tipeado.trim().toLowerCase() === summary.email.toLowerCase();

  return (
    <Modal title="Eliminar candidato" onClose={onCancel}>
      <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-400" />
        <div className="text-sm text-white/80">
          <p>
            Se van a eliminar <strong className="text-white">{listarQueSePierde(summary)}</strong> de{" "}
            <strong className="text-white">{summary.name}</strong>.
          </p>
          <p className="mt-2 font-semibold text-red-300">Esta acción no se puede deshacer.</p>
        </div>
      </div>

      <label htmlFor="confirmar-email" className="mt-5 block text-sm text-white/70">
        Para confirmar, escribí el email del candidato:{" "}
        <span className="font-mono text-white">{summary.email}</span>
      </label>
      <input
        id="confirmar-email"
        type="text"
        value={tipeado}
        onChange={(e) => setTipeado(e.currentTarget.value)}
        autoComplete="off"
        className="mt-2 w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white outline-none focus:border-red-400"
      />

      <div className="mt-6 flex justify-end gap-3">
        {/* Sin autoFocus: Modal hace focus() sobre el contenedor del diálogo en
            un useEffect (corre después del commit) y se lo robaría igual. */}
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-white/80 hover:bg-neutral-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!coincide || loading}
          onClick={() => onConfirm()}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Eliminando…" : "Eliminar definitivamente"}
        </button>
      </div>
    </Modal>
  );
}
