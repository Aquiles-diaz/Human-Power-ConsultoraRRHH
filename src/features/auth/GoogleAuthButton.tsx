import { GoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";

// Si no hay VITE_GOOGLE_CLIENT_ID configurado, el botón simplemente no se muestra.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function GoogleAuthButton() {
  const { loginWithGoogle } = useAuth();
  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-3 text-xs text-zinc-400">
        <span className="h-px flex-1 bg-zinc-400/30" />
        o
        <span className="h-px flex-1 bg-zinc-400/30" />
      </div>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={async (resp) => {
            if (!resp.credential) {
              toast.error("No se pudo iniciar con Google");
              return;
            }
            try {
              await loginWithGoogle(resp.credential);
            } catch (e: any) {
              toast.error("No se pudo iniciar con Google", { description: e?.message });
            }
          }}
          onError={() => toast.error("No se pudo iniciar con Google")}
          text="continue_with"
          shape="pill"
        />
      </div>
    </div>
  );
}
