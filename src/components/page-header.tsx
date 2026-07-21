import Link from "next/link";

export function PageHeader({title,description,actionHref,actionLabel}:{title:string;description:string;actionHref?:string;actionLabel?:string}){
  return <div className="flex flex-wrap items-start justify-between gap-4">
    <div><h1 className="text-3xl font-black">{title}</h1><p className="mt-1 text-slate-600">{description}</p></div>
    {actionHref&&actionLabel?<Link href={actionHref} className="btn shrink-0">+ {actionLabel}</Link>:null}
  </div>;
}

export function EmptyState({title,description,href,label}:{title:string;description:string;href:string;label:string}){
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><h2 className="font-black">{title}</h2><p className="mt-2 text-sm text-slate-500">{description}</p><Link className="btn mt-5 inline-flex" href={href}>+ {label}</Link></div>
}
