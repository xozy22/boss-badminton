<p align="center">
  <img src="public/logo.png" alt="BOSS - Badminton Operating and Scheduling System" width="300" />
</p>

<h1 align="center">BOSS - Badminton Operating &amp; Scheduling System</h1>

<p align="center">
  A desktop app for planning and running badminton tournaments.<br/>
  Built with <a href="https://tauri.app/">Tauri</a>, React and SQLite. Available in English and German.
</p>

## Screenshots

| Turnierbetrieb (Spiele) | Rangliste |
|---|---|
| ![Spiele](screenshots/turnierbetrieb-spiele.png) | ![Rangliste](screenshots/turnierbetrieb-rangliste.png) |

| Verwaltung (Startgeld + Teilnehmer) | Spielerverwaltung |
|---|---|
| ![Verwaltung](screenshots/turnierbetrieb-verwaltung.png) | ![Spieler](screenshots/spielerverwaltung.png) |

| Turnier-Wizard |
|---|
| ![Wizard](screenshots/wizard-einstellungen.png) |

## Features

### Turnierverwaltung
- **3 Modi**: Einzel, Doppel, Mixed
- **5 Formate**: Jeder gegen Jeden, KO-System, Wechselnde Partner, Gruppenphase + KO, Feste Doppel
- **Gruppenphase + KO**: Konfigurierbare Gruppenanzahl (2-8), Qualifikanten pro Gruppe (Top 1-4), dann KO-Runde
  - Einzel: Individuelle Spieler qualifizieren sich
  - Doppel/Mixed: Feste Teams bleiben durch Gruppenphase und KO bestehen
  - **Dynamische Tabs**: Gruppentabellen, KO-Bracket, Rangliste als separate Tabs
  - **Intelligente Warteschlange**: "Alle Gruppen"-Modus zeigt Spiele aus allen Gruppen gleichzeitig - kein unnötiges Warten
  - **Gruppen-Buttons**: Pro Gruppe navigierbar, Zeilenumbruch zwischen Gruppen
  - **Druckansicht**: Gruppentabellen mit Q-Badge, separate Gruppen-/KO-Ueberschriften
- **KO-Bracket-Ansicht**: Visueller Turnierbaum als eigener Tab, moegliche Teilnehmer in Grau, bestaetigte Gewinner sofort sichtbar
- **Konfigurierbar**: Saetze (Best of 1/3/5), Punkte pro Satz, Spielfelder (1-8)
- **Setzliste/Seeding**: Optionales Seeding fuer KO-Turniere per Drag & Drop oder Pfeiltasten
- **Turnier-Wizard**: Schrittweise Erstellung mit Tab-Navigation (Einstellungen → Spieler → Teams → Setzliste → Erstellen)
- **Manuelle Team-Zuordnung**: Klick-Pairing fuer Doppel/Mixed - zwei Spieler nacheinander anklicken bildet ein Team
  - Im Mixed-Modus: Damen/Herren in getrennten Spalten, gleiches Geschlecht wird ausgegraut
  - "Restliche automatisch zuordnen" fuer schnelles Auffuellen
  - Teams werden persistiert und beim Bearbeiten wiederhergestellt
- **Startgeld-Verwaltung**: Pro Turnier konfigurierbar (Einzel-/Doppel-Betrag)
  - Zahlungsstatus pro Spieler (Bar, Ueberweisung, PayPal)
  - Datum der Zahlung (editierbar)
  - Uebersicht mit Gesamtsumme, nach Verein gruppiert
- **Turnier bearbeiten**: Draft-Turniere komplett bearbeitbar (alle Wizard-Tabs)
- **Turnier loeschen**: Draft-Turniere loeschbar mit Bestaetigungsdialog
- **Vorlagen-System**: Turniere als JSON-Datei exportieren/importieren
  - Waehlbar: Einstellungen, Spieler, Teams (einzeln oder kombiniert)
  - Spieler werden beim Import per Name gematcht (ID-unabhaengig)
  - Teams werden automatisch remapped
- **Tab-Navigation im Turnierbetrieb**: Spiele | Rangliste | Verwaltung
- **Archivierung**: Beendete Turniere archivieren und wiederherstellen
- **Auto-Benennung**: Turniername wird automatisch generiert (Datum - Modus - Format), editierbar

