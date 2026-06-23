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

# Límite global por defecto laxo; los endpoints sensibles ponen el suyo.
limiter = Limiter(key_func=get_remote_address, default_limits=[])
