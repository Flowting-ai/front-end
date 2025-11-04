
"use client";

import AppLayout from "@/components/layout/app-layout";
import { Topbar } from "@/components/layout/top-bar";
import { ModelBenchmark } from "@/components/dashboard/model-benchmark";
import { PerformanceCharts } from "@/components/dashboard/performance-charts";

export default function DashboardPage() {
  return (
    // NOTE: AppLayout now injects sidebar state props into its children.
    // This page doesn't use them, but if it did, you would need to accept
    // isRightSidebarVisible and setIsRightSidebarVisible as props.
    <div className="flex flex-col h-full flex-1">
      <Topbar />
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-8 overflow-y-auto">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p>Dashboard content goes here. The current view is a placeholder.</p>
          <PerformanceCharts />
          <ModelBenchmark />
      </div>
    </div>
  );
}
