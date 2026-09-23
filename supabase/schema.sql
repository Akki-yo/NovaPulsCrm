-- NovaPuls CRM: Komplettes Schema
-- Im Supabase SQL-Editor ausfuehren (Projekt -> SQL Editor -> New query -> kompletten Inhalt einfuegen -> Run)

create table if not exists firmen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  branche text,
  telefon_zentrale text,
  website text,
  adresse text,
  status text not null default 'Lead' check (status in ('Lead','Kontaktiert','Angebot','Verhandlung','Kunde','Verloren')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists ansprechpartner (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmen(id) on delete cascade,
  name text not null,
  position text,
  telefon text,
  email text,
  hauptkontakt boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists aktivitaeten (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmen(id) on delete cascade,
  mit_wem text,
  typ text not null default 'Notiz' check (typ in ('Anruf','E-Mail','Meeting','Notiz')),
  notiz text not null,
  wer text not null,
  wiedervorlage date,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table if not exists aufgaben (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references firmen(id) on delete cascade,
  titel text not null,
  zugewiesen_an text not null,
  faellig_am date,
  uhrzeit time,
  erledigt boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table firmen enable row level security;
alter table ansprechpartner enable row level security;
alter table aktivitaeten enable row level security;
alter table aufgaben enable row level security;

-- Beide angemeldeten Nutzer (du + Susu) sehen und bearbeiten alle Daten gemeinsam
create policy "authenticated full access firmen" on firmen
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access ansprechpartner" on ansprechpartner
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access aktivitaeten" on aktivitaeten
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access aufgaben" on aufgaben
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Realtime aktivieren, damit Aenderungen sofort bei beiden Nutzern ankommen
alter publication supabase_realtime add table firmen;
alter publication supabase_realtime add table ansprechpartner;
alter publication supabase_realtime add table aktivitaeten;
alter publication supabase_realtime add table aufgaben;
