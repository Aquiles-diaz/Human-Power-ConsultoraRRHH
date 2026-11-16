# backend/observability.py
"""Alertas de fallas con Sentry (opcional: sólo si hay SENTRY_DSN).

Antes, un mail que fallaba —una postulación, una alerta, un reset— quedaba sólo
en el log de Render, que nadie mira y que el plan free guarda poco tiempo. Con
Sentry, todo log.error / log.exception y toda excepción no manejada de un
endpoint llegan como alerta por mail (plan gratis: 5.000 eventos/mes).

Privacidad (Ley 25.326): send_default_pii=False no alcanza, porque varios logs
llevan el email del usuario en el texto ("Fallo el recordatorio de perfil a
x@y.com"). scrub_event tacha cualquier email del evento antes de que salga del
servidor, y las variables locales de los frames no se mandan; para investigar
alcanza con el mensaje y el stacktrace.
"""
from __future__ import annotations

import os
import re

_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def _scrub(value):
    if isinstance(value, str):
        return _EMAIL.sub("[email]", value)
    if isinstance(value, dict):
        return {k: _scrub(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_scrub(v) for v in value]
    return value


# Headers que no salen del servidor. Sentry ya filtra Authorization y Cookie
# cuando send_default_pii=False, pero no conoce el secreto del cron; van los
# tres para no depender de la versión del SDK.
_SENSITIVE_HEADERS = {"x-cron-secret", "authorization", "cookie"}


def scrub_event(event, hint):
    """before_send de Sentry: el evento sale sin ningún email adentro (mensaje,
    parámetros del log, texto de la excepción, breadcrumbs) y sin el contenido
    del request: ni body, ni cookies, ni headers con credenciales. Queda la URL
    y el método, que alcanzan para saber dónde falló."""
    request = event.get("request")
    if isinstance(request, dict):
        request.pop("data", None)
        request.pop("cookies", None)
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {
                k: v for k, v in headers.items() if str(k).lower() not in _SENSITIVE_HEADERS
            }
    return _scrub(event)


def init_sentry(dsn: str | None = None, **extra) -> bool:
    """Activa Sentry si hay DSN. Devuelve si quedó activo. `extra` es para los
    tests (un transport que captura en memoria)."""
    dsn = os.getenv("SENTRY_DSN", "") if dsn is None else dsn
    if not dsn:
        return False
    import sentry_sdk

    sentry_sdk.init(
        dsn=dsn,
        environment=os.getenv("SENTRY_ENVIRONMENT")
        or ("production" if os.getenv("RENDER") else "development"),
        send_default_pii=False,
        # Por defecto Sentry adjunta las variables locales de cada frame: en un
        # endpoint de perfil serían nombre, teléfono o fecha de nacimiento del
        # candidato, y el tachado sólo cubre emails. Con el stacktrace alcanza.
        include_local_variables=False,
        # Por defecto Sentry también adjunta el body del request y sólo tacha
        # campos llamados exactamente `password` o `token`: `new_password`,
        # `current_password` o el `credential` de Google viajaban en claro.
        # "never" hace que ni lo lea; scrub_event lo vuelve a quitar por si una
        # versión futura del SDK cambia el comportamiento.
        max_request_body_size="never",
        # Sólo errores: el tracing de performance consume la cuota gratis.
        traces_sample_rate=0.0,
        before_send=scrub_event,
        before_breadcrumb=lambda crumb, hint: _scrub(crumb),
        **extra,
    )
    return True
