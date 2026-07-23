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
      { href: "/dashboard/documents", label: "Document Hub", icon: FileText },
      { href: "/dashboard/traceability", label: "Decision Traceability", icon: Sparkles },
      { href: "/dashboard/eve", label: "EVE AI CEO", icon: Brain, isAI: true },
    ],
  },
  {
    label: "Operations & Execution",
    items: [
      { href: "/dashboard", label: "Operations Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/finance", label: "Financial Intelligence", icon: DollarSign },
      { href: "/dashboard/clients", label: "Clients", icon: Users },
      { href: "/dashboard/projects", label: "Active Projects", icon: Briefcase },
      { href: "/dashboard/tasks", label: "Task Execution", icon: CheckSquare },
      { href: "/dashboard/activity", label: "Business Activity Log", icon: Activity },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
      { href: "/dashboard/help", label: "Help", icon: HelpCircle },
    ],
  },
];
