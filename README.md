# 🏸 Badminton Turnierplaner

Eine Desktop-App zur Planung und Durchfuehrung vereinsinterner Badminton-Turniere. Gebaut mit [Tauri](https://tauri.app/), React und SQLite.

## Features

### Turnierverwaltung
- **3 Modi**: Einzel, Doppel, Mixed
- **3 Formate**: Jeder gegen Jeden (Round Robin), KO-System (Elimination), Wechselnde Partner (Random Doubles)
- **Konfigurierbar**: Anzahl Saetze (Best of 1/3/5), Punkte pro Satz, Anzahl Spielfelder
- **Setzliste/Seeding**: Optionales Seeding fuer KO-Turniere, damit die besten Spieler erst in spaeteren Runden aufeinandertreffen
- **Archivierung**: Beendete Turniere koennen archiviert und wiederhergestellt werden

### Spielerverwaltung
- Spieler anlegen, bearbeiten, loeschen
- **Excel-Import** mit Spaltenmapping (Name, Geschlecht)
- **Excel-Export** mit nativem Speichern-Dialog
- Duplikaterkennung beim Import
- Geschlechter-Filter und Suchfunktion bei der Spielerauswahl

### Spielbetrieb
- **Feldzuweisung**: Spiele per Drag & Drop oder Dropdown auf Felder verteilen
- **Timer**: Startet automatisch bei Feldzuweisung, zeigt Spieldauer pro Feld
- **Ergebniserfassung**: Satz-Ergebnisse eintragen mit Auto-Vervollstaendigung
- **Badminton-Regelkonform**: Rallypoint-System bis 21, Verlaengerung bei 20:20, Deckelung bei 30
- **Score-Validierung**: Ungueltige Ergebnisse werden erkannt und markiert
- **Spieler waehrend des Turniers hinzufuegen/entfernen**: Nachzuegler oder fruehe Abgaenger handeln

### Rangliste & Auswertung
- **Live-Rangliste**: Sortiert nach Siegen, Satzverhaeltnis, Punkteverhaeltnis
- **Medaillen**: Gold, Silber, Bronze fuer die Top 3
- **Turnierbericht**: Druckbarer Bericht mit Highlights (knappstes Spiel, hoechster Sieg, meiste Punkte etc.)
- **Druckansicht**: Spielplan, aktuelle Runde, Rangliste oder kompletter Bericht

### Technisch
- **Offline-faehig**: Laeuft komplett lokal, kein Internet noetig
- **SQLite-Datenbank**: Robuste, persistente Datenspeicherung
- **Backup & Restore**: Datenbank sichern und wiederherstellen mit nativem Dialog
- **Konfigurierbarer Speicherort**: Datenbank kann an beliebigen Ort verschoben werden (z.B. USB-Stick)

## Tech Stack

| Komponente | Technologie |
|---|---|
| Desktop-Framework | [Tauri 2](https://tauri.app/) (Rust) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS 4 |
| Datenbank | SQLite (via tauri-plugin-sql) |
| Build-Tool | Vite |
| Excel | SheetJS (xlsx) |

## Voraussetzungen

Fuer die Entwicklung:

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (stable)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/) mit C++ Workload (Windows)

Fuer die Nutzung der fertigen App:

- Windows 10/11 (x64)
- WebView2 Runtime (auf Windows 10/11 vorinstalliert)

## Entwicklung

```bash
# Abhaengigkeiten installieren
npm install

# Entwicklungsserver starten (oeffnet Desktop-Fenster)
npx tauri dev

# Release-Build erstellen
npx tauri build
```

Der erste Build dauert einige Minuten, da Rust alle Dependencies kompilieren muss. Nachfolgende Builds sind deutlich schneller.

## Build-Ausgabe

Nach `npx tauri build` befinden sich die Installer unter:

```
src-tauri/target/release/bundle/
├── nsis/  → Turnierplaner_0.1.0_x64-setup.exe
└── msi/   → Turnierplaner_0.1.0_x64_en-US.msi
```

## Projektstruktur

```
src/
├── components/
│   ├── layout/        # Sidebar, Layout
│   ├── courts/        # Felduebersicht, Timer
│   ├── players/       # Excel-Import
│   └── print/         # Druckansicht, Turnierbericht
├── lib/
│   ├── db.ts          # SQLite-Wrapper
│   ├── draw.ts        # Auslosungsalgorithmen
│   ├── scoring.ts     # Punkteberechnung & Validierung
│   ├── highlights.ts  # Turnier-Highlights
│   └── types.ts       # TypeScript-Interfaces
├── pages/
│   ├── Home.tsx
│   ├── Players.tsx
│   ├── Tournaments.tsx
│   ├── TournamentCreate.tsx
│   ├── TournamentView.tsx
│   └── Settings.tsx
└── App.tsx

src-tauri/
├── src/lib.rs         # Rust-Backend (DB-Migrations, Befehle)
├── Cargo.toml
└── tauri.conf.json
```

## Lizenz

MIT