### Spielerverwaltung
- Spieler anlegen, bearbeiten, loeschen mit **Alter** und **Vereinszugehoerigkeit**
- **Excel-Import** mit Spaltenmapping (Name, Geschlecht, Alter, Verein) und Duplikaterkennung
- **Excel-Export** mit nativem Speichern-Dialog (inkl. Alter + Verein)
- Geschlechter-Filter und Suchfunktion bei der Spielerauswahl
- **Verletzung/Aufgabe**: Spieler als verletzt markieren - scheidet fuer restliches Turnier aus
  - Gestylter Modal-Dialog (kein Browser-Popup) mit Warnung bei Team-Auswirkungen
  - Bei festen Teams: Partner scheidet automatisch mit aus
  - Bei Wechselnden Partnern: Nur verletzter Spieler scheidet aus
  - Alle offenen Spiele werden als Freilos fuer den Gegner gewertet

### Sportstaetten-Verwaltung
- **Hallen mit individueller Feldanzahl**: Jede Sportstaette hat mehrere Hallen, jede Halle eigene Felder
- Inline Hallen-Editor: Name + Feldanzahl pro Halle, Hinzufuegen/Entfernen
- **JSON Export/Import**: Sportstaetten als Datei exportieren und importieren
- **Turnier-Integration**: Bei Turniererstellung Sportstaette waehlen → Hallen per Checkbox auswaehlen
- **Gruppierte Court-Anzeige**: Felder im Turnier nach Halle gruppiert mit Sektions-Headern
- **Standard-Hallen in Einstellungen**: Greifen wenn keine Sportstaette gewaehlt

### Spielbetrieb
- **Feldzuweisung**: Spiele per Drag & Drop oder Doppelklick auf Spielfelder ziehen
  - Belegte Felder werden erkannt und blockiert (runden-uebergreifend konsistent)
  - Doppelklick auf wartendes Spiel: Feld-Auswahl per Popup (bei 1 freien Feld: direkte Zuweisung)
  - Doppelklick auf belegtes Feld: Scrollt zum Spiel und fokussiert das erste Eingabefeld
  - Timer startet automatisch bei Zuweisung, zeigt Spieldauer in Akzentfarbe
  - Ergebniseingabe erst nach Feldzuweisung moeglich
- **Smarte Match-Ansicht**: Automatische Sortierung nach Status
  - "Auf dem Feld": Laufende Spiele mit voller Ergebniseingabe
  - "Beendet": Kompakte Einzeiler mit Satzstand + Einzelpunkten (z.B. 2:0 (21:15, 21:18)), aufklappbar
  - 3-Sekunden-Delay: Frisch beendete Spiele bleiben kurz sichtbar bevor sie nach unten rutschen
  - Bearbeitete Spiele bleiben in der Beendet-Sektion (kein Hochrutschen)
- **Ergebniserfassung**: Satz-Ergebnisse eintragen mit Auto-Vervollstaendigung
- **Badminton-Regelkonform**: Rallypoint-System bis 21, Verlaengerung bei 20:20, Deckelung bei 30
- **Score-Validierung**: Ungueltige Ergebnisse werden erkannt und markiert
- **Faire Auslosung**: Bei ungerader Spielerzahl setzt der Spieler mit den meisten Spielen aus; bei Wechselnden Partnern werden bisherige Partnerschaften gewichtet vermieden
- **Turnier kann nicht beendet werden** solange Spiele offen sind

### TV-/Beamer-Modus
- **Separates Fenster** optimiert fuer Querformat und Lesbarkeit aus der Ferne
- Oeffnet maximiert (verschiebbar auf zweiten Monitor), nicht im Vollbild
- **F11** = Vollbild-Toggle, **Escape** = Fenster schliessen
- Aktuelle Felderbelegung mit Live-Timer
- Warteschlange: Naechste Spiele in der Reihenfolge
- Letzte Ergebnisse mit Gewinner-Hervorhebung und Einzelpunkten
- Spieleraufruf-Banner mit Animation (📢 "Bitte zum Feld!")
- Passt sich an das gewaehlte Farbdesign an

