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
import os

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

# Tope por HORA de los endpoints públicos que mandan un mail por cada pedido
# (/register, /password-reset/request, /verify-email/request y /contacto). El
# tope por minuto que ya tenían frena una ráfaga pero no cuida una cuota diaria:
# 5 por minuto en los cuatro son 1.200 mails por hora desde una sola IP, y Brevo
# free da 300 por día para todo. Con estos valores una IP saca a lo sumo 50 por
# hora. Es una mitigación, no un presupuesto: muchas IPs distintas lo esquivan.
# El registro va más alto porque es el único que una persona real repite poco
# pero muchas personas hacen a la vez (una oferta que se viraliza).
REGISTER_RATE_LIMIT_HOUR = os.getenv("REGISTER_RATE_LIMIT_HOUR", "20/hour")
MAIL_REQUEST_RATE_LIMIT_HOUR = os.getenv("MAIL_REQUEST_RATE_LIMIT_HOUR", "10/hour")
