import { useEffect, useState } from "react";

/** Whether the page's tab is hidden (document.visibilityState), kept current. */
export function usePageHidden(): boolean {
  const [pageHidden, setPageHidden] = useState(false);
  useEffect(() => {
    const update = () => setPageHidden(document.visibilityState === "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return pageHidden;
}
