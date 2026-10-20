import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { checkCustomerApproval, createBooking, getSlots, joinWaitlist, requestCustomerApproval } from "@/lib/booking.functions";
import { catalogQuery } from "./index";
import { addDays, servicePrice, fmtDay, fmtTime, romeDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { barbersForService } from "@/lib/report";
import { waLink } from "@/lib/salon";

const FULL_MESSAGE = "Ciao, non trovo disponibilità online e vorrei verificare se è possibile trovare un posto.";

export const Route = createFileRoute("/prenota")({
  validateSearch: z.object({ barber: z.string().optional(), service: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Prenota — NDP Esclusive Hair Saloon" },
      { name: "description", content: "Accesso riservato ai clienti autorizzati. Scegli servizio, professionista e orario." },
      { property: "og:title", content: "Prenota il tuo appuntamento da NDP" },
      { property: "og:description", content: "Prenotazione online riservata ai clienti autorizzati." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQuery),
  component: Booking,
});

const STEPS = ["Servizio", "Professionista", "Orario", "I tuoi dati"];

function Booking() {
  const { data } = useSuspenseQuery(catalogQuery);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [serviceId, setService] = useState(search.service ?? "");
  const [barberId, setBarber] = useState(search.barber ?? "");
  const [step, setStep] = useState(search.service ? (search.barber ? 2 : 1) : 0);
  const [date, setDate] = useState(romeDate());
  const [slot, setSlot] = useState<{ start: string; barberId: string } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [sending, setSending] = useState(false);
  const [identity, setIdentity] = useState({ firstName: "", lastName: "", email: "", phone: "", inviteCode: "" });
  const [access, setAccess] = useState<"checking" | "approved" | "pending" | "request">("checking");
  const [waiting, setWaiting] = useState(false);


  const service = data.services.find((s) => s.id === serviceId);
  const slots = useQuery({
    queryKey: ["slots", barberId, serviceId, date],
    queryFn: () => getSlots({ data: { barberId, serviceId, date } }),
    enabled: step === 2 && !!serviceId && !!barberId,
  });
  const days = Array.from({ length: 14 }, (_, i) => addDays(romeDate(), i));
  const eligible = serviceId ? barbersForService(data.barbers, data.links, serviceId) : data.barbers;
  const dayEmpty = slots.data?.length === 0;
  const allDays = useQuery({
    queryKey: ["slots-14", barberId, serviceId],
    queryFn: async () => (await Promise.all(days.map((d) => getSlots({ data: { barberId, serviceId, date: d } })))).some((l) => l.length > 0),
    enabled: step === 2 && dayEmpty && !!serviceId && !!barberId,
    staleTime: 60_000,
  });
  const fullyBooked = allDays.data === false;
  const barberName = (id: string) => data.barbers.find((b) => b.id === id)?.name;

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const result = await checkCustomerApproval({ data: { email: identity.email } });
      if (result.status === "approved") {
        setIdentity((current) => ({ ...current, email: current.email.trim().toLowerCase() }));
        setForm((current) => ({ ...current, email: identity.email.trim().toLowerCase(), phone: current.phone || result.phone }));
        setAccess("approved");
      } else if (result.status === "pending") setAccess("pending");
      else setAccess("request");

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossibile verificare l’accesso");
    } finally { setSending(false); }
  }

  async function requestAccess(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const result = await requestCustomerApproval({ data: { ...identity, phone: identity.phone || undefined, inviteCode: identity.inviteCode || undefined } });
      if (result.status === "approved") {
        setForm((current) => ({ ...current, name: `${identity.firstName} ${identity.lastName}`.trim(), email: identity.email.trim().toLowerCase(), phone: identity.phone }));
        setAccess("approved");
      } else setAccess("pending");

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossibile inviare la richiesta");
    } finally { setSending(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot || !service) return;
    setSending(true);
    try {
      const r = await createBooking({ data: { barberId: slot.barberId, serviceId: service.id, start: slot.start, ...form } });
      navigate({ to: "/prenotazione/$token", params: { token: r.token } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
      setSending(false);
    }
  }

  const choice = "w-full border p-4 text-left transition-colors hover:border-foreground";
  const active = "border-foreground bg-secondary";

  if (access !== "approved") return (
    <main className="access-scene flex min-h-screen items-center justify-center px-6 py-16">
      <section className="booking-panel w-full max-w-md border border-border bg-card/80 p-6 backdrop-blur-xl sm:p-9">
        <Link to="/" className="font-serif text-xl tracking-[0.3em]">NDP</Link>
        <p className="mt-12 text-[10px] uppercase tracking-[0.3em] text-accent">Accesso riservato</p>
        <h1 className="mt-3 font-serif text-5xl leading-none">Prima di sederti.</h1>
        {access === "pending" ? (
          <div className="mt-8 border-l-2 border-accent bg-secondary p-5">
            <p className="font-serif text-2xl">Richiesta ricevuta.</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Lo staff verificherà i tuoi dati. Torna qui con la stessa email dopo l’approvazione.</p>
            <Button variant="outline" className="mt-6 w-full" onClick={() => setAccess("checking")}>Verifica di nuovo</Button>
          </div>
        ) : (
          <form onSubmit={access === "request" ? requestAccess : verify} className="mt-8 space-y-4">
            {access === "request" && <>
              <label className="block text-sm">Nome<input required minLength={2} maxLength={50} value={identity.firstName} onChange={(e) => setIdentity({ ...identity, firstName: e.target.value })} className="mt-1 w-full border bg-background px-3 py-3 outline-none focus:border-accent" /></label>
              <label className="block text-sm">Cognome<input required minLength={2} maxLength={50} value={identity.lastName} onChange={(e) => setIdentity({ ...identity, lastName: e.target.value })} className="mt-1 w-full border bg-background px-3 py-3 outline-none focus:border-accent" /></label>
              <label className="block text-sm">WhatsApp<input required type="tel" minLength={6} maxLength={25} value={identity.phone} onChange={(e) => setIdentity({ ...identity, phone: e.target.value })} placeholder="+39 333 1234567" className="mt-1 w-full border bg-background px-3 py-3 outline-none focus:border-accent" /></label>
            </>}
            <label className="block text-sm">Email<input required type="email" maxLength={120} value={identity.email} onChange={(e) => setIdentity({ ...identity, email: e.target.value })} className="mt-1 w-full border bg-background px-3 py-3 outline-none focus:border-accent" /></label>
            {access === "request" && (
              <label className="block text-sm">Codice invito (se lo hai)<input maxLength={40} value={identity.inviteCode} onChange={(e) => setIdentity({ ...identity, inviteCode: e.target.value })} placeholder="Accesso immediato" className="mt-1 w-full border bg-background px-3 py-3 uppercase tracking-[0.2em] outline-none focus:border-accent" /></label>
            )}

            <Button disabled={sending} className="h-auto w-full rounded-none py-4 uppercase tracking-[0.22em]">
              {sending ? "Attendi…" : access === "request" ? "Invia richiesta" : "Continua"}
            </Button>
            {access === "request" && <button type="button" onClick={() => setAccess("checking")} className="w-full text-sm text-muted-foreground underline">Sono già autorizzato</button>}
          </form>
        )}
      </section>
    </main>
  );

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-6">
      <div className="page-curtain" aria-hidden="true" />
      <header className="flex items-center justify-between">

        <Link to="/" className="font-serif text-xl tracking-[0.3em]">NDP</Link>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{step + 1} / 4 · {STEPS[step]}</span>
      </header>
      <div className="mt-4 flex gap-1">
        {STEPS.map((_, i) => <div key={i} className={`h-0.5 flex-1 origin-left transition-all duration-700 ${i <= step ? "scale-x-100 bg-accent" : "scale-x-75 bg-border"}`} />)}
      </div>
      {step > 0 && (
        <button onClick={() => setStep(step - 1)} className="mt-6 text-sm text-muted-foreground">← Indietro</button>
      )}

      {step === 0 && (
        <section className="booking-panel mt-8 space-y-3">
          <h1 className="font-serif text-4xl">Cosa facciamo oggi?</h1>
          {data.services.map((s) => (
            <button key={s.id} className={`${choice} ${serviceId === s.id ? active : ""}`} onClick={() => {
              const ok = barberId === "any" || barbersForService(data.barbers, data.links, s.id).some((b) => b.id === barberId);
              if (!ok) setBarber("");
              setService(s.id); setSlot(null); setStep(barberId && ok ? 2 : 1);
            }}>
              <span className="flex justify-between gap-3 font-serif text-2xl"><span>{s.name}</span><span className="shrink-0 whitespace-nowrap">{servicePrice(s)}</span></span>
              <span className="text-sm capitalize text-muted-foreground">{s.category} · {s.description ? `${s.description} · ` : ""}{s.duration_min} min</span>
            </button>
          ))}
        </section>
      )}

      {step === 1 && (
        <section className="booking-panel mt-8 space-y-3">
          <h1 className="font-serif text-4xl">Con chi?</h1>
          <button className={`${choice} ${barberId === "any" ? active : ""}`} onClick={() => { setBarber("any"); setSlot(null); setStep(2); }}>
            <span className="font-serif text-2xl">Primo disponibile</span>
            <span className="block text-sm text-muted-foreground">Ti mostriamo tutti gli orari liberi del salone</span>
          </button>
          {eligible.map((b) => (
            <button key={b.id} className={`${choice} ${barberId === b.id ? active : ""}`} onClick={() => { setBarber(b.id); setSlot(null); setStep(2); }}>
              <span className="font-serif text-2xl">{b.name}</span>
              <span className="block text-sm text-muted-foreground">{b.role_title}</span>
            </button>
          ))}
        </section>
      )}

      {step === 2 && (
        <section className="booking-panel mt-8">
          <h1 className="font-serif text-4xl">Quando?</h1>
          <p className="text-sm text-muted-foreground">{service?.name} · {barberId === "any" ? "Primo disponibile" : barberName(barberId)}</p>
          <div className="-mx-6 mt-6 flex gap-2 overflow-x-auto px-6 pb-2">
            {days.map((d) => {
              const dt = new Date(d + "T12:00:00Z");
              return (
                <button key={d} onClick={() => { setDate(d); setSlot(null); }} className={`min-w-16 border px-3 py-3 text-center ${date === d ? "border-foreground bg-foreground text-background" : ""}`}>
                  <span className="block text-[10px] uppercase tracking-widest">{dt.toLocaleDateString("it-IT", { weekday: "short", timeZone: "UTC" })}</span>
                  <span className="font-serif text-2xl">{dt.getUTCDate()}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-6 grid grid-cols-4 gap-2">
            {slots.isLoading && <p className="col-span-4 text-sm text-muted-foreground">Cerco gli orari…</p>}
            {slots.data?.length === 0 && (
              <div className="col-span-4 border-l-2 border-accent bg-secondary p-4 text-left">
                <p className="text-sm text-muted-foreground">Nessun orario libero in questo giorno.</p>
                <button
                  type="button"
                  disabled={waiting}
                  onClick={async () => {
                    setWaiting(true);
                    try {
                      await joinWaitlist({ data: { email: form.email, phone: form.phone || undefined, barberId, serviceId, day: date } });
                      toast.success("Sei in lista d’attesa: ti avvisiamo se si libera un posto.");
                    } catch (err) { toast.error(err instanceof Error ? err.message : "Errore"); }
                    finally { setWaiting(false); }
                  }}
                  className="mt-3 text-sm uppercase tracking-[0.2em] underline"
                >
                  {waiting ? "Attendi…" : "Avvisami se si libera"}
                </button>
                <div className={`mt-4 border-t border-border pt-4 ${fullyBooked ? "full-alert" : ""}`}>
                  <p className="font-serif text-2xl">{fullyBooked ? "Tutto pieno nei prossimi 14 giorni?" : "Tutto pieno?"}</p>
                  {fullyBooked && <p className="mt-1 text-sm text-muted-foreground">Scrivici: spesso troviamo un posto fuori dal calendario online.</p>}
                  <a href={waLink(FULL_MESSAGE)} target="_blank" rel="noreferrer" className="wa-cta mt-3 inline-block border border-accent bg-background px-6 py-3 text-[11px] uppercase tracking-[0.25em]">Contattaci</a>
                </div>
              </div>
            )}
            {slots.data?.map((s) => (
              <button key={s.start} data-selected={slot?.start === s.start} onClick={() => { setSlot(s); setStep(3); }} className={`slot-chip border py-3 text-sm ${slot?.start === s.start ? active : ""}`}>
                {fmtTime(s.start)}
              </button>
            ))}

          </div>
        </section>
      )}

      {step === 3 && slot && service && (
        <form onSubmit={submit} className="booking-panel mt-8 space-y-4">
          <h1 className="font-serif text-4xl">Quasi fatto</h1>
          <div className="border-l-2 border-accent bg-secondary p-4 text-sm">
            <p className="font-serif text-xl">{service.name} con {barberName(slot.barberId)}</p>
            <p className="capitalize">{fmtDay(slot.start)} · ore {fmtTime(slot.start)}</p>
            <p className="text-muted-foreground">{service.duration_min} min · {servicePrice(service)} (si paga in salone)</p>
          </div>
           {([["phone", "Telefono", "tel", true], ["email", "Email autorizzata", "email", true]] as const).map(([k, l, t, req]) => (
            <label key={k} className="block text-sm">
              {l}
               <input required={req} readOnly={k === "email"} maxLength={k === "phone" ? 25 : 120} type={t} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="mt-1 w-full border bg-card px-3 py-3 text-base outline-none focus:border-foreground read-only:opacity-70" />
            </label>
          ))}
          <label className="block text-sm">
            Note (facoltative)
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full border bg-card px-3 py-3 text-base outline-none focus:border-foreground" />
          </label>
          <button disabled={sending} className="w-full bg-primary py-4 text-sm uppercase tracking-[0.3em] text-primary-foreground disabled:opacity-50">
            {sending ? "Conferma in corso…" : "Conferma prenotazione"}
          </button>
        </form>
      )}
    </main>
  );
}
