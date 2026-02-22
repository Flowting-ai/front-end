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

  const isPreview = workflowId === "preview";
  const mockWorkflow: WorkflowDTO | null = isPreview
    ? { name: "Preview Workflow", nodes: [], edges: [] }
    : null;

  React.useEffect(() => {
    if (!workflowId) {
      setLoading(false);
      setError("Missing workflow ID");
      return;
    }
    if (isPreview) {
      setWorkflow(mockWorkflow);
      setLoading(false);
      setError(null);
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

  if (!isPreview && (error || !workflow)) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center min-h-[200px] text-red-600">
          {error || "Workflow not found"}
        </div>
      </AppLayout>
    );
  }

  const workflowToShow = workflow ?? mockWorkflow;
  if (!workflowToShow) return null;

  return (
    <AppLayout>
      <WorkflowChatFullPage
        workflowId={isPreview ? "preview" : workflowId}
        workflow={workflowToShow}
        onEditWorkflow={() => router.push(isPreview ? "/workflows" : `/workflows?id=${workflowId}`)}
      />
    </AppLayout>
  );
}
