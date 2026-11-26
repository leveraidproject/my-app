"use client";

import { useEffect, useMemo, useState } from "react";
import { seedSongs } from "./songs";

type Song = {
  id: string;
  title: string;
  artist: string;
  youtube: string;
  onedrive: string;
  date: string;
  count?: number;
};

type Form = Omit<Song, "id">;

const STORAGE_KEY = "music-library-v2";
const emptyForm: Form = { title: "", artist: "", youtube: "", onedrive: "", date: "" };

function fixUrl(url: string) {
  const u = url.trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function formatDate(date: string) {
  if (!date) return "No date";
  const d = new Date(date + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function MusicLibrary() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) setSongs(JSON.parse(saved));
      else setSongs(seedSongs.map((s) => ({ id: crypto.randomUUID(), ...s })));
    } catch {
      setSongs(seedSongs.map((s) => ({ id: crypto.randomUUID(), ...s })));
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
    } catch {}
  }, [songs, loaded]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? songs.filter((s) =>
          [s.title, s.artist, s.date].some((v) => v.toLowerCase().includes(q))
        )
      : songs;
    return [...list].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [songs, query]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(song: Song) {
    setEditingId(song.id);
    setForm({
      title: song.title,
      artist: song.artist,
      youtube: song.youtube,
      onedrive: song.onedrive,
      date: song.date,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const clean: Form = {
      title: form.title.trim(),
      artist: form.artist.trim(),
      youtube: fixUrl(form.youtube),
      onedrive: fixUrl(form.onedrive),
      date: form.date,
    };
    if (!clean.title || !clean.artist) return;
    if (editingId) {
      setSongs((prev) => prev.map((s) => (s.id === editingId ? { ...s, ...clean } : s)));
    } else {
      setSongs((prev) => [{ id: crypto.randomUUID(), ...clean }, ...prev]);
    }
    closeForm();
  }

  function remove(song: Song) {
    if (confirm(`Delete "${song.title}" by ${song.artist}?`)) {
      setSongs((prev) => prev.filter((s) => s.id !== song.id));
    }
  }

  const input =
    "w-full rounded-md border border-[#c9cde4] bg-white px-3 py-2 text-[15px] text-[#1c2140] outline-none focus:border-[#3d41c9] focus:ring-2 focus:ring-[#3d41c9]/25";

  return (
    <div className="min-h-screen bg-[#eef0f8] text-[#1c2140]">
      <header className="bg-[#1c2140] px-5 pb-10 pt-10 text-white sm:px-10">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Music Library</h1>
          <p className="mt-2 max-w-xl text-[#b9bee3]">
            Every song we have sung or posted, with the video and the files in one place.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by song, singer or band, or date"
              aria-label="Search the library"
              className="w-full rounded-md border border-transparent bg-white px-4 py-3 text-[16px] text-[#1c2140] outline-none focus:ring-2 focus:ring-[#8f93f0]"
            />
            <button
              onClick={openAdd}
              className="shrink-0 rounded-md bg-[#f2b84b] px-5 py-3 font-semibold text-[#1c2140] hover:bg-[#f7c765] focus:outline-none focus:ring-2 focus:ring-white"
            >
              Add song
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8 sm:px-10">
        {showForm && (
          <form
            onSubmit={save}
            className="mb-8 rounded-lg border border-[#c9cde4] bg-[#f8f9fd] p-5"
          >
            <h2 className="mb-4 text-xl font-semibold">
              {editingId ? "Edit song" : "Add a song"}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Song
                <input
                  required
                  className={`${input} mt-1`}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium">
                Singer or band
                <input
                  required
                  className={`${input} mt-1`}
                  value={form.artist}
                  onChange={(e) => setForm({ ...form, artist: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium">
                YouTube link
                <input
                  className={`${input} mt-1`}
                  placeholder="youtube.com/watch?v=..."
                  value={form.youtube}
                  onChange={(e) => setForm({ ...form, youtube: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium">
                OneDrive or Google Drive link
                <input
                  className={`${input} mt-1`}
                  placeholder="1drv.ms/... or drive.google.com/..."
                  value={form.onedrive}
                  onChange={(e) => setForm({ ...form, onedrive: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium">
                Date sung or posted
                <input
                  type="date"
                  className={`${input} mt-1`}
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="submit"
                className="rounded-md bg-[#3d41c9] px-5 py-2 font-semibold text-white hover:bg-[#3236b0] focus:outline-none focus:ring-2 focus:ring-[#3d41c9]/40"
              >
                {editingId ? "Save changes" : "Save song"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-[#c9cde4] bg-white px-5 py-2 font-medium hover:bg-[#eef0f8]"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <p className="mb-3 text-sm text-[#5a6089]">
          {songs.length === 0
            ? ""
            : query
            ? `${results.length} of ${songs.length} songs match`
            : `${songs.length} ${songs.length === 1 ? "song" : "songs"}, newest first`}
        </p>

        {loaded && songs.length === 0 && (
          <div className="rounded-lg border border-dashed border-[#a9aed4] p-10 text-center">
            <p className="text-lg font-medium">Your library is empty.</p>
            <p className="mt-1 text-[#5a6089]">Add your first song to start the list.</p>
            <button
              onClick={openAdd}
              className="mt-4 rounded-md bg-[#3d41c9] px-5 py-2 font-semibold text-white hover:bg-[#3236b0]"
            >
              Add song
            </button>
          </div>
        )}

        {songs.length > 0 && results.length === 0 && (
          <p className="rounded-lg border border-[#c9cde4] bg-white p-6 text-center">
            No songs match &ldquo;{query}&rdquo;. Try a different title, singer or date.
          </p>
        )}

        <ul className="divide-y divide-[#d4d7ea] overflow-hidden rounded-lg border border-[#c9cde4] bg-white">
          {results.map((song) => (
            <li
              key={song.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{song.title}</p>
                <p className="truncate text-[#5a6089]">
                  {song.artist} &nbsp;|&nbsp; {formatDate(song.date)}
                  {song.count && song.count > 1 ? ` | sung ${song.count} times` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {song.youtube && (
                  <a
                    href={song.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-[#d8322f] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#bd2624]"
                  >
                    YouTube
                  </a>
                )}
                {song.onedrive && (
                  <a
                    href={song.onedrive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-[#1a6fd1] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#1559a8]"
                  >
                    {song.onedrive.includes("google") ? "Drive" : "OneDrive"}
                  </a>
                )}
                <button
                  onClick={() => openEdit(song)}
                  className="rounded-md border border-[#c9cde4] px-3 py-1.5 text-sm font-medium hover:bg-[#eef0f8]"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(song)}
                  className="rounded-md border border-[#c9cde4] px-3 py-1.5 text-sm font-medium text-[#a32422] hover:bg-[#fbeaea]"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
