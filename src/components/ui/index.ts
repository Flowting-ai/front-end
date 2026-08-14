"use client";

// ── KDS Components ─────────────────────────────────────────────────────────────
// Imported directly from design-system source during development.
// Replace with `@kaya/design-system` package imports before production.

export {
  Sidebar,
  SidebarProvider,
  useSidebar,
} from "@/components/Sidebar";
export type {
  SidebarProps,
  SidebarProject,
  SidebarContextValue,
  SidebarProviderProps,
} from "@/components/Sidebar";

export { SidebarInset } from "@/components/SidebarInset";

export {
  SidebarMenuItem,
} from "@/components/SidebarMenuItem";
export type {
  SidebarMenuItemProps,
  SidebarMenuItemVariant,
} from "@/components/SidebarMenuItem";

export { SidebarProjectsSection } from "@/components/SidebarProjectsSection";

export { SidebarMenuSkeleton } from "@/components/SidebarMenuSkeleton";

// ── Flat sidebar (Souvenir V1.5) ──────────────────────────────────────────────
// New, separate primitives — the old Sidebar/SidebarMenuItem/SidebarProjectsSection
// above are left untouched and keep serving Brain/Admin/team-settings pages.
export { FlatSidebar } from "@/components/FlatSidebar";
export type { FlatSidebarProps } from "@/components/FlatSidebar";
export { FlatSidebarRow } from "@/components/FlatSidebarRow";
export type { FlatSidebarRowProps, FlatSidebarRowVariant } from "@/components/FlatSidebarRow";
export { FlatSidebarProjectGroup } from "@/components/FlatSidebarProjectGroup";
export type { FlatSidebarProjectGroupProps } from "@/components/FlatSidebarProjectGroup";
export { FlatSidebarSlackConnector } from "@/components/FlatSidebarSlackConnector";
export { FlatSidebarProfileRow } from "@/components/FlatSidebarProfileRow";

export * from "@/components/Button";

export * from "@/components/Badge";

// ── Radix Primitives ──────────────────────────────────────────────────────────
// Re-exported for use throughout the app without direct Radix imports.

export * as Dialog from "@radix-ui/react-dialog";
export * as DropdownMenu from "@radix-ui/react-dropdown-menu";
export * as ScrollArea from "@radix-ui/react-scroll-area";
export * as Tooltip from "@radix-ui/react-tooltip";
