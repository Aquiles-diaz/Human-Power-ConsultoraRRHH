# backend/ratelimit.py
"""Rate limiting compartido (slowapi).

El `limiter` se importa tanto en `auth.py` (para decorar /login y /register)
como en `main.py` (para registrarlo en la app y manejar el error 429).

La clave por defecto es la IP del cliente. Detrás de un proxy/CDN (Vercel,
Nginx) hay que asegurarse de propagar `X-Forwarded-For`; slowapi usa
`request.client.host`, así que el proxy debe setear bien la IP real.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Límite global por defecto laxo; los endpoints sensibles ponen el suyo.
limiter = Limiter(key_func=get_remote_address, default_limits=[])
