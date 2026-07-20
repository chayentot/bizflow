import Link from "next/link";
export default function Home() {
  return <main className="min-h-screen grid place-items-center p-6"><section className="max-w-3xl text-center">
    <span className="inline-block rounded-full bg-slate-200 px-3 py-1 text-sm font-bold">Portfolio SaaS Project</span>
    <h1 className="mt-5 text-5xl font-black tracking-tight">Run daily business operations with BizFlow.</h1>
    <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">Manage tasks, customers, income, and expenses in one secure company workspace.</p>
    <div className="mt-8 flex justify-center gap-3"><Link className="btn" href="/signup">Create account</Link><Link className="btn btn-secondary" href="/login">Sign in</Link></div>
  </section></main>;
}
