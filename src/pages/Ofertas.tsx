// src/pages/Ofertas.tsx
import React, { useState, useMemo } from "react";
import { MapPin, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Header } from "@/components/Header";

// ─────────────────────────────────────────────────────────────────────────────
// Datos estáticos (podés reemplazarlos luego por una API real)
// ─────────────────────────────────────────────────────────────────────────────
const JOBS = [
  {
    id: 1,
    title: "Analista Contable Jr.",
    location: "Rosario, Santa Fe",
    type: "Presencial",
    description:
      "Buscamos un analista contable junior para unirse a nuestro equipo financiero. Responsable de tareas de contabilidad general, conciliaciones bancarias y armado de reportes.",
  },
  {
    id: 2,
    title: "Desarrollador/a Frontend React",
    location: "Remoto (ARG)",
    type: "Remoto",
    description:
      "Buscamos un desarrollador Frontend con experiencia en React para construir interfaces modernas y performantes para nuestros clientes.",
  },
  {
    id: 3,
    title: "Vendedor/a Comercial",
    location: "Zona Norte, Rosario",
    type: "Híbrido",
    description:
      "Oportunidad para vendedor/a comercial con perfil proactivo y excelentes habilidades de comunicación para ampliar cartera de clientes en la zona norte.",
  },
  {
    id: 4,
    title: "Especialista en Marketing Digital",
    location: "Remoto (ARG)",
    type: "Remoto",
    description:
      "Buscamos un especialista en marketing digital para planificar y ejecutar campañas online, incluyendo SEO, SEM y redes sociales.",
  },
  {
    id: 5,
    title: "Analista de Datos",
    location: "Rosario, Santa Fe",
    type: "Híbrido",
    description:
      "Necesitamos un analista de datos para interpretar información y generar reportes estadísticos que orienten la toma de decisiones del negocio.",
  },
  {
    id: 6,
    title: "Soporte Técnico Nivel 2",
    location: "Rosario, Santa Fe",
    type: "Presencial",
    description:
      "Responsable de brindar soporte técnico avanzado, resolviendo incidencias complejas de hardware y software para nuestros clientes.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponente: Tarjeta de empleo
// ─────────────────────────────────────────────────────────────────────────────
const JobCard: React.FC<{ job: (typeof JOBS)[number] }> = ({ job }) => (
  <Card className="rounded-3xl hover:shadow-lg transition-shadow flex flex-col h-full">
    <CardHeader>
      <CardTitle className="text-lg">{job.title}</CardTitle>
    </CardHeader>
    <CardContent className="text-sm text-slate-600 grid gap-2 flex-grow">
      <div className="inline-flex items-center gap-2 text-slate-700">
        <MapPin size={16} />
        {job.location}
      </div>
      <Badge className="w-fit rounded-xl" variant="secondary">
        {job.type}
      </Badge>
      <p className="text-slate-500 mt-2 line-clamp-3">{job.description}</p>
    </CardContent>
    <div className="p-6 pt-0">
      <Button className="rounded-2xl mt-2 w-full bg-amber-500 hover:bg-amber-500/90 text-black">
        Ver más y postularme
      </Button>
    </div>
  </Card>
);

// ─────────────────────────────────────────────────────────────────────────────
// Página principal: Ofertas
// ─────────────────────────────────────────────────────────────────────────────
const Ofertas: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const locations = useMemo(
    () => [...new Set(JOBS.map((job) => job.location))],
    []
  );
  const types = useMemo(() => [...new Set(JOBS.map((job) => job.type))], []);

  const filteredJobs = useMemo(() => {
    return JOBS.filter((job) => {
      return (
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        (locationFilter === "" || job.location === locationFilter) &&
        (typeFilter === "" || job.type === typeFilter)
      );
    });
  }, [searchTerm, locationFilter, typeFilter]);

  return (
    <>
      {/* Header compartido con el landing */}
      <Header />

      {/* Contenido principal */}
      <main className="min-h-screen bg-white text-slate-900">
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center">
            <p className="uppercase tracking-widest text-amber-500 text-[11px] sm:text-xs font-semibold">
              Nuestras Vacantes
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold">
              Encontrá tu próximo desafío
            </h1>
            <p className="mt-4 text-slate-600 max-w-2xl mx-auto">
              Explorá las oportunidades que tenemos disponibles. Filtrá por
              puesto, ubicación o modalidad para encontrar el trabajo ideal para
              vos.
            </p>
          </div>

          {/* Filtros */}
          <Card className="mt-8 sm:mt-12 p-4 sm:p-6 rounded-3xl shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar por título del puesto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>

              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
              >
                <option value="">Todas las ubicaciones</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-12 w-full rounded-md border border-slate-300 bg-transparent px-3 py-2 text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
              >
                <option value="">Todas las modalidades</option>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {/* Resultados */}
          {filteredJobs.length > 0 ? (
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="text-center mt-12 py-12 border-2 border-dashed rounded-3xl">
              <h3 className="text-xl font-semibold text-slate-800">
                No se encontraron ofertas
              </h3>
              <p className="text-slate-500 mt-2">
                Intentá ajustar los filtros o volvé más tarde.
              </p>
            </div>
          )}
        </section>
      </main>
    </>
  );
};

export default Ofertas;
