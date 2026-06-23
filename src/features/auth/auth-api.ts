// Llamadas de recuperación de contraseña y verificación de email.
// (El login/registro/Google viven en useProvideAuth porque tocan el estado de sesión.)
import { apiFetch, parseApiError } from "@/lib/api";

async function postJson(path: string, body: unknown): Promise<{ message: string }> {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
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
