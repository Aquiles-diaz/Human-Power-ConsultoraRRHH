// Cuándo vence un token de acceso, en milisegundos (como Date.now()).
//
// Un JWT son tres partes separadas por puntos; la del medio es un JSON en
// base64 con los datos del token, entre ellos `exp` (vencimiento, en segundos).
// Acá sólo se LEE ese dato para saber cuándo conviene renovar: la firma no se
// verifica, eso lo hace el servidor en cada pedido. Si no se puede leer devuelve
// null, y entonces no se renueva (el token vence a su hora, como antes).
export function tokenExpiresAt(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    // Los JWT usan la variante de base64 para URLs: - y _ en vez de + y /.
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const exp = (JSON.parse(new TextDecoder().decode(bytes)) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}
