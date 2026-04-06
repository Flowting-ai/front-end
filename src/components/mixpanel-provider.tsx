"use client";

import { useEffect } from "react";
import mixpanel from "mixpanel-browser";

export function MixpanelProvider() {
  useEffect(() => {
    mixpanel.init("2ebf04b18b9c58dddc248496b8ed2a84", {
      autocapture: true,
      record_sessions_percent: 100,
    });
  }, []);

  return null;
}
