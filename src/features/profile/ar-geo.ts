// Datos geográficos de Argentina para los selects/autocompletado del perfil.
// Listas curadas (no exhaustivas): Ciudad permite texto libre igual.

export const PROVINCES: string[] = [
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Ciudad Autónoma de Buenos Aires",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

export const CITIES_BY_PROVINCE: Record<string, string[]> = {
  "Buenos Aires": [
    "La Plata", "Mar del Plata", "Bahía Blanca", "Tandil", "Quilmes", "Lanús",
    "Lomas de Zamora", "San Isidro", "Tigre", "Pilar", "Morón", "Avellaneda",
  ],
  "Catamarca": [
    "San Fernando del Valle de Catamarca", "Andalgalá", "Belén", "Tinogasta",
    "Santa María", "Recreo",
  ],
  "Chaco": [
    "Resistencia", "Barranqueras", "Presidencia Roque Sáenz Peña", "Villa Ángela",
    "Charata", "General San Martín",
  ],
  "Chubut": [
    "Rawson", "Comodoro Rivadavia", "Trelew", "Puerto Madryn", "Esquel", "Sarmiento",
  ],
  "Ciudad Autónoma de Buenos Aires": [
    "Palermo", "Recoleta", "Belgrano", "Caballito", "Flores", "Almagro",
    "Villa Urquiza", "Núñez", "San Telmo", "Barracas",
  ],
  "Córdoba": [
    "Córdoba", "Villa María", "Río Cuarto", "San Francisco", "Villa Carlos Paz",
    "Alta Gracia", "Río Tercero", "Jesús María",
  ],
  "Corrientes": [
    "Corrientes", "Goya", "Mercedes", "Curuzú Cuatiá", "Paso de los Libres", "Santo Tomé",
  ],
  "Entre Ríos": [
    "Paraná", "Concordia", "Gualeguaychú", "Concepción del Uruguay", "Gualeguay", "Victoria",
  ],
  "Formosa": ["Formosa", "Clorinda", "Pirané", "El Colorado", "Las Lomitas"],
  "Jujuy": [
    "San Salvador de Jujuy", "Palpalá", "Libertador General San Martín", "Perico",
    "San Pedro de Jujuy",
  ],
  "La Pampa": ["Santa Rosa", "General Pico", "Toay", "General Acha", "Realicó"],
  "La Rioja": ["La Rioja", "Chilecito", "Aimogasta", "Chamical", "Chepes"],
  "Mendoza": [
    "Mendoza", "San Rafael", "Godoy Cruz", "Guaymallén", "Maipú", "Luján de Cuyo",
    "San Martín", "Tunuyán",
  ],
  "Misiones": [
    "Posadas", "Oberá", "Eldorado", "Puerto Iguazú", "Apóstoles", "Leandro N. Alem",
  ],
  "Neuquén": [
    "Neuquén", "Cutral Có", "Plottier", "Centenario", "Zapala", "San Martín de los Andes",
  ],
  "Río Negro": [
    "Viedma", "San Carlos de Bariloche", "General Roca", "Cipolletti", "Villa Regina",
    "Cinco Saltos",
  ],
  "Salta": [
    "Salta", "San Ramón de la Nueva Orán", "Tartagal", "General Güemes", "Metán", "Cafayate",
  ],
  "San Juan": ["San Juan", "Rawson", "Chimbas", "Rivadavia", "Pocito", "Caucete"],
  "San Luis": ["San Luis", "Villa Mercedes", "Merlo", "La Punta", "Justo Daract"],
  "Santa Cruz": [
    "Río Gallegos", "Caleta Olivia", "Pico Truncado", "Las Heras", "Puerto Deseado",
    "El Calafate",
  ],
  "Santa Fe": [
    "Rosario", "Santa Fe", "Rafaela", "Venado Tuerto", "Reconquista",
    "Villa Gobernador Gálvez", "Esperanza", "San Lorenzo",
  ],
  "Santiago del Estero": [
    "Santiago del Estero", "La Banda", "Termas de Río Hondo", "Añatuya", "Frías",
  ],
  "Tierra del Fuego": ["Ushuaia", "Río Grande", "Tolhuin"],
  "Tucumán": [
    "San Miguel de Tucumán", "Yerba Buena", "Tafí Viejo", "Banda del Río Salí",
    "Concepción", "Aguilares",
  ],
};

export const COUNTRIES: string[] = [
  "Argentina", "Uruguay", "Chile", "Paraguay", "Bolivia", "Brasil", "Perú",
  "Colombia", "Venezuela", "México", "España", "Estados Unidos", "Otro",
];
