// Fuente única de verdad de los rubros/áreas. La consumen el hero, la sección
// "Áreas que manejamos", el filtro de /ofertas y el formulario del admin.
import {
  Laptop, FlaskConical, Cog, Wrench, UtensilsCrossed, ShieldCheck, HardHat,
  Headset, Palette, Scale, Ship, Settings, Calculator, TrendingUp, Users,
  LayoutGrid, type LucideIcon,
} from "lucide-react";

export type Category = {
  value: string;   // canónico: lo que se guarda en DB y viaja en la URL (?categoria=)
  label: string;   // lo que se muestra
  Icon: LucideIcon;
  hot?: boolean;    // destacado en el hero / con llama en la grilla
};

export const CATEGORIES: Category[] = [
  { value: "it",             label: "IT / Tecnología",                  Icon: Laptop,          hot: true },
  { value: "calidad",        label: "Investigación y calidad",          Icon: FlaskConical,    hot: true },
  { value: "ingenieria",     label: "Ingeniería",                       Icon: Cog,             hot: true },
  { value: "mantenimiento",  label: "Mantenimiento",                    Icon: Wrench },
  { value: "hoteleria",      label: "Hotelería / Turismo / Gastronomía", Icon: UtensilsCrossed },
  { value: "aseo-seguridad", label: "Servicios de aseo y seguridad",    Icon: ShieldCheck },
  { value: "construccion",   label: "Construcción / Obra",              Icon: HardHat },
  { value: "call-center",    label: "Call center / Telemarketing",      Icon: Headset },
  { value: "diseno",         label: "Diseño / Artes gráficas",          Icon: Palette },
  { value: "legales",        label: "Legales / Asesoría",               Icon: Scale },
  { value: "aduana",         label: "Aduana / Comercio exterior",       Icon: Ship },
  { value: "depto-tecnico",  label: "Departamento técnico",             Icon: Settings },
  { value: "administracion", label: "Administración / Finanzas",         Icon: Calculator },
  { value: "comercial",      label: "Comercial / Ventas",               Icon: TrendingUp },
  { value: "rrhh",           label: "RRHH",                             Icon: Users },
  { value: "otros",          label: "Otros",                            Icon: LayoutGrid },
];

export const HOT_CATEGORIES = CATEGORIES.filter((c) => c.hot);

const BY_VALUE = new Map(CATEGORIES.map((c) => [c.value, c]));

export function isValidCategory(value: string): boolean {
  return BY_VALUE.has(value);
}

export function categoryLabel(value: string): string {
  return BY_VALUE.get(value)?.label ?? "Otros";
}
