export type Faq = { id: string; q: string; a: string };

export const CONTACT_EMAIL = "humanpower.rrhh@gmail.com";

export const FAQS: Faq[] = [
  {
    id: "cv-video",
    q: '¿Qué es el "CV en video"?',
    a: "Es tu carta de presentación en video: además del CV en PDF, sumás un video corto (idealmente de menos de 30 segundos) contándole a las empresas quién sos. Te ayuda a destacar entre cientos de CV y a mostrar tu primera impresión.",
  },
  {
    id: "postularme",
    q: "¿Cómo me postulo a una oferta?",
    a: "Entrá a Ofertas, abrí la búsqueda que te interese y tocá Postularme. Necesitás una cuenta (es gratis); subís tu CV y, si querés, un mensaje. El equipo de RRHH recibe tu postulación.",
  },
  {
    id: "cargar-cv",
    q: "¿Cómo cargo o actualizo mi CV?",
    a: "Iniciá sesión y entrá a Mi perfil. Ahí subís tu CV (PDF, DOC o DOCX) y grabás o subís tu video de presentación (de menos de 30 segundos). Podés reemplazarlo cuando quieras.",
  },
  {
    id: "costo",
    q: "¿Le cobran algo al candidato?",
    a: "No: crear tu perfil y postularte es gratis para el candidato.",
  },
  {
    id: "zonas",
    q: "¿En qué zonas o rubros buscan?",
    a: "Trabajamos con búsquedas en distintos rubros, principalmente en Santa Fe y alrededores. Mirá las ofertas abiertas y filtralas por ubicación, modalidad y rubro.",
  },
  {
    id: "tiempos",
    q: "¿Cuánto tarda el proceso?",
    a: "Depende de cada búsqueda. Si tu perfil avanza, el equipo de RRHH se pone en contacto por email. Mientras tanto, mantené tu perfil y CV actualizados.",
  },
];
