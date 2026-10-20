# NDP — Esclusive Hair Saloon

## Rifinitura e configurazione ufficiale
- [ ] Sicurezza primo admin e chiusura signup pubblico
- [ ] Listino ufficiale, prezzi da e gestione servizi admin
- [ ] Slot 10 minuti, abilitazioni e conferma fuori orario
- [ ] Test A–N e istruzioni primo accesso

## Task list
- [x] Database + seed (Nicola, Daniele, Antonio, servizi, orari Mar–Sab)
- [x] Design system + logo + favicon
- [x] Intro, Hero, The Chair, prima disponibilità, servizi, barra prenota
- [x] Prenotazione 4 step senza login + conferma con codice e link gestione
- [x] Area staff: agenda giornaliera, stato appuntamenti, blocco orari, prezzi

## Aperti / bloccati
- Indirizzo, telefono, Instagram, orari reali: placeholder (serve info dal cliente)
- Primo account creato su /admin diventa admin
## Rifinitura estetica
- [x] Ingresso epico cinematografico
- [x] Homepage nero couture con schede interattive e passaggi animati
- [x] Transizioni animate nel percorso di prenotazione
- [x] Verifica mobile e desktop

## Warm luxury editorial
- [x] Nero come base con fasce grigio pietra e marrone noce
- [x] Rimuovere tutte le fotografie dei barbieri
- [x] Schede professionisti tipografiche animate
- [x] Sezione prodotti animata
- [x] Verifica mobile e desktop

## Nuova direzione — dark cinematic tortora
- [x] Ricostruire la home dark cinematic con il tortora satinato della divisa
- [x] Ripristinare le schede fotografiche dei tre barbieri
- [x] Sostituire la palette mista della sezione prodotti con un sistema monocromatico
- [x] Aggiungere richiesta di autorizzazione cliente con nome, cognome ed email
- [x] Aggiungere approvazione/rifiuto richieste nell’area staff
- [x] Consentire la prenotazione solo ai clienti verificati e approvati
- [ ] Verificare approvazione staff e prenotazione completa (bloccato: non esiste ancora un account staff)

## Direzione chiara — light cinematic epic

- [x] Eliminare completamente la base dark
- [x] Applicare una palette continua avorio e tortora
- [x] Conservare fotografia editoriale e ritmo cinematografico
- [x] Rendere l’ingresso più epico con veli, luce e apertura teatrale
- [x] Verificare resa mobile e desktop

## Checkpoint rimovibile — Tessera Membro & Gift Card
- [x] Pagina /esclusiva con tessera membro interattiva e configuratore gift card
- Per rimuovere tutto: elimina src/routes/esclusiva.tsx e src/components/exclusive/, e togli il link "Membership" nell'header di src/routes/index.tsx

## Fase — Fondazioni operative
- [x] Staff definitivo (4) + servizi abilitati per professionista
- [x] Booking filtrato per servizio (anche lato server)
- [x] Anagrafica clienti centralizzata
- [x] Admin: nuovo/modifica/annulla appuntamento, completato con importo/omaggio
- [x] Resoconto giornaliero e incasso per professionista
- [x] Vincolo anti doppia prenotazione nel database
- [x] "Tutto pieno? Contattaci"
- [ ] Verifica visiva area staff da loggati (bloccato: nessun account staff creato)
