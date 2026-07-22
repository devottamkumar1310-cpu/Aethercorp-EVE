import {
  LayoutDashboard,
  Package,
  Brain,
  Users,
  Briefcase,
  FileText,
  Activity,
  Settings,
  HelpCircle,
  CheckSquare,
  Sparkles,
  DollarSign
} from "lucide-react";

export const NAV_ITEMS = [
  {
    label: "Business Intelligence",
    items: [
      { href: "/dashboard/inventory", label: "Inventory Intelligence", icon: Package },
      { href: "/dashboard/documents", label: "Company Documents", icon: FileText },
      { href: "/dashboard/traceability", label: "Decision Audit Trail", icon: Sparkles },
      { href: "/dashboard/eve", label: "EVE AI CEO", icon: Brain, isAI: true },
    ],
  },
  {
    label: "Operations & Execution",
    items: [
      { href: "/dashboard", label: "Operations Overview", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/finance", label: "Financial Intelligence", icon: DollarSign },
      { href: "/dashboard/clients", label: "Client Portfolio", icon: Users },
      { href: "/dashboard/projects", label: "Active Projects", icon: Briefcase },
      { href: "/dashboard/tasks", label: "Task Execution", icon: CheckSquare },
      { href: "/dashboard/activity", label: "Business Activity Log", icon: Activity },
    ],
  },
  {
    label: "Platform & Support",
    items: [
      { href: "/dashboard/settings", label: "Workspace Settings", icon: Settings },
      { href: "/dashboard/help", label: "Help & Guidance", icon: HelpCircle },
    ],
  },
];
