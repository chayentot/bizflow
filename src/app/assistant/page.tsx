import { Shell } from '@/components/shell';
import { getWorkspace } from '@/lib/workspace';
import { AssistantChat } from '@/components/assistant-chat';

export default async function AssistantPage() {
  const workspace = await getWorkspace();
  return (
    <Shell company={workspace.companyName}>
      <div>
        <p className="text-sm font-bold uppercase tracking-[.18em] text-slate-500">Business intelligence</p>
        <h1 className="mt-1 text-3xl font-black">AI Assistant</h1>
        <p className="mt-1 max-w-2xl text-slate-600">Ask questions about your customers, invoices, finances, inventory, tasks, and employees.</p>
      </div>
      <AssistantChat />
    </Shell>
  );
}
