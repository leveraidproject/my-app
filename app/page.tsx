"use client";

import { useEffect, useMemo, useState } from "react";
import { seedSongs } from "./songs";

type Entry = {
  id: string;
  title: string;
  artist: string;
  youtube: string;
  onedrive: string;
  date: string;
  event: string;
  songlead: string[];
  backup: string[];
};
type Line = { title: string; artist: string; youtube: string; onedrive: string };
type FormState = { date: string; event: string; songlead: string[]; backup: string[]; lines: Line[] };

const KEY = "music-library-v3";
const PIN_KEY = "music-library-pin";
const emptyLine: Line = { title: "", artist: "", youtube: "", onedrive: "" };
const emptyForm: FormState = { date: "", event: "", songlead: [], backup: [], lines: [{ ...emptyLine }] };
const SORTS = {
  date: "Date",
  title: "Song title",
  artist: "Singer or band",
  songlead: "Song lead",
  backup: "Backup",
  event: "Event",
} as const;
type SortKey = keyof typeof SORTS;

const uniq = (a: string[]) =>
  Array.from(new Set(a.map((x) => x.trim()).filter(Boolean))).sort((x, y) => x.localeCompare(y));
const fixUrl = (u: string) => (u.trim() ? (/^https?:\/\//i.test(u.trim()) ? u.trim() : `https://${u.trim()}`) : "");
const fmt = (d: string) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "No date";
const sortVal = (e: Entry, k: SortKey) => (k === "songlead" ? e.songlead.join(", ") : k === "backup" ? e.backup.join(", ") : e[k]);
const hasName = (list: string[], q: string) => list.some((n) => n.toLowerCase().includes(q.toLowerCase()));
async function sha(t: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

const inp =
  "w-full rounded-md border border-[#c9cde4] bg-white px-3 py-2 text-[15px] text-[#1c2140] outline-none focus:border-[#3d41c9] focus:ring-2 focus:ring-[#3d41c9]/25";
const btn = "rounded-md border border-[#c9cde4] px-3 py-1.5 text-sm font-medium hover:bg-[#eef0f8]";

function PeopleInput({
  label, value, onChange, options,
}: { label: string; value: string[]; onChange: (v: string[]) => void; options: string[] }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const q = text.trim().toLowerCase();
  const matches = options.filter((o) => !value.includes(o) && (!q || o.toLowerCase().includes(q))).slice(0, 6);
  const canAdd = !!q && !options.some((o) => o.toLowerCase() === q) && !value.some((v) => v.toLowerCase() === q);
  const add = (n: string) => {
    const t = n.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setText("");
  };
  return (
    <div className="relative text-sm font-medium">
      {label}
      <div className="mt-1 flex flex-wrap gap-1 rounded-md border border-[#c9cde4] bg-white p-1.5 focus-within:border-[#3d41c9] focus-within:ring-2 focus-within:ring-[#3d41c9]/25">
        {value.map((v) => (
          <span key={v} className="flex items-center gap-1 rounded bg-[#e1e3f7] px-2 py-0.5">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>
              &times;
            </button>
          </span>
        ))}
        <input
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-[15px] font-normal outline-none"
          value={text}
          placeholder={value.length ? "" : "Type a name"}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (text.trim()) add(e.key === "Enter" ? matches[0] ?? text : text);
            } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
          }}
        />
      </div>
      {open && (matches.length > 0 || canAdd) && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-[#c9cde4] bg-white shadow-lg">
          {matches.map((m) => (
            <li key={m}>
              <button type="button" onMouseDown={() => add(m)} className="block w-full px-3 py-2 text-left font-normal hover:bg-[#eef0f8]">
                {m}
              </button>
            </li>
          ))}
          {canAdd && (
            <li>
              <button type="button" onMouseDown={() => add(text)} className="block w-full px-3 py-2 text-left font-semibold text-[#3d41c9] hover:bg-[#eef0f8]">
                Add new: {text.trim()}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function MusicLibrary() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [desc, setDesc] = useState(true);
  const [limit, setLimit] = useState(100);
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDl, setShowDl] = useState(false);
  const [dl, setDl] = useState({ from: "", to: "", artist: "", songlead: "", backup: "" });
  const [del, setDel] = useState<Entry | null>(null);
  const [pin, setPin] = useState("");
  const [pinMsg, setPinMsg] = useState("");
  const [hasPin, setHasPin] = useState(false);

  useEffect(() => {
    const seed = () => seedSongs.map((s) => ({ id: crypto.randomUUID(), ...s }));
    try {
      const saved = localStorage.getItem(KEY);
      setEntries(saved !== null ? JSON.parse(saved) : seed());
      setHasPin(!!localStorage.getItem(PIN_KEY));
    } catch {
      setEntries(seed());
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(KEY, JSON.stringify(entries)); } catch {}
  }, [entries, loaded]);

  const opts = useMemo(
    () => ({
      people: uniq(entries.flatMap((e) => [...e.songlead, ...e.backup])),
      artists: uniq(entries.map((e) => e.artist)),
      events: uniq(entries.map((e) => e.event)),
      titles: uniq(entries.map((e) => e.title)),
    }),
    [entries]
  );

  const songInfo = useMemo(() => {
    const m = new Map<string, Entry>();
    [...entries].sort((a, b) => a.date.localeCompare(b.date)).forEach((e) => m.set(e.title.toLowerCase(), e));
    return m;
  }, [entries]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? entries.filter((e) =>
          [e.title, e.artist, e.event, e.date, e.songlead.join(" "), e.backup.join(" ")].some((v) => v.toLowerCase().includes(q))
        )
      : entries;
    const dated = list.filter((e) => (!day || e.date === day) && (!month || e.date.startsWith(month)));
    return [...dated].sort((a, b) => {
      const x = sortVal(a, sortKey), y = sortVal(b, sortKey);
      if (!x && y) return 1;
      if (x && !y) return -1;
      return (desc ? -1 : 1) * x.localeCompare(y, undefined, { sensitivity: "base" });
    });
  }, [entries, query, sortKey, desc, day, month]);

  const forDownload = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            (!dl.from || (e.date && e.date >= dl.from)) &&
            (!dl.to || (e.date && e.date <= dl.to)) &&
            (!dl.artist || e.artist.toLowerCase().includes(dl.artist.toLowerCase())) &&
            (!dl.songlead || hasName(e.songlead, dl.songlead)) &&
            (!dl.backup || hasName(e.backup, dl.backup))
        )
        .sort((a, b) => a.date.localeCompare(b.date)),
    [entries, dl]
  );

  function downloadCsv() {
    const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = ["Date", "Event", "Song", "Singer or band", "Song lead", "Backup", "YouTube link", "OneDrive or Drive link"];
    const rows = forDownload.map((e) =>
      [e.date, e.event, e.title, e.artist, e.songlead.join(", "), e.backup.join(", "), e.youtube, e.onedrive].map(cell).join(",")
    );
    const blob = new Blob(["\uFEFF" + [head.map(cell).join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `music-library-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm, lines: [{ ...emptyLine }] });
    setShowForm(true);
  }
  function openEdit(e: Entry) {
    setEditingId(e.id);
    setForm({
      date: e.date, event: e.event, songlead: e.songlead, backup: e.backup,
      lines: [{ title: e.title, artist: e.artist, youtube: e.youtube, onedrive: e.onedrive }],
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function closeForm() { setShowForm(false); setEditingId(null); setForm(emptyForm); }

  function setLine(i: number, patch: Partial<Line>) {
    setForm((f) => {
      const lines = f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l));
      if (patch.title !== undefined) {
        const known = songInfo.get(patch.title.trim().toLowerCase());
        if (known && !lines[i].artist && !lines[i].youtube && !lines[i].onedrive)
          lines[i] = { ...lines[i], artist: known.artist, youtube: known.youtube, onedrive: known.onedrive };
      }
      return { ...f, lines };
    });
  }

  function save(ev: React.FormEvent) {
    ev.preventDefault();
    const lines = form.lines.filter((l) => l.title.trim());
    if (!lines.length) return;
    const make = (l: Line) => ({
      title: l.title.trim(), artist: l.artist.trim(), youtube: fixUrl(l.youtube), onedrive: fixUrl(l.onedrive),
      date: form.date, event: form.event.trim(), songlead: form.songlead, backup: form.backup,
    });
    if (editingId) setEntries((p) => p.map((x) => (x.id === editingId ? { ...x, ...make(lines[0]) } : x)));
    else setEntries((p) => [...lines.map((l) => ({ id: crypto.randomUUID(), ...make(l) })), ...p]);
    closeForm();
  }

  function closeDel() { setDel(null); setPin(""); setPinMsg(""); }
  async function confirmDelete(ev: React.FormEvent) {
    ev.preventDefault();
    if (!del) return;
    if (!hasPin) {
      if (pin.length < 4) return setPinMsg("Use at least 4 characters.");
      try { localStorage.setItem(PIN_KEY, await sha(pin)); } catch {}
      setHasPin(true); setPin(""); setPinMsg("PIN saved. Enter it again to delete this song.");
      return;
    }
    if ((await sha(pin)) === localStorage.getItem(PIN_KEY)) {
      setEntries((p) => p.filter((x) => x.id !== del.id));
      closeDel();
    } else setPinMsg("Wrong PIN. Nothing was deleted.");
    setPin("");
  }

  return (
    <div className="min-h-screen bg-[#eef0f8] text-[#1c2140]">
      <datalist id="dl-artists">{opts.artists.map((o) => <option key={o} value={o} />)}</datalist>
      <datalist id="dl-events">{opts.events.map((o) => <option key={o} value={o} />)}</datalist>
      <datalist id="dl-titles">{opts.titles.map((o) => <option key={o} value={o} />)}</datalist>
      <datalist id="dl-people">{opts.people.map((o) => <option key={o} value={o} />)}</datalist>

      <header className="bg-[#1c2140] px-5 pb-8 pt-10 text-white sm:px-10">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Music Library</h1>
          <p className="mt-2 max-w-xl text-[#b9bee3]">Every song we have sung, with who led it and where to find it.</p>
          <input
            type="search" value={query} aria-label="Search the library"
            onChange={(e) => { setQuery(e.target.value); setLimit(100); }}
            placeholder="Search song, singer or band, song lead, backup, event or date"
            className="mt-6 w-full rounded-md bg-white px-4 py-3 text-[16px] text-[#1c2140] outline-none focus:ring-2 focus:ring-[#8f93f0]"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-[#b9bee3]">
              Sort by
              <select
                value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-md bg-white px-2 py-2 text-[#1c2140]"
              >
                {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <button onClick={() => setDesc(!desc)} className="rounded-md bg-white/15 px-3 py-2 text-sm hover:bg-white/25">
              {sortKey === "date" ? (desc ? "Newest first" : "Oldest first") : desc ? "Z to A" : "A to Z"}
            </button>
            <label className="flex items-center gap-2 text-sm text-[#b9bee3]">
              Date
              <input
                type="date" value={day} aria-label="Show a specific date"
                onChange={(e) => { setDay(e.target.value); setMonth(""); setLimit(100); }}
                className="rounded-md bg-white px-2 py-1.5 text-[#1c2140]"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-[#b9bee3]">
              Month
              <input
                type="month" value={month} aria-label="Show a whole month"
                onChange={(e) => { setMonth(e.target.value); setDay(""); setLimit(100); }}
                className="rounded-md bg-white px-2 py-1.5 text-[#1c2140]"
              />
            </label>
            {(day || month) && (
              <button onClick={() => { setDay(""); setMonth(""); }} className="rounded-md bg-white/15 px-3 py-2 text-sm hover:bg-white/25">
                Clear date
              </button>
            )}
            <span className="flex-1" />
            <button onClick={() => setShowDl(!showDl)} className="rounded-md bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">
              Download
            </button>
            <button onClick={openAdd} className="rounded-md bg-[#f2b84b] px-5 py-2 font-semibold text-[#1c2140] hover:bg-[#f7c765]">
              Add songs
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-10">
        {showDl && (
          <section className="mb-8 rounded-lg border border-[#c9cde4] bg-[#f8f9fd] p-5">
            <h2 className="mb-1 text-xl font-semibold">Download as a spreadsheet</h2>
            <p className="mb-4 text-sm text-[#5a6089]">Leave a box empty to include everything. Opens in Excel.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-medium">From date<input type="date" className={`${inp} mt-1`} value={dl.from} onChange={(e) => setDl({ ...dl, from: e.target.value })} /></label>
              <label className="text-sm font-medium">To date<input type="date" className={`${inp} mt-1`} value={dl.to} onChange={(e) => setDl({ ...dl, to: e.target.value })} /></label>
              <label className="text-sm font-medium">Singer or band<input list="dl-artists" className={`${inp} mt-1`} value={dl.artist} onChange={(e) => setDl({ ...dl, artist: e.target.value })} /></label>
              <label className="text-sm font-medium">Song lead<input list="dl-people" className={`${inp} mt-1`} value={dl.songlead} onChange={(e) => setDl({ ...dl, songlead: e.target.value })} /></label>
              <label className="text-sm font-medium">Backup<input list="dl-people" className={`${inp} mt-1`} value={dl.backup} onChange={(e) => setDl({ ...dl, backup: e.target.value })} /></label>
            </div>
            <div className="mt-5 flex items-center gap-4">
              <button onClick={downloadCsv} disabled={!forDownload.length} className="rounded-md bg-[#3d41c9] px-5 py-2 font-semibold text-white hover:bg-[#3236b0] disabled:opacity-50">
                Download {forDownload.length} {forDownload.length === 1 ? "song" : "songs"}
              </button>
              <button onClick={() => setDl({ from: "", to: "", artist: "", songlead: "", backup: "" })} className={btn}>Clear filters</button>
            </div>
          </section>
        )}

        {showForm && (
          <form onSubmit={save} className="mb-8 rounded-lg border border-[#c9cde4] bg-[#f8f9fd] p-5">
            <h2 className="mb-4 text-xl font-semibold">{editingId ? "Edit song" : "Add songs for a date"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Date sung or posted<input type="date" className={`${inp} mt-1`} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              <label className="text-sm font-medium">Event<input list="dl-events" className={`${inp} mt-1`} value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} /></label>
              <PeopleInput label="Song lead" value={form.songlead} onChange={(v) => setForm({ ...form, songlead: v })} options={opts.people} />
              <PeopleInput label="Backup" value={form.backup} onChange={(v) => setForm({ ...form, backup: v })} options={opts.people} />
            </div>

            <div className="mt-6 space-y-4">
              {form.lines.map((l, i) => (
                <div key={i} className="rounded-md border border-[#d4d7ea] bg-white p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium">Song {form.lines.length > 1 ? i + 1 : ""}<input required={i === 0} list="dl-titles" className={`${inp} mt-1`} value={l.title} onChange={(e) => setLine(i, { title: e.target.value })} /></label>
                    <label className="text-sm font-medium">Singer or band<input list="dl-artists" className={`${inp} mt-1`} value={l.artist} onChange={(e) => setLine(i, { artist: e.target.value })} /></label>
                    <label className="text-sm font-medium">YouTube link<input className={`${inp} mt-1`} value={l.youtube} onChange={(e) => setLine(i, { youtube: e.target.value })} /></label>
                    <label className="text-sm font-medium">OneDrive or Google Drive link<input className={`${inp} mt-1`} value={l.onedrive} onChange={(e) => setLine(i, { onedrive: e.target.value })} /></label>
                  </div>
                  {form.lines.length > 1 && (
                    <button type="button" className={`${btn} mt-3`} onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })}>
                      Remove this song
                    </button>
                  )}
                </div>
              ))}
              {!editingId && (
                <button type="button" className={`${btn} bg-white`} onClick={() => setForm({ ...form, lines: [...form.lines, { ...emptyLine }] })}>
                  Add another song on this date
                </button>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <button type="submit" className="rounded-md bg-[#3d41c9] px-5 py-2 font-semibold text-white hover:bg-[#3236b0]">
                {editingId ? "Save changes" : "Save songs"}
              </button>
              <button type="button" onClick={closeForm} className={`${btn} bg-white px-5 py-2`}>Cancel</button>
            </div>
          </form>
        )}

        <p className="mb-3 text-sm text-[#5a6089]">
          {entries.length ? (query || day || month ? `${results.length} of ${entries.length} entries match` : `${entries.length} entries`) : ""}
        </p>

        {loaded && entries.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#a9aed4] p-10 text-center">
            <p className="text-lg font-medium">Your library is empty.</p>
            <button onClick={openAdd} className="mt-4 rounded-md bg-[#3d41c9] px-5 py-2 font-semibold text-white">Add songs</button>
          </div>
        )}
        {entries.length > 0 && results.length === 0 && (
          <p className="rounded-lg border border-[#c9cde4] bg-white p-6 text-center">No entries match. Try a different word, date or month.</p>
        )}

        <ul className="divide-y divide-[#d4d7ea] overflow-hidden rounded-lg border border-[#c9cde4] bg-white">
          {results.slice(0, limit).map((e) => (
            <li key={e.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{e.title}</p>
                <p className="truncate text-[#5a6089]">
                  {[e.artist, fmt(e.date), e.event].filter(Boolean).join("  |  ")}
                </p>
                {(e.songlead.length > 0 || e.backup.length > 0) && (
                  <p className="truncate text-sm text-[#5a6089]">
                    {e.songlead.length > 0 && <>Lead: {e.songlead.join(", ")}</>}
                    {e.songlead.length > 0 && e.backup.length > 0 && "  |  "}
                    {e.backup.length > 0 && <>Backup: {e.backup.join(", ")}</>}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {e.youtube && <a href={e.youtube} target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#d8322f] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#bd2624]">YouTube</a>}
                {e.onedrive && (
                  <a href={e.onedrive} target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#1a6fd1] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1559a8]">
                    {e.onedrive.includes("google") ? "Drive" : "OneDrive"}
                  </a>
                )}
                <button onClick={() => openEdit(e)} className={btn}>Edit</button>
                <button onClick={() => setDel(e)} className={`${btn} text-[#a32422] hover:bg-[#fbeaea]`}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
        {results.length > limit && (
          <button onClick={() => setLimit(limit + 100)} className={`${btn} mt-4 w-full bg-white py-2`}>
            Show 100 more ({results.length - limit} left)
          </button>
        )}
      </main>

      {del && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#1c2140]/60 p-4" role="dialog" aria-modal="true">
          <form onSubmit={confirmDelete} className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold">{hasPin ? "Enter PIN to delete" : "Create a delete PIN"}</h2>
            <p className="mt-2 text-sm text-[#5a6089]">
              {hasPin
                ? `This will delete "${del.title}" on ${fmt(del.date)}.`
                : "Deleting is protected by a PIN. Choose one now and keep it safe."}
            </p>
            <input
              type="password" autoFocus value={pin} onChange={(e) => setPin(e.target.value)}
              aria-label="PIN" className={`${inp} mt-4`} autoComplete="off"
            />
            {pinMsg && <p className="mt-2 text-sm font-medium text-[#a32422]">{pinMsg}</p>}
            <div className="mt-5 flex gap-3">
              <button type="submit" className="rounded-md bg-[#a32422] px-4 py-2 font-semibold text-white hover:bg-[#861c1a]">
                {hasPin ? "Delete song" : "Save PIN"}
              </button>
              <button type="button" onClick={closeDel} className={`${btn} px-4 py-2`}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
