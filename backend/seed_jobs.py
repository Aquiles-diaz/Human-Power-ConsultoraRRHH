# backend/seed_jobs.py
"""Carga OPCIONAL de puestos de ejemplo, para probar /ofertas en desarrollo.

Uso:
    python -m backend.seed_jobs

NO se ejecuta solo y NO conviene correrlo en producción (son datos de ejemplo;
en prod los puestos reales se crean desde el panel /admin). Es idempotente: si un
puesto con el mismo id ya existe, lo saltea.
"""
import json

from .db import get_conn, init_db

EXAMPLES = [
    {
        "id": "analista-contable-jr",
        "title": "Analista Contable Jr.",
        "company": "Estudio Contable Rosell",
        "location": "Rosario, Santa Fe",
        "type": "Presencial",
        "category": "administracion",
        "seniority": "Junior",
        "salary": "$700.000 - $950.000 ARS",
        "shortDescription": "Sumate a nuestro equipo financiero para contabilidad general, conciliaciones y reportes.",
        "description": "Buscamos un/a Analista Contable Junior para dar soporte en la registración contable, conciliaciones bancarias y armado de reportes. Excelente oportunidad para crecer dentro de un estudio en expansión.",
        "responsibilities": [
            "Registrar operaciones contables y mantener los libros al día.",
            "Realizar conciliaciones bancarias mensuales.",
            "Colaborar en el armado de balances y reportes financieros.",
        ],
        "requirements": [
            "Estudiante avanzado/a o graduado/a de Contador Público.",
            "Manejo de Excel intermedio.",
            "Conocimientos de normativa contable e impositiva argentina.",
        ],
        "benefits": ["Obra social premium", "Capacitaciones pagas", "Viernes flex"],
        "skills": ["Excel", "Tango Gestión", "Conciliaciones", "Impuestos"],
    },
    {
        "id": "desarrollador-frontend-ssr",
        "title": "Desarrollador/a Frontend (React)",
        "company": "Tech Rosario",
        "location": "Remoto (Argentina)",
        "type": "Remoto",
        "category": "it",
        "seniority": "Semi Senior",
        "salary": "$1.800.000 - $2.400.000 ARS",
        "shortDescription": "Construí interfaces modernas con React y TypeScript para productos con miles de usuarios.",
        "description": "Te sumás a un equipo de producto para desarrollar y mantener nuestra aplicación web. Trabajamos con React, TypeScript, Vite y Tailwind, con foco en calidad y experiencia de usuario.",
        "responsibilities": [
            "Desarrollar features de punta a punta en el frontend.",
            "Participar en code reviews y decisiones de arquitectura.",
            "Cuidar la accesibilidad y la performance.",
        ],
        "requirements": [
            "2+ años de experiencia con React.",
            "Manejo sólido de TypeScript.",
            "Experiencia con APIs REST.",
        ],
        "benefits": ["100% remoto", "Días de estudio", "Equipamiento a cargo de la empresa"],
        "skills": ["React", "TypeScript", "Tailwind", "Vite"],
    },
    {
        "id": "vendedor-comercial-hibrido",
        "title": "Ejecutivo/a de Ventas",
        "company": "Distribuidora del Litoral",
        "location": "Rosario, Santa Fe",
        "type": "Híbrido",
        "category": "comercial",
        "seniority": "Semi Senior",
        "salary": "$900.000 + comisiones",
        "shortDescription": "Gestioná tu cartera de clientes y desarrollá nuevas oportunidades comerciales.",
        "description": "Buscamos un/a Ejecutivo/a de Ventas con perfil cazador para ampliar nuestra cartera en la región. Esquema híbrido con visitas a clientes y trabajo desde casa.",
        "responsibilities": [
            "Prospectar y captar nuevos clientes.",
            "Mantener y hacer crecer la cartera asignada.",
            "Elaborar reportes de venta y forecast.",
        ],
        "requirements": [
            "Experiencia comprobable en ventas B2B.",
            "Movilidad propia.",
            "Orientación a resultados.",
        ],
        "benefits": ["Comisiones sin techo", "Auto corporativo", "Obra social"],
        "skills": ["Ventas B2B", "Negociación", "CRM", "Prospección"],
    },
]


def seed_jobs() -> None:
    init_db()
    with get_conn() as con:
        cur = con.cursor()
        created = 0
        for j in EXAMPLES:
            cur.execute("SELECT 1 FROM jobs WHERE id = %s", (j["id"],))
            if cur.fetchone():
                continue
            cur.execute(
                """
                INSERT INTO jobs (id, title, company, location, type, category, seniority, salary,
                                  posted_at, short_description, description,
                                  responsibilities, requirements, benefits, skills, is_published)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s, CURRENT_DATE, %s,%s, %s,%s,%s,%s, true)
                """,
                (
                    j["id"], j["title"], j["company"], j["location"], j["type"], j["category"],
                    j["seniority"], j["salary"], j["shortDescription"], j["description"],
                    json.dumps(j["responsibilities"]), json.dumps(j["requirements"]),
                    json.dumps(j["benefits"]), json.dumps(j["skills"]),
                ),
            )
            created += 1
        con.commit()
    print(f"✅ Puestos de ejemplo cargados: {created} nuevos (de {len(EXAMPLES)}).")


if __name__ == "__main__":
    seed_jobs()
