export default function Loading() {
  return <main className="min-h-screen bg-slate-50 p-5 md:p-8"><div className="mx-auto max-w-6xl animate-pulse space-y-6"><div className="h-9 w-52 rounded-lg bg-slate-200"/><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-28 rounded-2xl bg-slate-200"/>)}</div><div className="h-80 rounded-2xl bg-slate-200"/></div></main>;
}
