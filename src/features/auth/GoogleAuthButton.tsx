import { GoogleLogin } from "@react-oauth/google";
import { Link } from "react-router-dom";
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
      {/* El alta con Google no lleva checkbox: es el camino más rápido del
          sitio y no se le agrega fricción. El consentimiento se apoya en que
          las condiciones estén a la vista ANTES de tocar el botón, porque
          create_user sella terms_accepted_at también por este camino.
          Vive acá adentro (y no en cada callsite) para que no se pueda
          olvidar al sumar una pantalla nueva con login de Google.
          Los links heredan el color del párrafo (currentColor): así una sola
          regla sobre [data-legal-notice] re-tematiza el aviso entero en
          superficies oscuras (ver AuthPage). */}
      <p
        data-legal-notice
        className="mb-3 text-center text-[12px] leading-relaxed text-muted-foreground"
      >
        Al continuar con Google aceptás la{" "}
        <Link to="/privacidad" target="_blank" className="font-medium underline underline-offset-2">
          Política de Privacidad
        </Link>{" "}
        y los{" "}
        <Link to="/terminos" target="_blank" className="font-medium underline underline-offset-2">
          Términos y Condiciones
        </Link>
        .
      </p>

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
