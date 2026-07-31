// Textos legales del portal. Viven acá, separados del componente, para que
// actualizar una cláusula no toque JSX.
//
// Describen lo que el sistema REALMENTE hace hoy: qué se pide, qué llega desde
// Google, dónde se guarda y cómo se pide la baja. Si el sistema cambia, esto
// cambia con él.

export type LegalDoc = {
  titulo: string;
  actualizado: string;
  secciones: { titulo: string; parrafos: string[] }[];
};

const CONTACTO = "humanpower.rrhh@gmail.com";

export const PRIVACIDAD: LegalDoc = {
  titulo: "Política de Privacidad",
  actualizado: "31 de julio de 2026",
  secciones: [
    {
      titulo: "Quiénes somos",
      parrafos: [
        "Human Power | RRHH es una consultora de recursos humanos con sede en Rosario, Argentina. Somos responsables del tratamiento de los datos personales que se cargan en este sitio.",
        `Para cualquier consulta sobre tus datos podés escribirnos a ${CONTACTO}.`,
      ],
    },
    {
      titulo: "Qué datos recolectamos",
      parrafos: [
        "Cuando creás una cuenta te pedimos nombre, apellido y correo electrónico.",
        "Si completás tu perfil, podés cargar además: teléfono, fecha de nacimiento, ciudad, provincia y país, área profesional, título obtenido, nivel de educación, años de experiencia, disponibilidad, pretensión salarial, idiomas, tu currículum, una foto de perfil y un video de presentación.",
        "Todos esos datos son opcionales salvo los del alta. Vos elegís cuánto contás.",
      ],
    },
    {
      titulo: "Si entrás con Google",
      parrafos: [
        "Si iniciás sesión con Google, recibimos de tu cuenta el nombre, el correo electrónico y la foto de perfil, y los usamos para crear tu cuenta y pre-cargar tu perfil. No accedemos a tus contactos, ni a tu correo, ni a ningún otro dato de tu cuenta de Google.",
      ],
    },
    {
      titulo: "Para qué los usamos",
      parrafos: [
        "Usamos tus datos para gestionar procesos de selección: evaluar tu perfil, contactarte y presentarte a búsquedas laborales.",
        "Cuando te postulás a una búsqueda, compartimos tu perfil y tu currículum con la empresa cliente que la publica. Ese es el propósito del portal.",
        "No vendemos tus datos ni los usamos para publicidad.",
      ],
    },
    {
      titulo: "Dónde se guardan",
      parrafos: [
        "Los datos se almacenan en servidores de Supabase ubicados en Estados Unidos y Canadá, y el sitio se sirve a través de Vercel. Eso implica una transferencia internacional de datos, que aceptás al usar el portal.",
      ],
    },
    {
      titulo: "Cuánto tiempo los conservamos",
      parrafos: [
        "Conservamos tus datos mientras tu cuenta esté activa, porque un perfil vigente es lo que nos permite considerarte para búsquedas futuras.",
        `Podés pedir la baja cuando quieras escribiendo a ${CONTACTO}, y la ejecutamos: se eliminan tu cuenta, tu perfil, tu currículum, tu foto, tu video y tus postulaciones.`,
      ],
    },
    {
      titulo: "Tus derechos",
      parrafos: [
        "Tenés derecho a acceder a tus datos, a rectificarlos si están mal y a pedir que los suprimamos, conforme a la Ley 25.326 de Protección de Datos Personales.",
        "Para ejercerlos, escribinos a " + CONTACTO + ". Buena parte podés hacerla vos mismo desde tu perfil, editando o borrando lo que cargaste.",
        "La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, tiene la atribución de atender las denuncias y reclamos que se interpongan con relación al incumplimiento de las normas sobre protección de datos personales.",
      ],
    },
    {
      titulo: "Cookies y almacenamiento en tu navegador",
      parrafos: [
        "Este sitio no usa cookies de publicidad ni de terceros para seguirte.",
        "Usamos el almacenamiento local de tu navegador para cosas estrictamente funcionales: mantener tu sesión iniciada, recordar la última vez que entraste y guardar una copia de las ofertas para que carguen más rápido. Si lo borrás, simplemente vas a tener que iniciar sesión de nuevo.",
        "Medimos las visitas al sitio con Vercel Analytics, que no usa cookies ni te identifica de forma individual.",
      ],
    },
    {
      titulo: "Cambios",
      parrafos: [
        "Si actualizamos esta política, cambiamos la fecha del encabezado. Los cambios importantes los avisamos por correo a las cuentas activas.",
      ],
    },
  ],
};

export const TERMINOS: LegalDoc = {
  titulo: "Términos y Condiciones",
  actualizado: "31 de julio de 2026",
  secciones: [
    {
      titulo: "Qué es este sitio",
      parrafos: [
        "Este portal pertenece a Human Power | RRHH, consultora de recursos humanos de Rosario, Argentina. Permite consultar búsquedas laborales, crear un perfil de candidato y postularse.",
        "Usar el portal implica aceptar estos términos y la Política de Privacidad.",
      ],
    },
    {
      titulo: "Tu cuenta",
      parrafos: [
        "Para postularte necesitás una cuenta. Sos responsable de mantener tu contraseña a resguardo y de la actividad que ocurra bajo tu cuenta.",
        "Los datos que cargues tienen que ser veraces y propios. Cargar información falsa o datos de otra persona es motivo suficiente para dar de baja la cuenta.",
      ],
    },
    {
      titulo: "Qué no garantizamos",
      parrafos: [
        "Postularte no garantiza una entrevista ni la obtención de un empleo. La decisión de contratar es siempre de la empresa que publica la búsqueda.",
        "Las búsquedas publicadas pueden cerrarse o modificarse en cualquier momento.",
        "Postularte no genera relación laboral alguna con Human Power | RRHH.",
      ],
    },
    {
      titulo: "Contenido que subís",
      parrafos: [
        "El currículum, la foto y el video que subas siguen siendo tuyos. Al cargarlos nos autorizás a usarlos con un único fin: presentarte a búsquedas laborales.",
        "No subas contenido de terceros sin permiso, ni material ofensivo o ilegal.",
      ],
    },
    {
      titulo: "Baja",
      parrafos: [
        `Podés pedir la eliminación de tu cuenta y de todos tus datos escribiendo a ${CONTACTO}.`,
        "También podemos dar de baja cuentas que incumplan estos términos.",
      ],
    },
    {
      titulo: "Contacto",
      parrafos: [
        `Cualquier duda sobre estos términos: ${CONTACTO}.`,
      ],
    },
  ],
};
