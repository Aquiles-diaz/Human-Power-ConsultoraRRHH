# backend/ratelimit.py
"""Rate limiting compartido (slowapi).

El `limiter` se importa tanto en `auth.py` (para decorar /login y /register)
como en `main.py` (para registrarlo en la app y manejar el error 429).

La clave por defecto es la IP del cliente (`get_remote_address` -> `request.client.host`).
Detrás de un proxy/CDN (Render, Vercel, Nginx) el proceso DEBE correr con
`uvicorn --proxy-headers --forwarded-allow-ips '<ips-del-proxy>'` para que uvicorn
derive `request.client.host` desde `X-Forwarded-For`. Sin eso, el rate limit se
aplicaría por la IP del proxy (todos comparten cupo). Ver `render.yaml`.
NOTA: no usar `slowapi.util.get_ipaddr`, que lee `X-Forwarded-For` sin validar el
proxy y habilitaría spoofing de IP.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address


def client_ip_key(request) -> str:
    """Clave del rate limit = IP real del cliente, robusta ante spoofing de XFF.

    `X-Forwarded-For` tiene la forma `cliente, proxy1, proxy2, ...`: la primera IP
    la puede FALSIFICAR el atacante. Como en Render hay exactamente un hop
    confiable (su proxy de borde), que AGREGA la IP real al final, tomamos la
    ÚLTIMA hop en vez de la primera. Así, aunque el atacante rote IPs falsas al
    frente, la clave sigue siendo su IP real y no puede evadir el límite.
    Sin XFF (dev / acceso directo), cae a `request.client.host`.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        hops = [p.strip() for p in xff.split(",") if p.strip()]
        if hops:
            return hops[-1]
    return get_remote_address(request)


# Límite global por defecto laxo; los endpoints sensibles ponen el suyo.
limiter = Limiter(key_func=client_ip_key, default_limits=[])
