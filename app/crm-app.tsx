'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// --- Typen ---
type Firma = {
  id: string
  name: string
  branche: string | null
  telefon_zentrale: string | null
  website: string | null
  adresse: string | null
  status: string
  created_at: string
}
type Ansprechpartner = {
  id: string
  firma_id: string
  name: string
  position: string | null
  telefon: string | null
  email: string | null
  hauptkontakt: boolean
}
type Aktivitaet = {
  id: string
  firma_id: string
  mit_wem: string | null
  typ: string
  notiz: string
  wer: string
  wiedervorlage: string | null
  created_at: string
}
type Aufgabe = {
  id: string
  firma_id: string | null
  titel: string
  zugewiesen_an: string
  faellig_am: string | null
  uhrzeit: string | null
  erledigt: boolean
  created_at: string
}
type TaskFilter = 'offen' | 'ueberfaellig' | 'meine' | 'alle' | 'erledigt'
type ViewName = 'dashboard' | 'firmen' | 'aufgaben' | 'aktivitaeten' | 'neu' | 'detail'

// --- Konstanten ---
const STAGES = [
  { key: 'Lead', label: 'Neuer Lead', cls: 'stage-lead' },
  { key: 'Kontaktiert', label: 'Kontaktiert', cls: 'stage-kontaktiert' },
  { key: 'Angebot', label: 'Präsentation/Angebot', cls: 'stage-angebot' },
  { key: 'Verhandlung', label: 'Verhandlung', cls: 'stage-verhandlung' },
  { key: 'Kunde', label: 'Kunde', cls: 'stage-kunde' },
  { key: 'Verloren', label: 'Verloren', cls: 'stage-verloren' },
] as const
const stageMap: Record<string, (typeof STAGES)[number]> = {}
STAGES.forEach((s) => {
  stageMap[s.key] = s
})
const ACT_ICONS: Record<string, string> = { Anruf: '📞', 'E-Mail': '📧', Meeting: '🤝', Notiz: '📝' }

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('de-DE') : '–'
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('de-DE')
}
function assigneeBadgeClass(name?: string | null) {
  if (name === 'Wael') return 'badge-wael'
  if (name === 'Susu') return 'badge-susu'
  return 'badge-gray'
}

