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
    label: "Inventory & Analysis",
    items: [
      { href: "/dashboard/inventory", label: "Inventory Intelligence", icon: Package },
      { href: "/dashboard/documents", label: "Document Intelligence", icon: FileText },
      { href: "/dashboard/traceability", label: "Decision Traceability", icon: Sparkles },
      { href: "/dashboard/eve", label: "AI Assistant", icon: Brain, isAI: true },
    ],
  },
  {
    label: "Operations & Finance",
    items: [
      { href: "/dashboard", label: "Operations Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/finance", label: "Finance", icon: DollarSign },
      { href: "/dashboard/clients", label: "Clients", icon: Users },
      { href: "/dashboard/projects", label: "Projects", icon: Briefcase },
      { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
      { href: "/dashboard/activity", label: "Activity Feed", icon: Activity },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
      { href: "/dashboard/help", label: "Help & Learning", icon: HelpCircle },
    ],
  },
];
