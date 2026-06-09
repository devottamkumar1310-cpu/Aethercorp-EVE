export interface Client {
  id: string;
  company_name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  industry?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  client_id: string;
  budget: number;
  status: string;
  start_date?: string;
  deadline?: string;
  completion_percentage: number;
  estimated_hours: number;
  actual_hours: number;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  project_id: string;
  assigned_to?: string;
  priority: string;
  status: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Revenue {
  id: string;
  project_id: string;
  amount: number;
  date?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  date?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface BusinessKPIs {
  clients: number;
  active_clients: number;
  projects: number;
  active_projects: number;
  tasks: number;
  completed_tasks: number;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface DashboardSummary {
  kpis: BusinessKPIs;
  recent_clients: Client[];
  recent_projects: Project[];
  upcoming_deadlines: Project[];
}
