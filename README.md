# NovaPuls CRM

Vollständiges CRM für Firmen, Ansprechpartner, Aufgaben und Anrufnotizen –
läuft komplett kostenlos in der Cloud (Supabase + Vercel) und synchronisiert
sich **live** zwischen dir und Susu (kein Neuladen nötig, Änderungen erscheinen
automatisch beim anderen).

## Kosten
Bei 2 Nutzern und ein paar hundert Einträgen läuft das komplett innerhalb der
kostenlosen Stufen von Supabase (Free Plan) und Vercel (Hobby Plan). Es entstehen
keine Kosten.

---

## Einrichtung (ca. 15 Minuten) – du hast Vercel schon, also geht's direkt los

### 1. Supabase-Projekt erstellen (kostenlos, ca. 2 Minuten)
1. Auf https://supabase.com registrieren/einloggen → "New Project"
2. Name z. B. "novapuls-crm", ein Datenbank-Passwort setzen (merken!), Region
   "Frankfurt (eu-central-1)" wählen (näher = schneller)
3. Warten, bis das Projekt fertig eingerichtet ist (ca. 1–2 Minuten)

### 2. Datenbank-Tabellen + Live-Sync anlegen
1. Im Supabase-Projekt links auf **SQL Editor** → **New query**
2. Kompletten Inhalt aus `supabase/schema.sql` (liegt in diesem Ordner) einfügen
   und auf **Run** klicken
   - Das legt die 4 Tabellen an (Firmen, Ansprechpartner, Aktivitäten, Aufgaben)
   - Und aktiviert **Realtime**, damit Änderungen sofort bei beiden ankommen

### 3. Zwei Nutzer anlegen – wichtig: bestimmte E-Mail-Form nutzen
Die App zeigt den Namen automatisch aus dem Teil vor dem @ an. Damit "Wael" und
"Susu" korrekt angezeigt werden, bitte **genau diese E-Mail-Adressen** verwenden
(die Domain dahinter ist egal, muss nur eine gültige E-Mail-Form sein):

- `wael@novapuls.de` (oder eine andere Adresse, die mit `wael@` beginnt)
- `susu@novapuls.de` (oder eine andere Adresse, die mit `susu@` beginnt)

So richtest du sie ein:
1. Links auf **Authentication** → **Users** → **Add user** → **Create new user**
2. E-Mail `wael@novapuls.de` + ein Passwort deiner Wahl, Häkchen bei
   **Auto Confirm User** setzen (sonst wird ein Bestätigungslink erwartet)
3. Dasselbe nochmal für `susu@novapuls.de`

### 4. API-Zugangsdaten kopieren
1. **Project Settings** (Zahnrad unten links) → **API**
2. **Project URL** und den **anon public** Key kopieren – beide brauchst du gleich

### 5. Projekt zu GitHub hochladen
Vercel deployed direkt aus einem GitHub-Repo. Falls du das Projekt noch nicht
in einem Repo hast:
```
cd novapuls-crm
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <DEIN-NEUES-REPO-AUF-GITHUB>
git push -u origin main
```
(Neues leeres Repo vorher auf github.com anlegen, am besten privat.)

### 6. In Vercel importieren
1. Auf https://vercel.com → **Add New** → **Project**
2. Das gerade gepushte GitHub-Repo auswählen → **Import**
3. Bei **Environment Variables** zwei Einträge hinzufügen:
   - `NEXT_PUBLIC_SUPABASE_URL` → die Project URL aus Schritt 4
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → der anon key aus Schritt 4
4. **Deploy** klicken – nach ca. 1 Minute ist die App live unter einer
   `*.vercel.app`-Adresse

### 7. Link an Susu schicken
Den Link, den Vercel dir gibt, an Susu schicken. Beide loggen sich mit ihrer
E-Mail + Passwort ein. Ab jetzt: was der eine einträgt, erscheint automatisch
und in Echtzeit beim anderen – ganz ohne Neuladen.

---

## Was drin ist
- Firmen mit mehreren Ansprechpartnern, Pipeline-Status (Lead → Kunde/Verloren)
- Aufgaben mit Zuweisung (Wael/Susu), Fälligkeitsdatum + Uhrzeit, abhakbar,
  bearbeitbar, löschbar
- Aktivitäten-Log (Anruf/E-Mail/Meeting/Notiz) mit freiem "mit wem gesprochen"-Feld
- Dashboard mit klickbaren Kennzahlen (Firmen, offene/überfällige Aufgaben,
  Aktivitäten gesamt) und Pipeline-Übersicht
- Drei-Punkte-Menü bei Firmen und Aufgaben zum Bearbeiten/Löschen
- **Live-Synchronisation** über Supabase Realtime – beide Nutzer sehen
  Änderungen des anderen sofort

## Spätere Anpassungen
Änderungswünsche einfach mir (Claude) schicken – ich passe den Code an, du
musst nur `git push` machen und Vercel deployed automatisch neu.

## Lokale Entwicklung (optional)
```
npm install
cp .env.example .env.local   # Werte aus Schritt 4 eintragen
npm run dev
```