// --- Kebab-Menü (Portal, damit nichts von Tabellen/Cards abgeschnitten wird) ---
type KebabItem = { label: string; danger?: boolean; onClick: () => void }
function KebabMenu({ items }: { items: KebabItem[] }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  function toggle(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen((o) => !o)
  }

  return (
    <div className="kebab-wrap">
      <button type="button" className="kebab-btn" ref={btnRef} onClick={toggle}>
        ⋮
      </button>
      {open &&
        createPortal(
          <div className="kebab-menu open" style={{ top: pos.top, right: pos.right }} onClick={(e) => e.stopPropagation()}>
            {items.map((item, i) => (
              <button
                key={i}
                type="button"
                className={'kebab-item' + (item.danger ? ' danger' : '')}
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}

// --- Gemeinsames Aufgaben-Element ---
function TaskItem({
  task,
  firmaName,
  showFirmaLink,
  isEditing,
  currentUser,
  onEdit,
  onSave,
  onCancel,
  onToggle,
  onDelete,
  onOpenFirma,
}: {
  task: Aufgabe
  firmaName?: string
  showFirmaLink: boolean
  isEditing: boolean
  currentUser: string
  onEdit: () => void
  onSave: (fields: Partial<Aufgabe>) => void
  onCancel: () => void
  onToggle: (erledigt: boolean) => void
  onDelete: () => void
  onOpenFirma?: () => void
}) {
  const today = todayStr()
  const isOverdue = !task.erledigt && !!task.faellig_am && task.faellig_am < today
  const isMine = task.zugewiesen_an === currentUser

  if (isEditing) {
    return (
      <div className="task-item task-edit-row">
        <form
          className="inline-form"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            onSave({
              titel: String(fd.get('titel') || '').trim(),
              zugewiesen_an: String(fd.get('zugewiesenAn') || task.zugewiesen_an),
              faellig_am: (fd.get('faelligAm') as string) || null,
              uhrzeit: (fd.get('uhrzeit') as string) || null,
            })
          }}
        >
          <label>
            Aufgabe* <input name="titel" required defaultValue={task.titel} />
          </label>
          <label>
            Zugewiesen an
            <select name="zugewiesenAn" defaultValue={task.zugewiesen_an}>
              <option value="Susu">Susu</option>
              <option value="Wael">Wael</option>
            </select>
          </label>
          <label>
            Fällig am <input name="faelligAm" type="date" defaultValue={task.faellig_am || ''} />
          </label>
          <label>
            Uhrzeit <input name="uhrzeit" type="time" defaultValue={task.uhrzeit || ''} />
          </label>
          <button type="submit" className="small">
            Speichern
          </button>
          <button type="button" className="ghost small" onClick={onCancel}>
            Abbrechen
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className={'task-item' + (isMine && !task.erledigt ? ' task-mine' : '')}>
      <input type="checkbox" checked={task.erledigt} onChange={(e) => onToggle(e.target.checked)} />
      <div style={{ flex: 1 }}>
        <div className={'task-title' + (task.erledigt ? ' done' : '')}>
          {task.titel} <span className={'badge ' + assigneeBadgeClass(task.zugewiesen_an)}>{task.zugewiesen_an}</span>
        </div>
        <div className={'task-sub' + (isOverdue ? ' task-overdue' : '')}>
          {showFirmaLink && firmaName && (
            <>
              <a className="row-link" onClick={onOpenFirma}>
                {firmaName}
              </a>{' '}
              ·{' '}
            </>
          )}
          {task.faellig_am ? 'Fällig: ' + fmtDate(task.faellig_am) + (task.uhrzeit ? ', ' + task.uhrzeit + ' Uhr' : '') : 'Ohne Termin'}
        </div>
      </div>
      <KebabMenu
        items={[
          { label: 'Bearbeiten', onClick: onEdit },
          { label: 'Löschen', danger: true, onClick: onDelete },
        ]}
      />
    </div>
  )
}

// --- Dashboard ---
function DashboardView({
  firmen,
  aufgaben,
  aktivitaeten,
  currentUser,
  onGoFirmen,
  onGoAufgaben,
  onGoAktivitaeten,
  onGoStage,
  onOpenFirma,
}: {
  firmen: Firma[]
  aufgaben: Aufgabe[]
  aktivitaeten: Aktivitaet[]
  currentUser: string
  onGoFirmen: () => void
  onGoAufgaben: (f: TaskFilter) => void
  onGoAktivitaeten: () => void
  onGoStage: (stage: string) => void
  onOpenFirma: (id: string) => void
}) {
  const today = todayStr()
  const openTasks = aufgaben.filter((t) => !t.erledigt)
  const overdue = openTasks.filter((t) => t.faellig_am && t.faellig_am < today)
  const myOpen = openTasks
    .filter((t) => t.zugewiesen_an === currentUser)
    .sort((a, b) => ((a.faellig_am || '9999') < (b.faellig_am || '9999') ? -1 : 1))
  const sortedOpen = openTasks
    .slice()
    .sort((a, b) => ((a.faellig_am || '9999') < (b.faellig_am || '9999') ? -1 : 1))
    .slice(0, 8)
  const recent = aktivitaeten
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8)

  function firmaName(id: string) {
    return firmen.find((f) => f.id === id)?.name || ''
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="stat-row">
        <div className="stat-box" onClick={onGoFirmen}>
          <div className="num">{firmen.length}</div>
          <div className="label">Firmen</div>
        </div>
        <div className="stat-box" onClick={() => onGoAufgaben('offen')}>
          <div className="num">{openTasks.length}</div>
          <div className="label">Offene Aufgaben</div>
        </div>
        <div className="stat-box" onClick={() => onGoAufgaben('ueberfaellig')}>
          <div className="num">{overdue.length}</div>
          <div className="label">Überfällige Aufgaben</div>
        </div>
        <div className="stat-box" onClick={onGoAktivitaeten}>
          <div className="num">{aktivitaeten.length}</div>
          <div className="label">Aktivitäten gesamt</div>
        </div>
      </div>

      <div className="card">
        <h2>Pipeline-Übersicht</h2>
        <div className="pipeline-row">
          {STAGES.map((s) => {
            const count = firmen.filter((f) => f.status === s.key).length
            return (
              <div key={s.key} className="pipeline-box" onClick={() => onGoStage(s.key)}>
                <div className="num">{count}</div>
                <div className="label">{s.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card">
        <h2>Für dich fällig</h2>
        <ul className="list">
          {myOpen.length === 0 && <li className="empty-hint">Keine offenen Aufgaben für dich.</li>}
          {myOpen.map((t) => {
            const isOverdue = !!(t.faellig_am && t.faellig_am < today)
            return (
              <li key={t.id}>
                {t.firma_id && (
                  <a className="row-link" onClick={() => onOpenFirma(t.firma_id as string)}>
                    {firmaName(t.firma_id)}
                  </a>
                )}
                <span className={'date' + (isOverdue ? ' task-overdue' : '')}>
                  {t.faellig_am ? fmtDate(t.faellig_am) + (t.uhrzeit ? ', ' + t.uhrzeit + ' Uhr' : '') : 'ohne Termin'}
                </span>
                <p className="note-preview">{t.titel}</p>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="card">
        <h2>
          Offene Aufgaben{' '}
          <a className="row-link" style={{ fontSize: '0.8rem', fontWeight: 400 }} onClick={() => onGoAufgaben('offen')}>
            Alle Aufgaben ansehen →
          </a>
        </h2>
        <ul className="list">
          {sortedOpen.length === 0 && <li className="empty-hint">Keine offenen Aufgaben.</li>}
          {sortedOpen.map((t) => {
            const isOverdue = !!(t.faellig_am && t.faellig_am < today)
            return (
              <li key={t.id}>
                {t.firma_id && (
                  <a className="row-link" onClick={() => onOpenFirma(t.firma_id as string)}>
                    {firmaName(t.firma_id)}
                  </a>
                )}{' '}
                <span className={'badge ' + assigneeBadgeClass(t.zugewiesen_an)}>{t.zugewiesen_an}</span>
                <span className={'date' + (isOverdue ? ' task-overdue' : '')}>
                  {t.faellig_am ? fmtDate(t.faellig_am) + (t.uhrzeit ? ', ' + t.uhrzeit : '') : 'ohne Termin'}
                </span>
                <p className="note-preview">{t.titel}</p>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="card">
        <h2>Letzte Aktivität</h2>
        <ul className="list">
          {recent.length === 0 && <li className="empty-hint">Noch keine Aktivitäten erfasst.</li>}
          {recent.map((a) => (
            <li key={a.id}>
              <a className="row-link" onClick={() => onOpenFirma(a.firma_id)}>
                {ACT_ICONS[a.typ]} {firmaName(a.firma_id)}
              </a>
              <span className="date">
                {fmtDateTime(a.created_at)} · {a.wer}
              </span>
              <p className="note-preview">{a.notiz}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// --- Firmen-Liste ---
function FirmenView({
  firmen,
  ansprechpartner,
  aufgaben,
  aktivitaeten,
  search,
  onSearch,
  stageFilter,
  onOpen,
  onEdit,
  onDelete,
}: {
  firmen: Firma[]
  ansprechpartner: Ansprechpartner[]
  aufgaben: Aufgabe[]
  aktivitaeten: Aktivitaet[]
  search: string
  onSearch: (v: string) => void
  stageFilter: string | null
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string, name: string) => void
}) {
  let rows = firmen.slice()
  if (stageFilter) rows = rows.filter((f) => f.status === stageFilter)
  const q = search.toLowerCase()
  rows = rows
    .filter((f) => {
      const aps = ansprechpartner
        .filter((a) => a.firma_id === f.id)
        .map((a) => a.name)
        .join(' ')
      const hay = (f.name + ' ' + (f.branche || '') + ' ' + (f.telefon_zentrale || '') + ' ' + aps).toLowerCase()
      return hay.includes(q)
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  function hauptkontaktName(firmaId: string) {
    const aps = ansprechpartner.filter((a) => a.firma_id === firmaId)
    const hk = aps.find((a) => a.hauptkontakt) || aps[0]
    return hk ? hk.name : null
  }
  function openTaskCount(firmaId: string) {
    return aufgaben.filter((t) => t.firma_id === firmaId && !t.erledigt).length
  }
  function lastContact(firmaId: string) {
    const acts = aktivitaeten.filter((a) => a.firma_id === firmaId)
    if (!acts.length) return null
    return acts.reduce((max, a) => (a.created_at > max ? a.created_at : max), acts[0].created_at)
  }

  return (
    <div>
      <h1>Firmen</h1>
      <input
        className="search"
        placeholder="Suche nach Firma, Branche, Ansprechpartner oder Telefon…"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Firma</th>
              <th>Branche</th>
              <th>Hauptansprechpartner</th>
              <th>Pipeline</th>
              <th>Offene Aufgaben</th>
              <th>Letzter Kontakt</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-hint">
                  Keine Firmen gefunden.
                </td>
              </tr>
            )}
            {rows.map((f) => {
              const hk = hauptkontaktName(f.id)
              const openCount = openTaskCount(f.id)
              const last = lastContact(f.id)
              const stage = stageMap[f.status] || STAGES[0]
              return (
                <tr key={f.id}>
                  <td>
                    <a className="row-link" onClick={() => onOpen(f.id)}>
                      {f.name}
                    </a>
                  </td>
                  <td>{f.branche}</td>
                  <td>{hk ? hk : <span className="muted">Nur Zentrale bekannt</span>}</td>
                  <td>
                    <span className={'badge ' + stage.cls}>{stage.label}</span>
                  </td>
                  <td>{openCount ? openCount : '–'}</td>
                  <td>{last ? fmtDate(last) : '–'}</td>
                  <td>
                    <KebabMenu
                      items={[
                        { label: 'Bearbeiten', onClick: () => onEdit(f.id) },
                        { label: 'Löschen', danger: true, onClick: () => onDelete(f.id, f.name) },
                      ]}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// --- Aufgaben (global) ---
function AufgabenView({
  aufgaben,
  firmen,
  currentUser,
  filter,
  onFilterChange,
  editingTaskId,
  onEdit,
  onToggle,
  onSave,
  onDelete,
  onOpenFirma,
  onAddTask,
}: {
  aufgaben: Aufgabe[]
  firmen: Firma[]
  currentUser: string
  filter: TaskFilter
  onFilterChange: (f: TaskFilter) => void
  editingTaskId: string | null
  onEdit: (id: string | null) => void
  onToggle: (id: string, erledigt: boolean) => void
  onSave: (id: string, fields: Partial<Aufgabe>) => void
  onDelete: (id: string, titel: string) => void
  onOpenFirma: (id: string) => void
  onAddTask: (fields: Partial<Aufgabe>) => void
}) {
  const today = todayStr()
  let tasks = aufgaben.slice()
  if (filter === 'offen') tasks = tasks.filter((t) => !t.erledigt)
  if (filter === 'erledigt') tasks = tasks.filter((t) => t.erledigt)
  if (filter === 'meine') tasks = tasks.filter((t) => !t.erledigt && t.zugewiesen_an === currentUser)
  if (filter === 'ueberfaellig') tasks = tasks.filter((t) => !t.erledigt && t.faellig_am && t.faellig_am < today)
  tasks.sort((a, b) => {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1
    return (a.faellig_am || '9999') < (b.faellig_am || '9999') ? -1 : 1
  })

  const chips: { key: TaskFilter; label: string }[] = [
    { key: 'offen', label: 'Offen' },
    { key: 'ueberfaellig', label: 'Überfällig' },
    { key: 'meine', label: 'Nur meine' },
    { key: 'alle', label: 'Alle' },
    { key: 'erledigt', label: 'Erledigt' },
  ]

  return (
    <div>
      <h1>Aufgaben</h1>
      <div className="quick-chips">
        {chips.map((c) => (
          <span
            key={c.key}
            className="chip"
            style={filter === c.key ? { borderColor: 'var(--blue)', color: 'var(--blue)' } : undefined}
            onClick={() => onFilterChange(c.key)}
          >
            {c.label}
          </span>
        ))}
      </div>

      <div className="card">
        <h2>Neue Aufgabe</h2>
        <form
          className="inline-form"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            onAddTask({
              titel: String(fd.get('titel') || '').trim(),
              zugewiesen_an: String(fd.get('zugewiesenAn') || currentUser),
              faellig_am: (fd.get('faelligAm') as string) || null,
              uhrzeit: (fd.get('uhrzeit') as string) || null,
              firma_id: (fd.get('firmaId') as string) || null,
              erledigt: false,
            })
            e.currentTarget.reset()
          }}
        >
          <label>
            Aufgabe* <input name="titel" required />
          </label>
          <label>
            Firma (optional)
            <select name="firmaId" defaultValue="">
              <option value="">Keine Firma</option>
              {firmen.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Zugewiesen an
            <select name="zugewiesenAn" defaultValue={currentUser === 'Wael' ? 'Wael' : 'Susu'}>
              <option value="Susu">Susu</option>
              <option value="Wael">Wael</option>
            </select>
          </label>
          <label>
            Fällig am <input name="faelligAm" type="date" />
          </label>
          <label>
            Uhrzeit <input name="uhrzeit" type="time" />
          </label>
          <button type="submit" className="small">
            + Aufgabe anlegen
          </button>
        </form>
      </div>

      <div className="card">
        {tasks.length === 0 && <p className="empty-hint">Keine Aufgaben in dieser Ansicht.</p>}
        {tasks.map((t) => {
          const firma = firmen.find((f) => f.id === t.firma_id)
          return (
            <TaskItem
              key={t.id}
              task={t}
              firmaName={firma?.name}
              showFirmaLink
              isEditing={editingTaskId === t.id}
              currentUser={currentUser}
              onEdit={() => onEdit(t.id)}
              onSave={(fields) => onSave(t.id, fields)}
              onCancel={() => onEdit(null)}
              onToggle={(erledigt) => onToggle(t.id, erledigt)}
              onDelete={() => onDelete(t.id, t.titel)}
              onOpenFirma={firma ? () => onOpenFirma(firma.id) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}

// --- Aktivitäten (global) ---
function AktivitaetenView({ aktivitaeten, firmen, onOpenFirma }: { aktivitaeten: Aktivitaet[]; firmen: Firma[]; onOpenFirma: (id: string) => void }) {
  const acts = aktivitaeten.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))
  return (
    <div>
      <h1>Aktivitäten</h1>
      <div className="card">
        <ul className="timeline">
          {acts.length === 0 && <li className="empty-hint">Noch keine Aktivitäten erfasst.</li>}
          {acts.map((a) => {
            const f = firmen.find((f) => f.id === a.firma_id)
            return (
              <li key={a.id}>
                <div className="timeline-meta">
                  <span className="act-icon">{ACT_ICONS[a.typ] || '📝'}</span>
                  <strong>{fmtDateTime(a.created_at)}</strong>
                  {f && (
                    <a className="row-link" onClick={() => onOpenFirma(f.id)}>
                      {f.name}
                    </a>
                  )}
                  <span>· {a.wer}</span>
                  <span>· mit {a.mit_wem || 'Zentrale / Empfang'}</span>
                  {a.wiedervorlage && <span className="badge stage-kontaktiert">Wiedervorlage: {fmtDate(a.wiedervorlage)}</span>}
                </div>
                <p>{a.notiz}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// --- Neue Firma ---
function NeueFirmaView({ onCreate }: { onCreate: (fields: Partial<Firma>) => void }) {
  return (
    <div>
      <h1>Neue Firma</h1>
      <form
        className="form card"
        onSubmit={(e: FormEvent<HTMLFormElement>) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          onCreate({
            name: String(fd.get('name') || '').trim(),
            branche: String(fd.get('branche') || '').trim(),
            telefon_zentrale: String(fd.get('telefonZentrale') || '').trim(),
            website: String(fd.get('website') || '').trim(),
            adresse: String(fd.get('adresse') || '').trim(),
            status: String(fd.get('status') || 'Lead'),
          })
          e.currentTarget.reset()
        }}
      >
        <label>
          Firmenname* <input name="name" required />
        </label>
        <div className="form-row">
          <label>
            Branche <input name="branche" placeholder="z.B. Logistik, Produktion, Pflege" />
          </label>
          <label>
            Telefon Zentrale <input name="telefonZentrale" />
          </label>
        </div>
        <div className="form-row">
          <label>
            Website <input name="website" placeholder="https://…" />
          </label>
          <label>
            Adresse <input name="adresse" />
          </label>
        </div>
        <label>
          Pipeline-Status
          <select name="status" defaultValue="Lead">
            <option value="Lead">Neuer Lead</option>
            <option value="Kontaktiert">Kontaktiert</option>
            <option value="Angebot">Präsentation / Angebot läuft</option>
            <option value="Verhandlung">Verhandlung</option>
            <option value="Kunde">Kunde</option>
            <option value="Verloren">Verloren</option>
          </select>
        </label>
        <button type="submit">Speichern</button>
      </form>
    </div>
  )
}

// --- Firma-Detail ---
function FirmaDetailView({
  firma,
  ansprechpartner,
  aufgaben,
  aktivitaeten,
  currentUser,
  editing,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onStatusChange,
  onDelete,
  onAddAp,
  onRemoveAp,
  onAddTask,
  editingTaskId,
  onEditTask,
  onSaveTask,
  onDeleteTask,
  onToggleTask,
  onAddActivity,
}: {
  firma: Firma
  ansprechpartner: Ansprechpartner[]
  aufgaben: Aufgabe[]
  aktivitaeten: Aktivitaet[]
  currentUser: string
  editing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: (fields: Partial<Firma>) => void
  onStatusChange: (status: string) => void
  onDelete: () => void
  onAddAp: (fields: Partial<Ansprechpartner>) => void
  onRemoveAp: (id: string) => void
  onAddTask: (fields: Partial<Aufgabe>) => void
  editingTaskId: string | null
  onEditTask: (id: string | null) => void
  onSaveTask: (id: string, fields: Partial<Aufgabe>) => void
  onDeleteTask: (id: string, titel: string) => void
  onToggleTask: (id: string, erledigt: boolean) => void
  onAddActivity: (fields: Partial<Aktivitaet> & { wiedervorlage?: string | null }) => void
}) {
  const [taskTitleDraft, setTaskTitleDraft] = useState('')
  const sortedTasks = aufgaben.slice().sort((a, b) => {
    if (a.erledigt !== b.erledigt) return a.erledigt ? 1 : -1
    return (a.faellig_am || '9999') < (b.faellig_am || '9999') ? -1 : 1
  })
  const sortedActs = aktivitaeten.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))
  const apNames = ansprechpartner.map((a) => a.name)

  return (
    <div>
      <div className="firma-header card">
        {!editing ? (
          <div>
            <h1>{firma.name}</h1>
            <p className="firma-meta">
              {[firma.branche, firma.telefon_zentrale, firma.website, firma.adresse].filter(Boolean).join(' · ') || 'Keine weiteren Angaben'}
            </p>
          </div>
        ) : (
          <form
            className="form"
            style={{ width: '100%' }}
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault()
              const fd = new FormData(e.currentTarget)
              onSaveEdit({
                name: String(fd.get('name') || '').trim(),
                branche: String(fd.get('branche') || '').trim(),
                telefon_zentrale: String(fd.get('telefonZentrale') || '').trim(),
                website: String(fd.get('website') || '').trim(),
                adresse: String(fd.get('adresse') || '').trim(),
              })
            }}
          >
            <div className="form-row">
              <label>
                Firmenname* <input name="name" required defaultValue={firma.name} />
              </label>
              <label>
                Branche <input name="branche" defaultValue={firma.branche || ''} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Telefon Zentrale <input name="telefonZentrale" defaultValue={firma.telefon_zentrale || ''} />
              </label>
              <label>
                Website <input name="website" defaultValue={firma.website || ''} />
              </label>
            </div>
            <label>
              Adresse <input name="adresse" defaultValue={firma.adresse || ''} />
            </label>
            <div className="form-actions">
              <button type="submit">Speichern</button>
              <button type="button" className="ghost" onClick={onCancelEdit}>
                Abbrechen
              </button>
            </div>
          </form>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <select value={firma.status} onChange={(e) => onStatusChange(e.target.value)}>
            {STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <KebabMenu
            items={[
              { label: 'Bearbeiten', onClick: onStartEdit },
              { label: 'Löschen', danger: true, onClick: onDelete },
            ]}
          />
        </div>
      </div>

      <div className="card">
        <h2>Ansprechpartner</h2>
        <div>
          {ansprechpartner.length === 0 && <p className="empty-hint">Noch kein Ansprechpartner erfasst – bisher nur die Zentrale bekannt.</p>}
          {ansprechpartner.map((a) => (
            <div className="ap-card" key={a.id}>
              <div>
                <div className="ap-name">
                  {a.name}
                  {a.hauptkontakt && <span className="ap-star">★ Hauptkontakt</span>}
                </div>
                <div className="ap-meta">{[a.position, a.telefon, a.email].filter(Boolean).join(' · ')}</div>
              </div>
              <button className="ghost small" onClick={() => onRemoveAp(a.id)}>
                Entfernen
              </button>
            </div>
          ))}
        </div>
        <form
          className="inline-form"
          style={{ marginTop: '0.8rem' }}
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            onAddAp({
              name: String(fd.get('name') || '').trim(),
              position: String(fd.get('position') || '').trim(),
              telefon: String(fd.get('telefon') || '').trim(),
              email: String(fd.get('email') || '').trim(),
              hauptkontakt: fd.get('hauptkontakt') === 'on',
            })
            e.currentTarget.reset()
          }}
        >
          <label>
            Name* <input name="name" required />
          </label>
          <label>
            Position <input name="position" placeholder="z.B. Einkauf" />
          </label>
          <label>
            Telefon <input name="telefon" />
          </label>
          <label>
            E-Mail <input name="email" type="email" />
          </label>
          <label style={{ maxWidth: '130px' }}>
            <span style={{ visibility: 'hidden', display: 'block' }}>&nbsp;</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 400, marginTop: '0.3rem' }}>
              <input type="checkbox" name="hauptkontakt" style={{ width: 'auto', margin: 0 }} /> Hauptkontakt
            </span>
          </label>
          <button type="submit" className="small">
            + Hinzufügen
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Aufgaben</h2>
        <div className="quick-chips">
          <span className="chip" onClick={() => setTaskTitleDraft('Angebot verschicken')}>
            📄 Angebot verschicken
          </span>
          <span className="chip" onClick={() => setTaskTitleDraft('Präsentation verschicken')}>
            📊 Präsentation verschicken
          </span>
          <span className="chip" onClick={() => setTaskTitleDraft('Rückruf')}>
            ☎️ Rückruf
          </span>
          <span className="chip" onClick={() => setTaskTitleDraft('')}>
            ✏️ Eigene Aufgabe
          </span>
        </div>
        <div>
          {sortedTasks.length === 0 && <p className="empty-hint">Noch keine Aufgaben angelegt.</p>}
          {sortedTasks.map((t) => (
            <TaskItem
              key={t.id}
              task={t}
              showFirmaLink={false}
              isEditing={editingTaskId === t.id}
              currentUser={currentUser}
              onEdit={() => onEditTask(t.id)}
              onSave={(fields) => onSaveTask(t.id, fields)}
              onCancel={() => onEditTask(null)}
              onToggle={(erledigt) => onToggleTask(t.id, erledigt)}
              onDelete={() => onDeleteTask(t.id, t.titel)}
            />
          ))}
        </div>
        <form
          className="inline-form"
          style={{ marginTop: '0.8rem' }}
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            onAddTask({
              titel: String(fd.get('titel') || '').trim(),
              zugewiesen_an: String(fd.get('zugewiesenAn') || currentUser),
              faellig_am: (fd.get('faelligAm') as string) || null,
              uhrzeit: (fd.get('uhrzeit') as string) || null,
              erledigt: false,
            })
            e.currentTarget.reset()
            setTaskTitleDraft('')
          }}
        >
          <label>
            Aufgabe*{' '}
            <input name="titel" required value={taskTitleDraft} onChange={(e) => setTaskTitleDraft(e.target.value)} />
          </label>
          <label>
            Zugewiesen an
            <select name="zugewiesenAn" defaultValue={currentUser === 'Wael' ? 'Wael' : 'Susu'}>
              <option value="Susu">Susu</option>
              <option value="Wael">Wael</option>
            </select>
          </label>
          <label>
            Fällig am <input name="faelligAm" type="date" />
          </label>
          <label>
            Uhrzeit <input name="uhrzeit" type="time" />
          </label>
          <button type="submit" className="small">
            + Aufgabe anlegen
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Neue Aktivität erfassen</h2>
        <form
          className="form"
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault()
            const form = e.currentTarget
            const fd = new FormData(form)
            onAddActivity({
              typ: String(fd.get('typ') || 'Notiz'),
              mit_wem: String(fd.get('mitWem') || '').trim() || 'Zentrale / Empfang',
              notiz: String(fd.get('notiz') || '').trim(),
              wer: String(fd.get('wer') || '').trim(),
              wiedervorlage: (fd.get('wiedervorlage') as string) || null,
            })
            form.reset()
            const werInput = form.querySelector('[name="wer"]') as HTMLInputElement | null
            if (werInput) werInput.value = currentUser
          }}
        >
          <div className="form-row">
            <label>
              Art
              <select name="typ" defaultValue="Anruf">
                <option value="Anruf">📞 Anruf</option>
                <option value="E-Mail">📧 E-Mail</option>
                <option value="Meeting">🤝 Meeting</option>
                <option value="Notiz">📝 Notiz</option>
              </select>
            </label>
            <label>
              Mit wem gesprochen?
              <input name="mitWem" list="ap-datalist" placeholder="Zentrale, Name eingeben oder auswählen…" />
              <datalist id="ap-datalist">
                <option value="Zentrale / Empfang" />
                {apNames.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </label>
          </div>
          <label>
            Notiz* <textarea name="notiz" rows={3} required placeholder="Worum ging es?" />
          </label>
          <div className="form-row">
            <label>
              Wer hat telefoniert? <input name="wer" required defaultValue={currentUser} />
            </label>
            <label>
              Wiedervorlage am <input name="wiedervorlage" type="date" />
            </label>
          </div>
          <button type="submit">Aktivität speichern</button>
        </form>
      </div>

      <div className="card">
        <h2>Verlauf</h2>
        <ul className="timeline">
          {sortedActs.length === 0 && <li className="empty-hint">Noch keine Aktivitäten erfasst.</li>}
          {sortedActs.map((a) => (
            <li key={a.id}>
              <div className="timeline-meta">
                <span className="act-icon">{ACT_ICONS[a.typ] || '📝'}</span>
                <strong>{fmtDateTime(a.created_at)}</strong>
                <span>· {a.wer}</span>
                <span>· mit {a.mit_wem || 'Zentrale / Empfang'}</span>
                {a.wiedervorlage && <span className="badge stage-kontaktiert">Wiedervorlage: {fmtDate(a.wiedervorlage)}</span>}
              </div>
              <p>{a.notiz}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// --- Haupt-App ---
export default function CrmApp({ userEmail, currentUser }: { userEmail: string; currentUser: string }) {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [firmen, setFirmen] = useState<Firma[]>([])
  const [ansprechpartner, setAnsprechpartner] = useState<Ansprechpartner[]>([])
  const [aktivitaeten, setAktivitaeten] = useState<Aktivitaet[]>([])
  const [aufgaben, setAufgaben] = useState<Aufgabe[]>([])

  const [view, setView] = useState<ViewName>('dashboard')
  const [selectedFirmaId, setSelectedFirmaId] = useState<string | null>(null)
  const [stageFilter, setStageFilter] = useState<string | null>(null)
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('offen')
  const [firmaSearch, setFirmaSearch] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingFirma, setEditingFirma] = useState(false)

  const fetchAll = useCallback(async () => {
    const [f, a, k, t] = await Promise.all([
      supabase.from('firmen').select('*').order('created_at', { ascending: false }),
      supabase.from('ansprechpartner').select('*'),
      supabase.from('aktivitaeten').select('*'),
      supabase.from('aufgaben').select('*'),
    ])
    setFirmen((f.data as Firma[]) || [])
    setAnsprechpartner((a.data as Ansprechpartner[]) || [])
    setAktivitaeten((k.data as Aktivitaet[]) || [])
    setAufgaben((t.data as Aufgabe[]) || [])
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchAll()
    const channel = supabase
      .channel('crm-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'firmen' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ansprechpartner' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aktivitaeten' }, () => fetchAll())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aufgaben' }, () => fetchAll())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  async function addFirma(fields: Partial<Firma>) {
    const { data } = await supabase.from('firmen').insert(fields).select().single()
    await fetchAll()
    if (data) {
      setSelectedFirmaId(data.id)
      setEditingFirma(false)
      setView('detail')
    }
  }
  async function updateFirmaFields(id: string, fields: Partial<Firma>) {
    await supabase.from('firmen').update(fields).eq('id', id)
    await fetchAll()
  }
  async function deleteFirma(id: string) {
    await supabase.from('firmen').delete().eq('id', id)
    if (selectedFirmaId === id) setSelectedFirmaId(null)
    await fetchAll()
  }
  async function addAnsprechpartner(firmaId: string, fields: Partial<Ansprechpartner>) {
    if (fields.hauptkontakt) {
      await supabase.from('ansprechpartner').update({ hauptkontakt: false }).eq('firma_id', firmaId)
    }
    await supabase.from('ansprechpartner').insert({ ...fields, firma_id: firmaId })
    await fetchAll()
  }
  async function removeAnsprechpartner(id: string) {
    await supabase.from('ansprechpartner').delete().eq('id', id)
    await fetchAll()
  }
  async function addAufgabe(fields: Partial<Aufgabe>) {
    await supabase.from('aufgaben').insert(fields)
    await fetchAll()
  }
  async function updateAufgabe(id: string, fields: Partial<Aufgabe>) {
    await supabase.from('aufgaben').update(fields).eq('id', id)
    await fetchAll()
  }
  async function deleteAufgabe(id: string) {
    await supabase.from('aufgaben').delete().eq('id', id)
    await fetchAll()
  }
  async function addAktivitaet(firmaId: string, fields: Partial<Aktivitaet> & { wiedervorlage?: string | null }) {
    await supabase.from('aktivitaeten').insert({ ...fields, firma_id: firmaId })
    if (fields.wiedervorlage) {
      await supabase.from('aufgaben').insert({
        firma_id: firmaId,
        titel: 'Wiedervorlage: ' + (fields.notiz || '').slice(0, 60),
        zugewiesen_an: currentUser,
        faellig_am: fields.wiedervorlage,
        uhrzeit: null,
        erledigt: false,
      })
    }
    await fetchAll()
  }

  function goToFirmen(stage: string | null) {
    setStageFilter(stage)
    setFirmaSearch('')
    setView('firmen')
  }
  function goToAufgaben(filter: TaskFilter) {
    setTaskFilter(filter)
    setEditingTaskId(null)
    setView('aufgaben')
  }
  function openDetail(id: string) {
    setSelectedFirmaId(id)
    setEditingFirma(false)
    setEditingTaskId(null)
    setView('detail')
  }

  const apsForFirma = (firmaId: string) => ansprechpartner.filter((a) => a.firma_id === firmaId)
  const tasksForFirma = (firmaId: string) => aufgaben.filter((t) => t.firma_id === firmaId)
  const activitiesForFirma = (firmaId: string) => aktivitaeten.filter((a) => a.firma_id === firmaId)

  if (loading) {
    return (
      <div className="app-shell">
        <div className="content">
          <p className="muted">Lade Daten…</p>
        </div>
      </div>
    )
  }

  const selectedFirma = firmen.find((f) => f.id === selectedFirmaId) || null

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          <div className="logo-mark">
            <img src="/logo-header.png" alt="NovaPuls" />
          </div>
        </div>
        <nav>
          <a className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>
            Dashboard
          </a>
          <a className={view === 'firmen' ? 'active' : ''} onClick={() => goToFirmen(null)}>
            Firmen
          </a>
          <a className={view === 'aufgaben' ? 'active' : ''} onClick={() => goToAufgaben('offen')}>
            Aufgaben
          </a>
          <a className={view === 'aktivitaeten' ? 'active' : ''} onClick={() => setView('aktivitaeten')}>
            Aktivitäten
          </a>
          <a
            className={view === 'neu' ? 'active' : ''}
            onClick={() => {
              setEditingFirma(false)
              setView('neu')
            }}
          >
            + Neue Firma
          </a>
        </nav>
        <div className="user-area">
          <span>{currentUser}</span>
          <button className="link-btn" onClick={handleLogout}>
            Abmelden
          </button>
        </div>
      </header>
      <main className="content">
        {view === 'dashboard' && (
          <DashboardView
            firmen={firmen}
            aufgaben={aufgaben}
            aktivitaeten={aktivitaeten}
            currentUser={currentUser}
            onGoFirmen={() => goToFirmen(null)}
            onGoAufgaben={(f) => goToAufgaben(f)}
            onGoAktivitaeten={() => setView('aktivitaeten')}
            onGoStage={(s) => goToFirmen(s)}
            onOpenFirma={openDetail}
          />
        )}
        {view === 'firmen' && (
          <FirmenView
            firmen={firmen}
            ansprechpartner={ansprechpartner}
            aufgaben={aufgaben}
            aktivitaeten={aktivitaeten}
            search={firmaSearch}
            onSearch={setFirmaSearch}
            stageFilter={stageFilter}
            onOpen={openDetail}
            onEdit={(id) => {
              openDetail(id)
              setEditingFirma(true)
            }}
            onDelete={async (id, name) => {
              if (confirm('Firma „' + name + '" inkl. aller Ansprechpartner, Aufgaben und Aktivitäten wirklich löschen?')) await deleteFirma(id)
            }}
          />
        )}
        {view === 'aufgaben' && (
          <AufgabenView
            aufgaben={aufgaben}
            firmen={firmen}
            currentUser={currentUser}
            filter={taskFilter}
            onFilterChange={setTaskFilter}
            editingTaskId={editingTaskId}
            onEdit={setEditingTaskId}
            onToggle={(id, erledigt) => updateAufgabe(id, { erledigt })}
            onSave={(id, fields) => {
              updateAufgabe(id, fields)
              setEditingTaskId(null)
            }}
            onDelete={(id, titel) => {
              if (confirm('Aufgabe „' + titel + '" wirklich löschen?')) deleteAufgabe(id)
            }}
            onOpenFirma={openDetail}
            onAddTask={(fields) => addAufgabe(fields)}
          />
        )}
        {view === 'aktivitaeten' && <AktivitaetenView aktivitaeten={aktivitaeten} firmen={firmen} onOpenFirma={openDetail} />}
        {view === 'neu' && <NeueFirmaView onCreate={addFirma} />}
        {view === 'detail' && selectedFirma && (
          <FirmaDetailView
            firma={selectedFirma}
            ansprechpartner={apsForFirma(selectedFirma.id)}
            aufgaben={tasksForFirma(selectedFirma.id)}
            aktivitaeten={activitiesForFirma(selectedFirma.id)}
            currentUser={currentUser}
            editing={editingFirma}
            onStartEdit={() => setEditingFirma(true)}
            onCancelEdit={() => setEditingFirma(false)}
            onSaveEdit={(fields) => {
              updateFirmaFields(selectedFirma.id, fields)
              setEditingFirma(false)
            }}
            onStatusChange={(status) => updateFirmaFields(selectedFirma.id, { status })}
            onDelete={() => {
              if (confirm('Firma „' + selectedFirma.name + '" inkl. aller Ansprechpartner, Aufgaben und Aktivitäten wirklich löschen?')) {
                deleteFirma(selectedFirma.id)
                setView('firmen')
              }
            }}
            onAddAp={(fields) => addAnsprechpartner(selectedFirma.id, fields)}
            onRemoveAp={removeAnsprechpartner}
            onAddTask={(fields) => addAufgabe({ ...fields, firma_id: selectedFirma.id })}
            editingTaskId={editingTaskId}
            onEditTask={setEditingTaskId}
            onSaveTask={(id, fields) => {
              updateAufgabe(id, fields)
              setEditingTaskId(null)
            }}
            onDeleteTask={(id, titel) => {
              if (confirm('Aufgabe „' + titel + '" wirklich löschen?')) deleteAufgabe(id)
            }}
            onToggleTask={(id, erledigt) => updateAufgabe(id, { erledigt })}
            onAddActivity={(fields) => addAktivitaet(selectedFirma.id, fields)}
          />
        )}
      </main>
    </div>
  )
}
