
"use client";

import AppLayout from "@/components/layout/app-layout";
import { ModelBenchmark } from "@/components/dashboard/model-benchmark";
import { PerformanceCharts } from "@/components/dashboard/performance-charts";
import type { Dispatch, SetStateAction } from "react";

interface DashboardPageProps {
    isRightSidebarVisible?: boolean;
    setIsRightSidebarVisible?: Dispatch<SetStateAction<boolean>>;
}

function DashboardPageContent({ isRightSidebarVisible, setIsRightSidebarVisible }: DashboardPageProps) {
  return (
    <div className="flex flex-col h-full flex-1">
      <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-8 overflow-y-auto">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p>Dashboard content goes here. The current view is a placeholder.</p>
          <PerformanceCharts />
          <ModelBenchmark />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AppLayout>
      <DashboardPageContent />
    </AppLayout>
  );
}
