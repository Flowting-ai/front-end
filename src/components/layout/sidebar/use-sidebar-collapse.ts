import { useEffect, useRef } from "react";
import { getSessionCollapsed, migrateCollapsedCookie, writeCollapsed } from "./collapse-persistence";

// The sidebar's collapsed preference. FlatSidebar/Sidebar own the live state;
// this only seeds their `defaultCollapsed` and persists each toggle.
export function useSidebarCollapse(defaultCollapsed: boolean) {
  // First mount hydrates from the server's cookie read; a remount later in the
  // session starts from the latest toggle (see sessionCollapsed).
  const collapsedRef = useRef<boolean>(getSessionCollapsed() ?? defaultCollapsed);
  useEffect(() => { migrateCollapsedCookie() }, []);

  const handleCollapse = () => {
    collapsedRef.current = !collapsedRef.current;
    writeCollapsed(collapsedRef.current);
  };

  return { collapsedRef, handleCollapse };
}
