# Family Tree – Alberi genealogici

Applicazione client-side per costruire, visualizzare e gestire alberi genealogici direttamente nel browser. Nessun server, nessun account: i dati restano sul tuo dispositivo (localStorage).

## Caratteristiche

- **Alberi multipli**: crea e gestisci più alberi genealogici indipendenti.
- **Visualizzazione interattiva**: albero SVG con pan, zoom e adattamento allo schermo.
- **Scheda persona**: nome, soprannome, sesso, date e luoghi di nascita/morte, professione, nazionalità, biografia, foto e note.
- **Relazioni**: genitore → figlio (biologica, adottiva o personalizzata) e unioni (coniuge/partner/ex).
- **Viste**: tutta la famiglia, solo discendenti o solo antenati di una persona di riferimento.
- **Ricerca**: cerca persone per nome.
- **Annulla / Ripristina**: cronologia delle modifiche (fino a 100 stati).
- **Tema chiaro / scuro**: switch immediato con persistenza.
- **Importa / Esporta JSON**: backup e ripristino dell'intero archivio.
- **Esporta PDF**: stampa/esporta l'albero corrente.
- **Privacy**: opzione per oscurare i dati delle persone viventi in export e PDF.
- **Esempio integrato**: famiglia "Rossi" inventata per provare tutte le funzioni (si elimina con un clic).

## Struttura del progetto

```
FamilyTree/
├── index.html      # Pagina principale (markup, icone SVG inline, dialog)
├── style.css       # Stili, variabili CSS per tema chiaro/scuro
├── script.js       # Logica applicativa (dati, rendering SVG, UI, localStorage)
├── esempio.js      # Copia incorporata dell'albero di esempio
├── esempio.json    # File di esempio esportabile (famiglia Rossi)
├── logo.svg        # Logo dell'applicazione
├── copertina.jpg   # Immagine di copertina
└── README.md       # Questo file
```

## Come usarlo

1. Apri `index.html` in un browser moderno (Chrome, Edge, Firefox, Safari).
2. Clicca **Crea il tuo albero** per partire da zero, oppure **Esplora l'esempio** per provare l'app con dati inventati.
3. Aggiungi persone con il pulsante **Persona** (+), poi collegale tramite la scheda dettagli.
4. Usa la barra laterale per passare tra **Alberi**, **Statistiche**, **Controllo relazioni**, **Impostazioni**, **Importa/Esporta**, **Esporta PDF** e **Privacy e dati**.
5. I cambiamenti si salvano automaticamente nel browser.

## Formato dati (esportazione JSON)

L'esportazione produce un file JSON con questa struttura:

```json
{
  "format": "albero-genealogico",
  "version": 1,
  "exported": "2026-11-05T09:18:53.694Z",
  "privacy": { "livingMasked": false },
  "settings": { ... },
  "tree": {
    "name": "Il mio albero",
    "ref": "id-persona-riferimento",
    "people": [
      {
        "id": "pabc123",
        "nome": "Mario",
        "secondo": "Giovanni",
        "cognome": "Rossi",
        "nick": "",
        "sesso": "M",
        "bd": "20", "bm": "12", "by": "1958",
        "luogoN": "Salerno",
        "dd": "", "dm": "", "dy": "",
        "luogoM": "",
        "foto": "",
        "bio": "...",
        "prof": "Insegnante",
        "naz": "Italiana",
        "altro": ""
      }
    ],
    "rels": [
      { "id": "...", "t": "pc", "p": "id-genitore", "c": "id-figlio", "k": "bio" },
      { "id": "...", "t": "un", "a": "id-persona1", "b": "id-persona2", "k": "coniuge" }
    ]
  }
}
```

Campi persone:
- `nome`, `secondo`, `cognome`, `nick` — anagrafica
- `sesso` — M/F/altro
- `bd`, `bm`, `by` — giorno, mese, anno di nascita
- `luogoN` — luogo di nascita
- `dd`, `dm`, `dy` — giorno, mese, anno di morte
- `luogoM` — luogo di morte
- `foto` — URL o data URI della foto
- `bio`, `prof`, `naz`, `altro` — biografia, professione, nazionalità, note

Tipi di relazione (`t`):
- `pc` — genitore → figlio (`p` = genitore, `c` = figlio, `k` = tipo: bio/adottiva/custom)
- `un` — unione tra due persone (`a`, `b` = partner, `k` = tipo: coniuge/partner/ex/custom)

## Privacy

I dati non lasciano mai il dispositivo: vengono memorizzati in `localStorage` del browser. Puoi esportare un backup JSON in qualsiasi momento e importarlo su un altro dispositivo o browser.

Le persone considerate "viventi" (nessuna data/luogo di morte e nate da meno di 110 anni) possono essere oscurate automaticamente negli export e nei PDF attivando l'opzione in **Privacy e dati**.

## Requisiti

- Browser moderno con supporto a ES6, SVG e localStorage.
- Nessuna installazione, nessuna dipendenza esterna.

## Licenza

Progetto personale. Libero da usare e modificare.
