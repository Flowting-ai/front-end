"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import AppLayout from "@/components/layout/app-layout";
import { WorkflowChatFullPage } from "@/components/workflows/WorkflowChatFullPage";
import { workflowAPI } from "@/components/workflows/workflow-api";
import type { WorkflowDTO } from "@/components/workflows/types";

export default function WorkflowChatPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params?.workflowId as string | undefined;
  const [workflow, setWorkflow] = React.useState<WorkflowDTO | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!workflowId) {
      setLoading(false);
      setError("Missing workflow ID");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    workflowAPI
      .get(workflowId)
      .then((data) => {
        if (!cancelled) {
          setWorkflow(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.message || "Failed to load workflow");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  if (!workflowId) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[200px] text-[#666666]">
          Missing workflow ID
        </div>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[200px] text-[#666666]">
          Loading workflow...
        </div>
      </AppLayout>
    );
  }

  if (error || !workflow) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[200px] text-red-600">
          {error || "Workflow not found"}
        </div>
      </AppLayout>
    );
  }

  // Check if workflow is paused (not active)
  if (!workflow.isActive) {
    return (
      <AppLayout>
        <div className="p-8 flex flex-col items-center justify-center min-h-[200px] gap-4">
          <div className="text-[#666666] text-lg">
            This workflow is currently paused
          </div>
          <div className="text-[#999999] text-sm">
            Please activate the workflow from the Workflow Admin page to use the chat interface
          </div>
          <button
            onClick={() => router.push("/workflowAdmin")}
            className="mt-4 px-4 py-2 bg-[#111827] text-white rounded-md hover:bg-[#1f2937]"
          >
            Go to Workflow Admin
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <WorkflowChatFullPage
        workflowId={workflowId}
        workflow={workflow}
        onEditWorkflow={() => router.push(`/workflows?id=${workflowId}`)}
      />
    </AppLayout>
  );
}
