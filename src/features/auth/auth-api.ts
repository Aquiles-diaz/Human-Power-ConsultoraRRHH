// Llamadas de recuperación de contraseña y verificación de email.
// (El login/registro/Google viven en useProvideAuth porque tocan el estado de sesión.)
import { API } from "@/lib/api";

async function postJson(path: string, body: unknown): Promise<{ message: string }> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Error ${res.status}`;
    try {
      const d = await res.json();
      if (typeof d?.detail === "string") msg = d.detail;
      else if (Array.isArray(d?.detail))
        msg = d.detail.map((x: any) => x.msg || JSON.stringify(x)).join(" · ");
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(msg);
  }
  return res.json();
}

export const requestPasswordReset = (email: string) =>
  postJson("/password-reset/request", { email });

export const confirmPasswordReset = (token: string, new_password: string) =>
  postJson("/password-reset/confirm", { token, new_password });

export const requestEmailVerify = (email: string) =>
  postJson("/verify-email/request", { email });

export const confirmEmailVerify = (token: string) =>
  postJson("/verify-email/confirm", { token });
