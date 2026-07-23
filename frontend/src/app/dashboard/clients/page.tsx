"use client";
import { logger } from "@/lib/logger";

import { useEffect, useState } from "react";
import { fetchClients, deleteClientAPI } from "@/services/businessService";
import { Client } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { ClientModal } from "@/components/business/ClientModal";
import { toast } from "sonner";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionToken, setSessionToken] = useState<string>("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const loadData = async (token: string) => {
    try {
      const data = await fetchClients(token);
      setClients(data);
    } catch (err) {
      logger.error(err);
    }
  };

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionToken(session.access_token);
          await loadData(session.access_token);
        }
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleCreate = () => {
    setSelectedClient(null);
    setIsModalOpen(true);
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this client? This will delete all associated projects and tasks.")) return;
    try {
      await deleteClientAPI(sessionToken, id);
      toast.success("Client deleted successfully");
      loadData(sessionToken);
    } catch {
      toast.error("Client record is currently syncing. Please try again.");
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-8 transition-colors duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">Wholesale accounts, retail partners and D2C stockists.</p>
        </div>
        <button onClick={handleCreate} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors cursor-pointer text-sm font-medium">
          <Plus size={17}/> New Client
        </button>
      </div>
      
      {loading ? (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden animate-pulse">
          <div className="overflow-x-auto w-full scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Company Name</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Industry</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Joined</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...Array(4)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-2/3" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-1/3" /></td>
                    <td className="px-6 py-4"><div className="h-6 bg-muted rounded-full w-12" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-muted rounded w-1/4" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-muted rounded w-8 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto w-full scrollbar-thin">
            <table className="w-full text-left text-sm">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Company Name</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Account Type</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground">Joined</th>
                  <th className="px-6 py-3 font-medium text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map(c => (
                  <tr key={c.id} className="hover:bg-muted/40 group">
                    <td className="px-6 py-4 font-medium text-primary">{c.company_name}</td>
                    <td className="px-6 py-4 text-muted-foreground">{c.industry || 'D2C Retail Account'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-muted text-foreground'}`}>{c.status}</span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(c)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 text-muted-foreground hover:text-rose-500 transition-colors ml-2 cursor-pointer" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No clients found. Click "New Client" to get started.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ClientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        token={sessionToken} 
        client={selectedClient} 
        onSuccess={() => loadData(sessionToken)} 
      />
    </div>
  );
}
