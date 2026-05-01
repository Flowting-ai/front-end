"use client";

// ── KDS Components ─────────────────────────────────────────────────────────────
// Imported directly from design-system source during development.
// Replace with `@kaya/design-system` package imports before production.

export {
  Sidebar,
  SidebarProvider,
  useSidebar,
} from "../../../../design-system/src/components/Sidebar";
export type {
  SidebarProps,
  SidebarProject,
  SidebarContextValue,
  SidebarProviderProps,
} from "../../../../design-system/src/components/Sidebar";

export { SidebarInset } from "../../../../design-system/src/components/SidebarInset";

export {
  SidebarMenuItem,
} from "@/components/SidebarMenuItem";
export type {
  SidebarMenuItemProps,
  SidebarMenuItemVariant,
} from "@/components/SidebarMenuItem";

export { SidebarProjectsSection } from "@/components/SidebarProjectsSection";

export { SidebarMenuSkeleton } from "../../../../design-system/src/components/SidebarMenuSkeleton";

export * from "../../../../design-system/src/components/Button";

export * from "../../../../design-system/src/components/Badge";

// ── Radix Primitives ──────────────────────────────────────────────────────────
// Re-exported for use throughout the app without direct Radix imports.

export * as Dialog from "@radix-ui/react-dialog";
export * as DropdownMenu from "@radix-ui/react-dropdown-menu";
export * as ScrollArea from "@radix-ui/react-scroll-area";
export * as Tooltip from "@radix-ui/react-tooltip";
