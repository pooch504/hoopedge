"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SavedPick = {
  id: number;
  created_at?: string;
  player: string;
  line: number;
  book: string;
  ev: number;
};

type SortMode = "newest" | "strongest" | "player";

export default function SavedPage() {
  const [picks, setPicks] = useState<SavedPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortMode>("newest");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    fetchPicks();
  }, []);

  async function fetchPicks() {
    setLoading(true);

    const { data, error } = await supabase
      .from("saved_picks")
      .select("id, created_at, player, line, book, ev")
      .order("id", { ascending: false });

    if (error) {
      alert(`Load failed: ${error.message}`);
      setLoading(false);
      return;
    }

    setPicks((data as SavedPick[]) || []);
    setLoading(false);
  }

  async function deletePick(id: number) {
    setDeletingId(id);

    const previous = picks;
    setPicks((prev) => prev.filter((pick) => pick.id !== id));

    const { error } = await supabase.from("saved_picks").delete().eq("id", id);

    if (error) {
      setPicks(previous);
      alert(`Delete failed: ${error.message}`);
    }

    setDeletingId(null);
  }

  const getDirection = (ev: number) => {
    if (ev > 0) return "Over Signal";
    if (ev < 0) return "Under Lean";
    return "Neutral";
  };

  const getLabel = (ev: number) => {
    if (ev >= 10) return "Strong Signal";
    if (ev >= 5) return "Positive Signal";
    if (ev >= 2) return "Watchlist";
    if (ev < 0) return "Market Inflation";
    return "Thin Signal";
  };

  const getColor = (ev: number) => {
    if (ev >= 10) return "text-green-400";
    if (ev >= 5) return "text-yellow-400";
    if (ev >= 2) return "text-blue-400";
    if (ev < 0) return "text-red-400";
    return "text-zinc-400";
  };

  const getBadge = (ev: number) => {
    if (ev > 0) return "border-green-500/40 bg-green-500/15 text-green-300";
    if (ev < 0) return "border-red-500/40 bg-red-500/15 text-red-300";
    return "border-zinc-700 bg-zinc-800 text-zinc-300";
  };

  const formatDate = (date?: string) => {
    if (!date) return "Recently";

    return new Date(date).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const filteredPicks = useMemo(() => {
    const filtered = picks.filter((pick) =>
      pick.player.toLowerCase().includes(search.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === "strongest") return b.ev - a.ev;
      if (sortBy === "player") return a.player.localeCompare(b.player);
      return b.id - a.id;
    });
  }, [picks, search, sortBy]);

  const strongCount = picks.filter((pick) => pick.ev >= 10).length;
  const positiveCount = picks.filter((pick) => pick.ev >= 5 && pick.ev < 10).length;
  const watchCount = picks.filter((pick) => pick.ev >= 0 && pick.ev < 5).length;
  const underCount = picks.filter((pick) => pick.ev < 0).length;

  const averageEV =
    picks.length > 0
      ? picks.reduce((total, pick) => total + Number(pick.ev), 0) / picks.length
      : 0;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">Signal Notebook</h1>

          <p className="mt-2 text-zinc-400">
            Saved projection signals from your model.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/props"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Back to Props
          </Link>

          <button
            onClick={fetchPicks}
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700"
          >
            Refresh
          </button>
        </div>
      </div>

      <section className="mb-8 grid gap-5 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Total Saved</p>
          <p className="mt-2 text-3xl font-bold">{picks.length}</p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Average EV</p>
          <p className={`mt-2 text-3xl font-bold ${getColor(averageEV)}`}>
            {averageEV > 0 ? "+" : ""}
            {averageEV.toFixed(1)}%
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Strong / Positive</p>
          <p className="mt-2 text-3xl font-bold text-green-400">
            {strongCount + positiveCount}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-400">Watchlist / Under</p>
          <p className="mt-2 text-3xl font-bold text-blue-400">
            {watchCount + underCount}
          </p>
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <input
            type="text"
            placeholder="Search saved player..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-white outline-none placeholder:text-zinc-500 focus:border-green-500"
          />

          <div className="flex flex-wrap gap-3 md:justify-end">
            {[
              ["newest", "Newest"],
              ["strongest", "Strongest EV"],
              ["player", "Player A-Z"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSortBy(value as SortMode)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  sortBy === value
                    ? "bg-green-500 text-black"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
          Loading notebook...
        </div>
      )}

      {!loading && picks.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-xl font-bold">No saved signals yet</p>
          <p className="mt-2 text-zinc-400">
            Save a signal from the Props or Game page.
          </p>
        </div>
      )}

      {!loading && picks.length > 0 && filteredPicks.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <p className="text-xl font-bold">No matching signals</p>
          <p className="mt-2 text-zinc-400">
            Try another player search.
          </p>
        </div>
      )}

      {!loading && filteredPicks.length > 0 && (
        <div className="grid gap-5 md:grid-cols-3">
          {filteredPicks.map((pick) => (
            <div
              key={pick.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xl font-bold">{pick.player}</p>

                  <p className="mt-1 text-sm text-zinc-400">
                    Line {pick.line}
                  </p>

                  <p className="mt-1 text-xs text-zinc-500">{pick.book}</p>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${getBadge(
                    pick.ev
                  )}`}
                >
                  {getDirection(pick.ev)}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-zinc-500">Saved EV</p>
                  <p className={`font-bold ${getColor(pick.ev)}`}>
                    {pick.ev > 0 ? "+" : ""}
                    {Number(pick.ev).toFixed(1)}%
                  </p>
                </div>

                <div>
                  <p className="text-zinc-500">Signal Tier</p>
                  <p className="font-semibold text-zinc-300">
                    {getLabel(pick.ev)}
                  </p>
                </div>

                <div>
                  <p className="text-zinc-500">Saved</p>
                  <p className="font-semibold text-zinc-300">
                    {formatDate(pick.created_at)}
                  </p>
                </div>

                <div>
                  <p className="text-zinc-500">Source</p>
                  <p className="font-semibold text-zinc-300">Model Notebook</p>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-xs leading-5 text-zinc-400">
                  {pick.ev < 0
                    ? "Notebook note: negative model EV may indicate the listed side is inflated."
                    : "Notebook note: positive model EV indicates the projection is above implied expectation."}
                </p>
              </div>

              <button
                onClick={() => deletePick(pick.id)}
                disabled={deletingId === pick.id}
                className="mt-4 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-60"
              >
                {deletingId === pick.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}