### Rangliste & Auswertung
- **Live-Rangliste**: Sortiert nach Siegen, Satzverhaeltnis, Punkteverhaeltnis
- **Gruppen-Tabellen**: Bei Gruppenphase separate Tabelle pro Gruppe mit Qualifikanten-Markierung (Q)
- **Team-Standings**: Bei Doppel-Gruppenphase werden Teams (nicht Einzelspieler) gewertet
- **Medaillen**: 🥇🥈🥉 fuer die Top 3
- **Turnierbericht**: Druckbarer Bericht mit Highlights (knappstes Spiel, hoechster Sieg, meiste Punkte)
- **Druckansicht**: Spielplan, aktuelle Runde, Rangliste oder kompletter Bericht

### Language / Sprache
- **Englisch** (Default) und **Deutsch** verfuegbar
- Sprachauswahl in Einstellungen → Sprache
- Sofortiger Wechsel, persistent gespeichert

### Design & Themes
- **4 Farbdesigns**: Smaragd (Gruen), Saphir (Blau), Bernstein (Orange), Dunkel (Dark Mode)
- Theme-Wechsel ueber Einstellungen → Design, wird sofort angewendet
- Vollstaendiger Dark Mode: Alle Seiten, Modals, Inputs, Tabellen, Bracket-Ansicht
- **Schriftgroesse**: 7 Stufen (XXS bis XXL), persistent gespeichert
- Theme wird persistent gespeichert
- **Theme-konforme Druckansicht**: Druck-Report passt sich dem gewaehlten Farbschema an
- **Standard-Logo**: BOSS Logo in Sidebar (zentriert), TV-Modus, Favicon und App-Icon
- **Custom Vereinslogo**: Eigenes Logo hochladen mit Zuschnitt-Tool (1:1 Cropper)
  - Wird in der Sidebar (mit Text) und im TV-Modus angezeigt
  - Gespeichert in der SQLite-Datenbank (im Backup enthalten, wandert mit DB)
- **Badminton-Court SVG**: Dezentes Spielfeld-Hintergrundbild auf den Feld-Karten

### Sidebar
- **Einklappbar**: Sidebar auf Icons reduzierbar fuer mehr Platz (persistent gespeichert)
- Toggle-Button unten, Tooltip bei eingeklapptem Zustand
- **Versionsanzeige**: Aktuelle App-Version unten in der Sidebar

### Einstellungen
- **Updates**: Manueller Update-Check ueber GitHub Releases mit Fortschrittsanzeige und Auto-Restart
- **Design**: 4 Farbschemas (aufklappbar), Custom Vereinslogo mit Cropper
- **Voreinstellungen**: Standard-Spielfelder, Timer-Schwellenwerte (Warnung gelb, Kritisch rot)
- **Datenbank**: Speicherort anzeigen/aendern, Backup & Wiederherstellung
- **Gefahrenzone**: Spieler oder Turniere komplett loeschen (mit Sicherheitsabfrage)

### Tastatur-Navigation
- **Enter/Tab**: Springt zum naechsten Score-Feld (Team1→Team2→naechster Satz→naechstes Match)
- **Auto-Select**: Bei Fokus wird der Feldinhalt markiert (sofort ueberschreibbar)
- Komplette Ergebniseingabe ohne Maus moeglich

### Technisch
- **Installer**: Wahl zwischen Installation fuer alle Benutzer (Programme) oder nur aktuellen Benutzer
- **Auto-Update**: Manueller Check ueber Einstellungen, signierte Updates von GitHub Releases
- **Offline-faehig**: Laeuft komplett lokal, kein Internet noetig (Font lokal gebundelt)
- **Cross-Platform**: Windows + macOS (via GitHub Actions CI/CD)
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
│   ├── print/         # Druckansicht, Turnierbericht
│   └── tournament/    # Extrahierte Turnier-Komponenten
│       ├── DeleteTournamentModal.tsx
│       ├── RetirePlayerModal.tsx
│       ├── TemplateExportModal.tsx
│       ├── RanglisteTab.tsx
│       ├── VerwaltungTab.tsx
│       ├── TeamPairingStep.tsx
│       └── SeedingStep.tsx
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
│   ├── Sportstaetten.tsx # Sportstaetten mit Hallen
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
