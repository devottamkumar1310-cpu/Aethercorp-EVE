"use client";

import { useEffect, useState } from "react";
import { fetchClients, deleteClientAPI } from "@/services/businessService";
import { Client } from "@/types/business";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Users, Plus, ArrowLeft, Edit2, Trash2 } from "lucide-react";
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
      console.error(err);
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
    } catch (error: any) {
      toast.error(error.message || "Failed to delete client");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-4 text-slate-500 mb-4">
        <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><ArrowLeft size={16}/> Back to Dashboard</Link>
      </div>
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-2"><Users className="text-blue-600"/> Client Management</h1>
        <button onClick={handleCreate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
          <Plus size={18}/> New Client
        </button>
      </div>
      
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-pulse">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-400">Company Name</th>
                  <th className="px-6 py-3 font-medium text-slate-400">Industry</th>
                  <th className="px-6 py-3 font-medium text-slate-400">Status</th>
                  <th className="px-6 py-3 font-medium text-slate-400">Joined</th>
                  <th className="px-6 py-3 font-medium text-slate-400 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...Array(4)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-2/3" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-1/3" /></td>
                    <td className="px-6 py-4"><div className="h-6 bg-slate-200 rounded-full w-12" /></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-1/4" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 bg-slate-200 rounded w-8 ml-auto" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-medium text-slate-600">Company Name</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Industry</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Status</th>
                  <th className="px-6 py-3 font-medium text-slate-600">Joined</th>
                  <th className="px-6 py-3 font-medium text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 group">
                    <td className="px-6 py-4 font-medium text-slate-800">{c.company_name}</td>
                    <td className="px-6 py-4 text-slate-600">{c.industry || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>{c.status}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-right">
                      <button onClick={() => handleEdit(c)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors ml-2" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-500">No clients found. Click "New Client" to get started.</td></tr>
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
