
        import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-50 text-black p-8">
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">HoopEdge</h1>
          <Link
            href="/props"
            className="rounded-xl bg-black text-white px-4 py-2"
          >
            View Props
          </Link>
        </div>

        {/* Hero Section */}
        <div className="mt-16">
          <h2 className="text-5xl font-bold leading-tight">
            Find the Best NBA Edges.
          </h2>
          <p className="mt-4 text-lg text-zinc-600 max-w-xl">
            HoopEdge gives you daily NBA player prop projections and identifies
            where the data beats the sportsbook line.
          </p>
        </div>

        {/* Placeholder Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">

          <div className="p-6 bg-white rounded-2xl border">
            <h3 className="font-semibold text-lg">Game Projections</h3>
            <p className="text-sm text-zinc-500 mt-2">
              See projected scores, pace, and totals for every game.
            </p>
          </div>

          <div className="p-6 bg-white rounded-2xl border">
            <h3 className="font-semibold text-lg">Prop Edges</h3>
            <p className="text-sm text-zinc-500 mt-2">
              Find where player projections beat sportsbook lines.
            </p>
          </div>

          <div className="p-6 bg-white rounded-2xl border">
            <h3 className="font-semibold text-lg">Daily Updates</h3>
            <p className="text-sm text-zinc-500 mt-2">
              Automatically updated data before every slate.
            </p>
          </div>

        </div>

      </div>
    </main>
  );
}