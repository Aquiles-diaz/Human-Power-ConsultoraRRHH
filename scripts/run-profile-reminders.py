"""Runner de Actions: configuración opcional, reintentos acotados y logs sin PII."""

import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.request


ENDPOINT = "https://human-power-api.onrender.com/tasks/profile-reminders"
TRANSIENT_STATUS = {408, 429, 500, 502, 503, 504}
MAX_ATTEMPTS = 4


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """No reenviar el secreto a otro destino mediante una redirección."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def report(message, *, error=False):
    prefix = "::error::" if error else ""
    print(f"{prefix}{message}")
    summary_path = os.getenv("GITHUB_STEP_SUMMARY")
    if summary_path:
        with Path(summary_path).open("a", encoding="utf-8") as summary:
            summary.write(message + "\n\n")


def main():
    secret = os.getenv("CRON_SECRET", "").strip()
    if not secret:
        report(
            "Recordatorios omitidos: falta CRON_SECRET en GitHub Actions. "
            "No se llamó al backend ni se enviaron correos. Para activar los "
            "recordatorios, configurar el mismo valor en Actions y Render."
        )
        return 0

    dry_run = os.getenv("REMINDERS_DRY_RUN", "false").lower() == "true"
    url = ENDPOINT + ("?dry_run=1" if dry_run else "")
    request = urllib.request.Request(
        url, data=b"", headers={"X-Cron-Secret": secret}, method="POST"
    )
    opener = urllib.request.build_opener(NoRedirect)
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with opener.open(request, timeout=150) as response:
                result = json.load(response)
            break
        except urllib.error.HTTPError as exc:
            status = exc.code
            exc.close()
            if status in (401, 403):
                report(
                    "El backend rechazó CRON_SECRET. Revisar que coincida en "
                    "Actions y Render. No se reintentó un error de autenticación.",
                    error=True,
                )
                return 1
            if status not in TRANSIENT_STATUS or attempt == MAX_ATTEMPTS:
                report(f"La tarea de recordatorios falló con HTTP {status}.", error=True)
                return 1
        except (urllib.error.URLError, TimeoutError):
            if attempt == MAX_ATTEMPTS:
                report("El backend no respondió tras los reintentos permitidos.", error=True)
                return 1
        except (ValueError, UnicodeError):
            report("El backend devolvió una respuesta no válida.", error=True)
            return 1
        report(f"Fallo transitorio; reintento {attempt + 1}/{MAX_ATTEMPTS} en 20 segundos.")
        time.sleep(20)

    # El backend también devuelve emails en 'items'. No imprimir la respuesta
    # completa: los logs de este repositorio son públicos.
    counts = ("eligible", "sent", "failed")
    if not isinstance(result, dict) or any(
        type(result.get(key)) is not int or result[key] < 0 for key in counts
    ) or result.get("dry_run") is not dry_run:
        report("La respuesta no cumple el contrato de recordatorios.", error=True)
        return 1
    mode = "Simulación sin envío" if dry_run else "Recordatorios procesados"
    report(
        f"{mode}: elegibles={result['eligible']}, enviados={result['sent']}, "
        f"fallidos={result['failed']}.",
        error=result["failed"] > 0,
    )
    return 1 if result["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
