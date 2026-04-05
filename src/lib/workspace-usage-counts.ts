"use client";

import { workflowAPI } from "@/components/workflows/workflow-api";
import { fetchPersonas } from "@/lib/api/personas";
import { fetchAllPins } from "@/lib/api/pins";
import type { WorkspaceUsageCounts } from "@/lib/plan-downgrade-limits";

export async function fetchWorkspaceUsageCounts(): Promise<WorkspaceUsageCounts> {
  const [personas, pins, workflowList] = await Promise.all([
    fetchPersonas(),
    fetchAllPins(),
    workflowAPI.list(),
  ]);

  return {
    totalPersonaCount: personas.length,
    totalPinCount: pins.length,
    totalWorkflowsCount: workflowList.total,
  };
}
