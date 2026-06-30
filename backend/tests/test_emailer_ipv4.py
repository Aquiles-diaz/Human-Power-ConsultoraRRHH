"""El envío SMTP debe forzar IPv4.

En algunos contenedores (Render) el host tiene IPv6 asignada pero sin ruta de
salida: smtplib elige IPv6 y falla con 'OSError: [Errno 101] Network is
unreachable'. _SMTPForceIPv4 resuelve explícitamente a IPv4. Test offline contra
un listener IPv4 local (no toca Gmail). Corre con:

    PYTHONPATH=. .venv/bin/python backend/tests/test_emailer_ipv4.py
"""
import os
import socket

os.environ.setdefault("SECRET_KEY", "x" * 40)
os.environ.setdefault("DATABASE_URL", "postgresql://noop/noop")

from backend import emailer


def test_get_socket_forces_ipv4():
    # Listener IPv4 en localhost (puerto efímero).
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    port = srv.getsockname()[1]
    try:
        smtp = emailer._SMTPForceIPv4()  # sin host -> no conecta en __init__
        sock = smtp._get_socket("localhost", port, 5)
        try:
            assert sock.family == socket.AF_INET, f"esperaba IPv4, vino {sock.family!r}"
        finally:
            sock.close()
    finally:
        srv.close()


def test_raises_if_no_ipv4_address():
    smtp = emailer._SMTPForceIPv4()
    try:
        smtp._get_socket("ipv6.google.com", 587, 5)  # solo AAAA -> sin IPv4
    except OSError:
        return  # ok: debe fallar claro si no hay IPv4
    except socket.gaierror:
        return  # sin red en el runner: también aceptable, no rompe el test
    raise AssertionError("debería haber fallado al no encontrar IPv4")


TESTS = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]

if __name__ == "__main__":
    failed = 0
    for t in TESTS:
        try:
            t()
            print(f"PASS  {t.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL  {t.__name__}: {e!r}")
    print(f"\n{len(TESTS) - failed}/{len(TESTS)} passed")
    raise SystemExit(1 if failed else 0)
