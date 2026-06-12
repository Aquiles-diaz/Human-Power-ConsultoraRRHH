// ─────────────────────────────────────────────────────────────────────────────
// Datos estáticos de puestos (fake data por ahora — reemplazar por API real).
// Compartido entre la página pública de Ofertas y el panel de administración,
// para que ambos hablen del mismo catálogo de puestos.
// ─────────────────────────────────────────────────────────────────────────────

export type JobType = "Presencial" | "Remoto" | "Híbrido";

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  type: JobType;
  seniority: string;
  salary: string;
  postedAt: string; // ISO date
  shortDescription: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  skills: string[];
};

export const JOBS: Job[] = [
  {
    id: "analista-contable-jr",
    title: "Analista Contable Jr.",
    company: "Estudio Contable Rosell",
    location: "Rosario, Santa Fe",
    type: "Presencial",
    seniority: "Junior",
    salary: "$700.000 - $950.000 ARS",
    postedAt: "2026-06-02",
    shortDescription:
      "Sumate a nuestro equipo financiero para tareas de contabilidad general, conciliaciones y reportes.",
    description:
      "Buscamos un/a Analista Contable Junior para unirse a nuestro equipo financiero. Vas a trabajar codo a codo con el equipo de finanzas dando soporte en la registración contable, conciliaciones bancarias y armado de reportes para la toma de decisiones. Es una excelente oportunidad para crecer dentro de un estudio en expansión.",
    responsibilities: [
      "Registrar operaciones contables y mantener los libros al día.",
      "Realizar conciliaciones bancarias mensuales.",
      "Colaborar en el armado de balances y reportes financieros.",
      "Dar soporte en liquidaciones impositivas básicas.",
    ],
    requirements: [
      "Estudiante avanzado/a o graduado/a de Contador Público.",
      "Manejo de Excel intermedio.",
      "Conocimientos de normativa contable e impositiva argentina.",
      "Atención al detalle y proactividad.",
    ],
    benefits: ["Obra social premium", "Capacitaciones pagas", "Viernes flex"],
    skills: ["Excel", "Tango Gestión", "Conciliaciones", "Impuestos"],
  },
  {
    id: "frontend-react",
    title: "Desarrollador/a Frontend React",
    company: "Nube Studio",
    location: "Remoto (ARG)",
    type: "Remoto",
    seniority: "Semi-Senior",
    salary: "USD 1.800 - 2.600",
    postedAt: "2026-06-05",
    shortDescription:
      "Construí interfaces modernas y performantes en React para clientes de toda LATAM.",
    description:
      "Estamos buscando un/a Desarrollador/a Frontend con experiencia sólida en React para construir interfaces modernas, accesibles y performantes. Trabajarás en un equipo ágil, 100% remoto, con código prolijo, code reviews y foco en la experiencia de usuario.",
    responsibilities: [
      "Desarrollar componentes reutilizables con React + TypeScript.",
      "Colaborar con diseño para llevar prototipos a producción.",
      "Optimizar performance y accesibilidad.",
      "Participar de code reviews y mejorar la base de código.",
    ],
    requirements: [
      "2+ años con React y TypeScript.",
      "Sólido manejo de HTML/CSS y Tailwind.",
      "Experiencia consumiendo APIs REST.",
      "Inglés técnico (lectura).",
    ],
    benefits: ["100% remoto", "Pago en USD", "2 semanas extra de vacaciones", "Equipo provisto"],
    skills: ["React", "TypeScript", "Tailwind", "Vite", "REST"],
  },
  {
    id: "vendedor-comercial",
    title: "Vendedor/a Comercial",
    company: "Distribuidora del Litoral",
    location: "Zona Norte, Rosario",
    type: "Híbrido",
    seniority: "Junior / Ssr",
    salary: "$650.000 + comisiones",
    postedAt: "2026-05-28",
    shortDescription:
      "Perfil proactivo para ampliar cartera de clientes en la zona norte de Rosario.",
    description:
      "Oportunidad para un/a Vendedor/a Comercial con perfil proactivo y excelentes habilidades de comunicación. Tu objetivo será ampliar y fidelizar la cartera de clientes en la zona norte, gestionando todo el ciclo de venta.",
    responsibilities: [
      "Prospectar y captar nuevos clientes.",
      "Gestionar la cartera existente y fidelizar.",
      "Cumplir objetivos de venta mensuales.",
      "Reportar resultados al área comercial.",
    ],
    requirements: [
      "Experiencia previa en ventas (deseable).",
      "Excelente comunicación y orientación a resultados.",
      "Movilidad propia.",
      "Disponibilidad para visitas a clientes.",
    ],
    benefits: ["Comisiones sin tope", "Movilidad paga", "Premios por objetivos"],
    skills: ["Ventas", "Negociación", "CRM", "Atención al cliente"],
  },
  {
    id: "marketing-digital",
    title: "Especialista en Marketing Digital",
    company: "Agencia Pulso",
    location: "Remoto (ARG)",
    type: "Remoto",
    seniority: "Semi-Senior",
    salary: "$1.100.000 - $1.500.000 ARS",
    postedAt: "2026-06-07",
    shortDescription:
      "Planificá y ejecutá campañas online: SEO, SEM y redes sociales.",
    description:
      "Buscamos un/a Especialista en Marketing Digital para planificar y ejecutar campañas online de punta a punta. Vas a liderar estrategias de SEO, SEM y redes sociales para múltiples clientes, midiendo resultados y optimizando constantemente.",
    responsibilities: [
      "Diseñar y ejecutar campañas en Google Ads y Meta Ads.",
      "Optimizar SEO on-page y off-page.",
      "Gestionar el calendario de redes sociales.",
      "Analizar métricas y reportar ROI.",
    ],
    requirements: [
      "Experiencia comprobable en campañas pagas.",
      "Manejo de Google Analytics y Search Console.",
      "Conocimientos de SEO.",
      "Creatividad y orientación a datos.",
    ],
    benefits: ["100% remoto", "Horario flexible", "Presupuesto de capacitación"],
    skills: ["Google Ads", "Meta Ads", "SEO", "Analytics", "Redes"],
  },
  {
    id: "analista-datos",
    title: "Analista de Datos",
    company: "Logística Sur",
    location: "Rosario, Santa Fe",
    type: "Híbrido",
    seniority: "Semi-Senior",
    salary: "$1.200.000 - $1.600.000 ARS",
    postedAt: "2026-06-01",
    shortDescription:
      "Interpretá información y generá reportes que orienten las decisiones del negocio.",
    description:
      "Necesitamos un/a Analista de Datos para interpretar información y generar reportes estadísticos que orienten la toma de decisiones del negocio. Trabajarás con grandes volúmenes de datos operativos y construirás dashboards para distintas áreas.",
    responsibilities: [
      "Construir y mantener dashboards de KPIs.",
      "Realizar análisis ad-hoc para distintas áreas.",
      "Garantizar la calidad de los datos.",
      "Automatizar reportes recurrentes.",
    ],
    requirements: [
      "Manejo de SQL avanzado.",
      "Experiencia con herramientas de BI (Power BI / Looker).",
      "Python o R (deseable).",
      "Pensamiento analítico.",
    ],
    benefits: ["Esquema híbrido", "Bono anual por desempeño", "Capacitaciones"],
    skills: ["SQL", "Power BI", "Python", "Estadística"],
  },
  {
    id: "soporte-tecnico-n2",
    title: "Soporte Técnico Nivel 2",
    company: "TecnoServicios SRL",
    location: "Rosario, Santa Fe",
    type: "Presencial",
    seniority: "Semi-Senior",
    salary: "$850.000 - $1.100.000 ARS",
    postedAt: "2026-05-30",
    shortDescription:
      "Resolvé incidencias complejas de hardware y software para nuestros clientes.",
    description:
      "Responsable de brindar soporte técnico avanzado (Nivel 2), resolviendo incidencias complejas de hardware y software para nuestros clientes corporativos. Serás el punto de escalamiento del equipo de Nivel 1.",
    responsibilities: [
      "Atender y resolver tickets escalados desde Nivel 1.",
      "Diagnosticar problemas de hardware, redes y software.",
      "Documentar soluciones en la base de conocimiento.",
      "Capacitar al equipo de Nivel 1.",
    ],
    requirements: [
      "Experiencia en soporte técnico de Nivel 2.",
      "Conocimientos de redes (TCP/IP, VPN).",
      "Manejo de Windows y Active Directory.",
      "Orientación al cliente.",
    ],
    benefits: ["Obra social", "Capacitaciones certificadas", "Buen clima de trabajo"],
    skills: ["Redes", "Windows Server", "Active Directory", "Helpdesk"],
  },
];

export function getJobById(id: string | null | undefined): Job | undefined {
  if (!id) return undefined;
  return JOBS.find((j) => j.id === id);
}
