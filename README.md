# 🏸 Badminton Turnierplaner

Eine Desktop-App zur Planung und Durchfuehrung vereinsinterner Badminton-Turniere. Gebaut mit [Tauri](https://tauri.app/), React und SQLite.

## Features

### Turnierverwaltung
- **3 Modi**: Einzel, Doppel, Mixed
- **5 Formate**: Jeder gegen Jeden, KO-System, Wechselnde Partner, Gruppenphase + KO, Feste Doppel
- **Gruppenphase + KO**: Konfigurierbare Gruppenanzahl (2-8), Qualifikanten pro Gruppe (Top 1-4), dann KO-Runde
  - Einzel: Individuelle Spieler qualifizieren sich
  - Doppel/Mixed: Feste Teams bleiben durch Gruppenphase und KO bestehen
- **KO-Bracket-Ansicht**: Visueller Turnierbaum mit Verbindungslinien, moegliche Teilnehmer in Grau, bestaetigte Gewinner sofort sichtbar
- **Konfigurierbar**: Saetze (Best of 1/3/5), Punkte pro Satz, Spielfelder (1-8)
- **Setzliste/Seeding**: Optionales Seeding fuer KO-Turniere per Drag & Drop oder Pfeiltasten
- **Archivierung**: Beendete Turniere archivieren und wiederherstellen
- **Turnier loeschen**: Mit Sicherheitsabfrage (Eingabe "LOESCHEN")
- **Auto-Benennung**: Turniername wird automatisch generiert (Datum - Modus - Format), editierbar

### Spielerverwaltung
- Spieler anlegen, bearbeiten, loeschen
- **Excel-Import** mit Spaltenmapping (Name, Geschlecht) und Duplikaterkennung
- **Excel-Export** mit nativem Speichern-Dialog
- Geschlechter-Filter und Suchfunktion bei der Spielerauswahl
- **Verletzung/Aufgabe**: Spieler als verletzt markieren - scheidet fuer restliches Turnier aus
  - Gestylter Modal-Dialog (kein Browser-Popup) mit Warnung bei Team-Auswirkungen
  - Bei festen Teams: Partner scheidet automatisch mit aus
  - Bei Wechselnden Partnern: Nur verletzter Spieler scheidet aus
  - Alle offenen Spiele werden als Freilos fuer den Gegner gewertet

### Spielbetrieb
- **Feldzuweisung**: Spiele per Drag & Drop auf Spielfelder ziehen
  - Belegte Felder werden erkannt und blockiert (runden-uebergreifend konsistent)
  - Timer startet automatisch bei Zuweisung, zeigt Spieldauer in Akzentfarbe
  - Ergebniseingabe erst nach Feldzuweisung moeglich
- **Ergebniserfassung**: Satz-Ergebnisse eintragen mit Auto-Vervollstaendigung
- **Badminton-Regelkonform**: Rallypoint-System bis 21, Verlaengerung bei 20:20, Deckelung bei 30
- **Score-Validierung**: Ungueltige Ergebnisse werden erkannt und markiert
- **Faire Auslosung**: Bei ungerader Spielerzahl setzt der Spieler mit den meisten Spielen aus; bei Wechselnden Partnern werden bisherige Partnerschaften gewichtet vermieden
- **Turnier kann nicht beendet werden** solange Spiele offen sind

### TV-/Beamer-Modus
- **Separates Fenster** optimiert fuer Querformat und Lesbarkeit aus der Ferne
- Aktuelle Felderbelegung mit Live-Timer
- Warteschlange: Naechste Spiele in der Reihenfolge
- Letzte Ergebnisse mit Gewinner-Hervorhebung
- Spieleraufruf-Banner mit Animation (📢 "Bitte zum Feld!")
- Passt sich an das gewaehlte Farbdesign an

### Rangliste & Auswertung
- **Live-Rangliste**: Sortiert nach Siegen, Satzverhaeltnis, Punkteverhaeltnis
- **Gruppen-Tabellen**: Bei Gruppenphase separate Tabelle pro Gruppe mit Qualifikanten-Markierung (Q)
- **Team-Standings**: Bei Doppel-Gruppenphase werden Teams (nicht Einzelspieler) gewertet
- **Medaillen**: 🥇🥈🥉 fuer die Top 3
- **Turnierbericht**: Druckbarer Bericht mit Highlights (knappstes Spiel, hoechster Sieg, meiste Punkte)
- **Druckansicht**: Spielplan, aktuelle Runde, Rangliste oder kompletter Bericht

### Design & Themes
- **4 Farbdesigns**: Smaragd (Gruen), Saphir (Blau), Bernstein (Orange), Dunkel (Dark Mode)
- Theme-Wechsel ueber Einstellungen → Design, wird sofort angewendet
- Vollstaendiger Dark Mode: Alle Seiten, Modals, Inputs, Tabellen, Bracket-Ansicht
- Theme wird persistent gespeichert

### Einstellungen
- **Design**: 4 Farbschemas (aufklappbar, Standard offen)
- **Voreinstellungen**: Standard-Spielfelder fuer neue Turniere
- **Datenbank**: Speicherort anzeigen/aendern, Backup & Wiederherstellung
- **Gefahrenzone**: Spieler oder Turniere komplett loeschen (mit Sicherheitsabfrage)

### Technisch
- **Offline-faehig**: Laeuft komplett lokal, kein Internet noetig
- **SQLite-Datenbank**: Robuste, persistente Datenspeicherung
- **Backup & Restore**: Datenbank sichern und wiederherstellen mit nativem Dialog
- **Konfigurierbarer Speicherort**: Datenbank an beliebigem Ort (z.B. USB-Stick)

## Tech Stack

| Komponente | Technologie |
|---|---|
| Desktop-Framework | [Tauri 2](https://tauri.app/) (Rust) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS 4 |
| Datenbank | SQLite (via tauri-plugin-sql) |
| Build-Tool | Vite |
| Excel | SheetJS (xlsx) |
| Font | Inter (Google Fonts) |

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
│   ├── bracket/       # KO-Bracket-Visualisierung
│   ├── courts/        # Felduebersicht, Timer
│   ├── players/       # Excel-Import
│   └── print/         # Druckansicht, Turnierbericht
├── hooks/
│   └── useTimer.ts    # Court-Timer Hook
├── lib/
│   ├── db.ts          # SQLite-Wrapper + LocalStorage-Fallback
│   ├── draw.ts        # Auslosungsalgorithmen (Round Robin, KO, Gruppen, Random Doubles, Mixed, Seeding)
│   ├── scoring.ts     # Punkteberechnung, Validierung, Auto-Fill, Team-Standings
│   ├── highlights.ts  # Turnier-Highlights (knappstes Spiel, etc.)
│   ├── theme.ts       # Theme-Definitionen (4 Farbschemas)
│   ├── ThemeContext.tsx # React Context fuer Theme-System
│   └── types.ts       # TypeScript-Interfaces
├── pages/
│   ├── Home.tsx        # Dashboard
│   ├── Players.tsx     # Spielerverwaltung
│   ├── Tournaments.tsx # Turnierliste + Archiv
│   ├── TournamentCreate.tsx # Turniererstellung
│   ├── TournamentView.tsx   # Turnieransicht (Matches, Courts, Rangliste)
│   ├── TvMode.tsx      # TV-/Beamer-Modus
│   └── Settings.tsx    # Einstellungen (Design, DB, Voreinstellungen)
└── App.tsx

src-tauri/
├── src/lib.rs         # Rust-Backend (DB-Migrations, Backup, Speicherort)
├── Cargo.toml
└── tauri.conf.json
```

## Lizenz

MIT
