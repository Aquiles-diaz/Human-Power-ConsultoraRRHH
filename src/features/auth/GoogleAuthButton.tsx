import { GoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";
import { useAuth } from "./AuthContext";
import { getErrorMessage } from "@/lib/utils";

// Si no hay VITE_GOOGLE_CLIENT_ID configurado, el botón simplemente no se muestra.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function GoogleAuthButton() {
  const { loginWithGoogle } = useAuth();
  if (!GOOGLE_CLIENT_ID) return null;

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center gap-3 text-xs text-white/60">
        <span className="h-px flex-1 bg-white/10" />
        o
        <span className="h-px flex-1 bg-white/10" />
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
            } catch (e) {
              toast.error("No se pudo iniciar con Google", { description: getErrorMessage(e) });
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
