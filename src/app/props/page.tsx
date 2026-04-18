import { supabase } from "@/lib/supabase";

export default async function PropsPage() {
  const { data: props, error } = await supabase
    .from("props")
    .select("*")
    .order("edge", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-4xl font-bold">NBA Props</h1>
          <p className="mt-4 text-red-600">Error loading props: {error.message}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10 text-zinc-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">NBA Props</h1>
          <p className="mt-2 text-zinc-600">
            Live HoopEdge prop board preview.
          </p>
        </div>

        <div className="mt-8 overflow-x-auto rounded-2xl border bg-white shadow-sm">
          <table className="min-w-full text-left">
            <thead className="border-b bg-zinc-100 text-sm uppercase tracking-wide text-zinc-600">
              <tr>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3">Opponent</th>
                <th className="px-4 py-3">Prop</th>
                <th className="px-4 py-3">Line</th>
                <th className="px-4 py-3">Projection</th>
                <th className="px-4 py-3">Edge</th>
              </tr>
            </thead>
            <tbody>
              {props?.map((p: any) => (
                <tr key={p.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{p.player_name}</td>
                  <td className="px-4 py-3">{p.team}</td>
                  <td className="px-4 py-3">{p.opponent}</td>
                  <td className="px-4 py-3">{p.prop_type}</td>
                  <td className="px-4 py-3">{p.line}</td>
                  <td className="px-4 py-3">{p.projection}</td>
                  <td className="px-4 py-3">{p.edge}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}