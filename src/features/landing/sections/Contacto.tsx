import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Mail, Instagram } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fadeUp } from "@/lib/motion";
import { apiFetch, parseApiError } from "@/lib/api";

const contactLink =
  "inline-flex items-center gap-2 text-muted-foreground hover:text-amber-600 transition-colors";

export default function Contacto() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Completá nombre, email y mensaje.");
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch(`/contacto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      toast.success("¡Consulta enviada!", {
        description: "Te vamos a contactar a la brevedad.",
      });
      setName("");
      setEmail("");
      setMessage("");
    } catch (err) {
      toast.error("No se pudo enviar la consulta", {
        description: err instanceof Error ? err.message : "Probá de nuevo en un momento.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      id="contacto"
      className="scroll-mt-16 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24"
    >
      <motion.div
        className="grid md:grid-cols-2 gap-8 sm:gap-12 items-center"
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">
            Contacto
          </p>
          <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            ¿Sos empresa? <span className="text-gradient-brand">Hablemos.</span>
          </h2>
          <p className="mt-3 text-muted-foreground text-sm sm:text-base">
            Contanos tu búsqueda y te armamos una terna en tiempo récord.
          </p>
          <div className="mt-8 space-y-4 text-sm sm:text-base">
            <div className="grid gap-3">
              <a className={contactLink} href="mailto:humanpower.rrhh@gmail.com">
                <Mail size={18} className="text-slate-500" />{" "}
                humanpower.rrhh@gmail.com
              </a>
              <a
                className={contactLink}
                href="https://www.instagram.com/human.power.rrhh/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram size={18} className="text-slate-500" />{" "}
                @human.power.rrhh
              </a>
            </div>
          </div>
        </div>

        <Card className="rounded-3xl border-slate-200/70 shadow-lg shadow-amber-500/5">
          <CardHeader>
            <CardTitle>Dejanos tu consulta</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Nombre"
                  aria-label="Nombre"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={120}
                />
                <Input
                  type="email"
                  placeholder="Email"
                  aria-label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Textarea
                placeholder="Mensaje"
                rows={5}
                aria-label="Mensaje"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={5000}
              />
              <Button
                type="submit"
                variant="brand"
                className="rounded-2xl w-full"
                disabled={sending}
              >
                {sending ? "Enviando…" : "Enviar consulta"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </section>
  );
}
