// Escribirle a un candidato desde el panel abre Gmail web con la casilla de la
// consultora. Un mailto: abría el cliente de correo del operador con su cuenta
// personal; authuser fuerza la cuenta corporativa (o pide loguearla si falta).
export const ADMIN_MAIL_ACCOUNT = "humanpower.rrhh@gmail.com";

export function gmailCompose(to: string): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    authuser: ADMIN_MAIL_ACCOUNT,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

// En táctil la URL de compose de Gmail web no garantiza el deep-link (cae en la
// UI mobile o en el interstitial de la app): ahí conviene el mailto de siempre,
// que abre la app de correo del teléfono ya en redactar.
function isCoarsePointer(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function composeEmailProps(to: string): {
  href: string;
  target?: string;
  rel?: string;
} {
  if (isCoarsePointer()) return { href: `mailto:${to}` };
  return { href: gmailCompose(to), target: "_blank", rel: "noopener noreferrer" };
}
