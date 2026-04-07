"use client";

import { useEffect } from "react";
import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

export function MixpanelProvider() {
  useEffect(() => {
    if (!MIXPANEL_TOKEN) return;

    mixpanel.init(MIXPANEL_TOKEN, {
      autocapture: true,
      record_sessions_percent: 100,
    });
  }, []);

  return null;
}
