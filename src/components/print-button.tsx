"use client";
export function PrintButton(){return <button type="button" onClick={()=>window.print()} className="btn btn-secondary print:hidden">Print invoice</button>}
