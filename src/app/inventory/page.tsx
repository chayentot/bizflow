import { createProduct, adjustStock, deleteProduct } from "@/app/actions";
import { Shell } from "@/components/shell";
import { getWorkspace } from "@/lib/workspace";

const money = (value:number|string) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(value));

export default async function Inventory({searchParams}:{searchParams:Promise<{error?:string;message?:string}>}) {
  const w = await getWorkspace();
  const q = await searchParams;
  const {data:products} = await w.supabase.from("products").select("id,name,sku,barcode,cost,selling_price,quantity,low_stock_threshold").eq("company_id",w.companyId).order("name");
  const list = products ?? [];
  const totalUnits = list.reduce((sum,p)=>sum+Number(p.quantity),0);
  const inventoryValue = list.reduce((sum,p)=>sum+Number(p.quantity)*Number(p.cost),0);
  const retailValue = list.reduce((sum,p)=>sum+Number(p.quantity)*Number(p.selling_price),0);
  const lowStock = list.filter(p=>Number(p.quantity)<=Number(p.low_stock_threshold));

  return <Shell company={w.companyName}>
    <div><h1 className="text-3xl font-black">Inventory</h1><p className="mt-1 text-slate-600">Track products, stock levels, costs, and selling prices.</p></div>
    {q.error&&<p className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{q.error}</p>}
    {q.message&&<p className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-700">{q.message}</p>}

    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="card"><p className="text-sm text-slate-500">Products</p><p className="mt-2 text-3xl font-black">{list.length}</p></div>
      <div className="card"><p className="text-sm text-slate-500">Units in stock</p><p className="mt-2 text-3xl font-black">{totalUnits}</p></div>
      <div className="card"><p className="text-sm text-slate-500">Inventory cost</p><p className="mt-2 text-3xl font-black">{money(inventoryValue)}</p></div>
      <div className="card"><p className="text-sm text-slate-500">Potential retail value</p><p className="mt-2 text-3xl font-black">{money(retailValue)}</p></div>
    </div>

    {lowStock.length>0&&<section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-black text-amber-900">Low-stock alert</h2><p className="mt-1 text-sm text-amber-800">{lowStock.map(p=>`${p.name} (${p.quantity})`).join(", ")}</p></section>}

    <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
      <form action={createProduct} className="card space-y-4">
        <h2 className="text-xl font-black">Add product</h2>
        <label><span className="label">Product name</span><input name="name" required placeholder="Wireless keyboard"/></label>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">SKU</span><input name="sku" required placeholder="KEY-001"/></label><label><span className="label">Barcode</span><input name="barcode" placeholder="Optional"/></label></div>
        <label><span className="label">Description</span><textarea name="description" rows={2} placeholder="Optional product notes"/></label>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">Cost</span><input name="cost" type="number" min="0" step="0.01" defaultValue="0" required/></label><label><span className="label">Selling price</span><input name="selling_price" type="number" min="0" step="0.01" defaultValue="0" required/></label></div>
        <div className="grid grid-cols-2 gap-3"><label><span className="label">Starting quantity</span><input name="quantity" type="number" min="0" step="1" defaultValue="0" required/></label><label><span className="label">Low-stock level</span><input name="low_stock_threshold" type="number" min="0" step="1" defaultValue="5" required/></label></div>
        <button className="btn w-full">Add product</button>
      </form>

      <section className="card overflow-x-auto p-0"><table className="w-full min-w-[850px] text-left"><thead className="border-b bg-slate-50 text-sm text-slate-600"><tr><th className="p-4">Product</th><th className="p-4">SKU</th><th className="p-4 text-right">Cost</th><th className="p-4 text-right">Price</th><th className="p-4 text-right">Stock</th><th className="p-4">Adjust</th><th className="p-4"></th></tr></thead><tbody>
        {list.length?list.map(p=>{const low=Number(p.quantity)<=Number(p.low_stock_threshold);return <tr key={p.id} className="border-b last:border-0"><td className="p-4 font-bold">{p.name}{p.barcode&&<span className="block text-xs font-normal text-slate-500">{p.barcode}</span>}</td><td className="p-4">{p.sku}</td><td className="p-4 text-right">{money(p.cost)}</td><td className="p-4 text-right">{money(p.selling_price)}</td><td className="p-4 text-right"><span className={low?"rounded-full bg-amber-100 px-2 py-1 font-bold text-amber-800":"font-bold"}>{p.quantity}</span></td><td className="p-4"><form action={adjustStock} className="flex gap-2"><input type="hidden" name="id" value={p.id}/><input className="w-24" name="quantity_change" type="number" step="1" placeholder="+ / -" required/><input className="w-32" name="note" placeholder="Reason"/><button className="rounded-lg border px-3 py-2 text-sm font-bold">Save</button></form></td><td className="p-4"><form action={deleteProduct}><input type="hidden" name="id" value={p.id}/><button className="text-sm font-bold text-red-600">Delete</button></form></td></tr>}):<tr><td className="p-6 text-slate-500" colSpan={7}>No products yet. Add your first item.</td></tr>}
      </tbody></table></section>
    </div>
  </Shell>
}
