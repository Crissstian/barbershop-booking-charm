# NDP — Deploy indipendente: Vercel + Supabase

## Stato e limiti
Questa è una PREPARAZIONE su copia del codice. Non è una migrazione eseguita.
**Non disconnettere Lovable Cloud, non eliminare dati e non acquistare ancora il dominio.**
La repository include frontend, Server Functions e SQL, ma non esporta automaticamente i clienti, gli account auth o i file Storage del backend Lovable.

## 1. Applica il pacchetto su un branch (non su main)
Scarica e clona `Crissstian/barbershop-booking-charm` e crea un branch:

```powershell
git clone https://github.com/Crissstian/barbershop-booking-charm.git
cd barbershop-booking-charm
git switch -c chore/vercel-supabase-external-prep
```

Applica il pacchetto estratto con Node.js:

```powershell
node "C:\PERCORSO\NDP_External_Prep_v1\apply_to_repo.mjs" .
```

Il programma modifica il sorgente solo dopo aver trovato i riferimenti originali attesi.
Controlla `git status` e `git diff`. **Non incollare o pubblicare mai una chiave segreta.**
Il vecchio file `.env` è già stato versionato: dopo averne salvata una copia LOCALE, interrompi il tracciamento:

```powershell
git rm --cached .env
```

La vecchia chiave pubblicabile è pubblica per definizione, ma se altre credenziali private sono mai state versionate vanno ruotate; togliere il file non cancella la cronologia.

## 2. Verifica codice senza toccare il backend
Servono Node.js 22+ e Bun. Usa il lockfile attuale:

```powershell
bun install --frozen-lockfile
bunx vitest run
bun run build
```

La GitHub Action `NDP - verifica codice` fa le stesse verifiche su pull request.
Non è un test delle prenotazioni sul database reale.

## 3. Supabase di proprietà del salone — dopo demo
Crea un nuovo progetto Supabase nel tuo account, separato da Lovable Cloud.
Non riutilizzare UUID/progetto URL Lovable. Non importare tabelle di test nell'ambiente di produzione.

Per un progetto **vuoto di prova**, esegui dal SQL Editor, uno per uno e in ordine:
- `drizzle/migrations/0000_ndp_booking.sql`
- `0001_add_customer_booking_approvals.sql`
- `0002_add_whatsapp_and_staff_notes.sql`
- `0003_salon_operations_foundation.sql`
- `0004_official_services_and_staff_bootstrap.sql`
- `0005_recurring_products_membership.sql`
- `0006_restrict_media_read.sql`
- `scripts/external/setup-media-and-assets.sql`
- `scripts/external/seed-fresh-supabase.sql` **solo se non stai importando i dati reali**

**Attenzione:** `drizzle/schema.ts` non rappresenta le tabelle complete. Non usare `drizzle-kit push` o `drizzle-kit generate` finché non è stato ricostruito correttamente. Questi script sono per creare un database nuovo, non per aggiornare il database Lovable attivo.

Per trasferire dati REALI: ricava prima un export/backup dal backend Lovable, con tabelle, righe, dati auth, RLS, funzioni, bucket e file; confronta gli ID e i conteggi prima di importare. Non eseguire lo seed fresco quando importi lo storico. Gli account Supabase Auth e le password richiedono una procedura dedicata: potrebbero servire account nuovi o password reset. Non improvvisare SQL che scriva direttamente nelle tabelle `auth`.

## 4. Variabili d'ambiente
Copia `.env.example` in `.env.local` e riempi i valori del NUOVO Supabase nel tuo PC.
Imposta i medesimi valori in Vercel **Project > Settings > Environment Variables**:

| Variabile | Dove | Segreta |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser / build | No |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser / build | No |
| `SUPABASE_URL` | Solo server | No |
| `SUPABASE_PUBLISHABLE_KEY` | Solo server | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo server | **SÌ** |

Mai usare prefisso `VITE_` con service role o secret key. Per l'ambiente locale il server deve ricevere questi valori, incluso `SUPABASE_SERVICE_ROLE_KEY`. 

## 5. Admin e sicurezza
Il primo utente Supabase Auth che si registra nel nuovo progetto riceve il ruolo admin (trigger). **Non aprire la registrazione pubblicamente prima di aver creato/verificato l'account previsto.**
Configura `Authentication > URL Configuration` con il sito Vercel e gli URL di redirect `/admin` (incluse le preview autorizzate). Abilita le conferme email; verifica la consegna dal nuovo Supabase.

Il codice invito legacy `NDPVIP` è ancora nel progetto e va disabilitato PRIMA di dare l'accesso ai clienti. Inoltre la semplice email dichiarata non dimostra l'identità del prenotante: è necessaria una misura aggiuntiva prima della produzione.

## 6. Media
`public/media/` contiene i JPG dello staff, sei prodotti Davines e il logo, indipendenti da `/__l5e/assets-v1/...`.
La nuova build legge le foto in locale; `setup-media-and-assets.sql` aggiorna i prodotti nel database esterno. Non si eliminano o riscrivono i file del Lovable Cloud.
Foto caricate dall'admin, invece, vengono conservate nel bucket `media` Supabase: ripristina lì gli oggetti esistenti, se necessari, e aggiorna gli URL di provenienza Lovable quando trasferisci i dati.

## 7. Vercel, dopo la verifica
Importa questo repository dal tuo account Vercel. Seleziona il branch di test e framework **TanStack Start**. Il file `vercel.json` e Nitro consentono il riconoscimento automatico; non usare static-only hosting, perché il booking usa Server Functions.
Configura le variabili, effettua un deploy di prova e verifica homepage, route `/prenota`, `/prenotazione/:token`, `/admin`, SSR, pagine e asset. Non associare il dominio definitivo finché test e migrazione non sono conclusi.
Per il sito commerciale usa il piano Vercel adeguato alle condizioni di utilizzo.

## 8. Non ancora implementato
WhatsApp Cloud API: l'attuale implementazione invia testo libero. Per conferme e reminder fuori dalla finestra di assistenza servono template approvati da Meta, opt-in, gestione consegna e scheduler. Non configurare token WhatsApp fino a quella correzione.
Membership pubblica `/esclusiva`: ancora in parte dimostrativa, va sincronizzata o nascosta prima del lancio.
Clienti fissi: la race condition tra ricorrenze virtuali e prenotazioni simultanee non è completamente protetta a livello database.

## 9. Ultimi controlli prima del cambio dominio
- Primo admin, signup chiuso e sicurezza del booking verificati.
- Backup testato e dati confrontati tra origine e destinazione.
- Foto/hero/logo visibili su Vercel; bucket immagini e RLS verificati.
- Prenotazione, modifica, annullamento, clienti fissi, Membership e incassi testati.
- Recapiti veri in `src/lib/salon.ts`; rimuovere tutti i segnaposto.
- Policy privacy/cookie, accessi di gestione e consenso messaggi verificati.
- WhatsApp e reminder testati se previsti nel giorno del lancio.
- Solo alla fine DNS dominio e rilascio.
