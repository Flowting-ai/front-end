"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import chatStyles from "@/components/chat/chat-interface.module.css";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatCard } from "@/components/personas/stat-card";
import { CommandCenter, type StatusOption } from "@/components/personas/command-center";
import { WorkflowWrapper, type WorkflowItem } from "@/components/workflows/workflow-wrapper";
import {
  ChartLine,
  TrendingUp,
  Workflow,
  Plus,
  MessageSquareWarning,
  RefreshCw,
  Search,
  Share2,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { workflowAPI } from "@/components/workflows/workflow-api";
import type { WorkflowMetadata } from "@/components/workflows/types";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import userAvatar from "@/avatars/userAvatar.png";
import userAvatar2 from "@/avatars/userAvatar2.png";
import userAvatar3 from "@/avatars/userAvatar3.png";
import Image from "next/image";
import type { Consumer } from "@/components/workflows/workflow-row";
import { useAuth } from "@/context/auth-context";
import { toast } from "@/lib/toast-helper";

const WORKFLOW_STATUS_OPTIONS: StatusOption[] = [
  { value: "all", label: "All Workflows" },
  { value: "active", label: "Active Workflows" },
  { value: "paused", label: "Paused Workflows" },
  // { value: "inactive", label: "Inactive Workflows" },
];

function maskEmail(email: string | null | undefined): string {
  if (!email) return "your@email.com";
  const atIndex = email.indexOf("@");
  if (atIndex <= 3) return email;
  return email.slice(0, 3) + "*".repeat(atIndex - 3) + email.slice(atIndex);
}

export default function WorkflowAdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const normalizePct = (value: number | null | undefined) => {
    if (typeof value !== "number" || Number.isNaN(value)) return 0;
    const pct = value <= 1 ? value * 100 : value;
    return Math.max(0, Math.min(pct, 100));
  };
  const formatDate = (value: string | null | undefined) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };
  const hasFetchedWorkflows = React.useRef(false);
  const [workflows, setWorkflows] = React.useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  // No updatingWorkflowIds needed
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [shareDialog, setShareDialog] = React.useState<{
    open: boolean;
    workflowName: string;
    shareEmail: string;
  }>({
    open: false,
    workflowName: "",
    shareEmail: "",
  });
  const [deleteDialog, setDeleteDialog] = React.useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  // Fetch workflows from backend
  const loadWorkflows = React.useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    try {
      const { workflows: backendWorkflows } = await workflowAPI.list();

      // Transform backend data to match frontend WorkflowItem interface
      const transformedWorkflows: WorkflowItem[] = backendWorkflows.map((wf: WorkflowMetadata, index: number) => ({
        id: wf.id,
        name: wf.name,
        description: wf.description,
        documentFilename: wf.documentFilename ?? null,
        status: wf.isActive ? "active" : "paused",
        creditUsage: 0, // TODO: Backend doesn't provide this yet
        consumers: [],
        consumersCount: 0,
        nodeCount: wf.nodeCount,
        edgeCount: wf.edgeCount,
        lastActivity: formatRelativeTime(wf.updatedAt),
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
        tags: wf.tags,
        version: "v1.0",
        thumbnail: wf.thumbnail || undefined,
      }));

      setWorkflows(transformedWorkflows);
    } catch (error) {
      console.error("Failed to load workflows:", error);
      // Set empty array on error to show empty state
      setWorkflows([]);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch
  React.useEffect(() => {
    if (hasFetchedWorkflows.current) {
      return;
    }
    hasFetchedWorkflows.current = true;
    loadWorkflows();
  }, [loadWorkflows]);

  // Auto-refresh every 30 seconds to stay in sync
  React.useEffect(() => {
    const intervalId = setInterval(() => {
      loadWorkflows(true); // Silent refresh
    }, 30000);

    return () => clearInterval(intervalId);
  }, [loadWorkflows]);

  // Calculate stats
  const totalCredits = React.useMemo(() => {
    return workflows.reduce((sum, w) => sum + w.creditUsage, 0);
  }, [workflows]);

  const activeConsumers = React.useMemo(() => {
    return workflows.reduce(
      (sum, w) => sum + w.consumers.filter((c) => c.status === "active").length,
      0
    );
  }, [workflows]);

  // Filter workflows
  const filteredWorkflows = React.useMemo(() => {
    if (statusFilter === "all") return workflows;
    return workflows.filter((w) => w.status === statusFilter);
  }, [workflows, statusFilter]);

  const handlePauseWorkflow = async (workflowId: string) => {
    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    // Calculate new frontend status
    const newFrontendStatus: "active" | "paused" =
      workflow.status === "active" ? "paused" : "active";

    // Optimistically update UI
    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === workflowId ? { ...w, status: newFrontendStatus } : w
      )
    );

    // Persist to backend
    try {
      const result = await workflowAPI.togglePause(workflowId);
      const resolvedStatus: "active" | "paused" =
        result.is_active ? "active" : "paused";
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === workflowId ? { ...w, status: resolvedStatus } : w
        )
      );
      if (resolvedStatus === "active") {
        toast("Workflow Resumed", {
          description: `"${workflow.name}" is now active again.`,
        });
      } else {
        toast("Workflow Paused", {
          description: `"${workflow.name}" has been paused. This may affect any processes using this workflow.`,
        });
      }
    } catch (error) {
      console.error("Failed to update workflow status:", error);
      toast.error("Failed to update status", {
        description: "Could not update workflow status. Please try again.",
      });
      // Revert optimistic update on error
      setWorkflows((prev) =>
        prev.map((w) =>
          w.id === workflowId ? { ...w, status: workflow.status } : w
        )
      );
    }
  };

  const handleDeleteWorkflow = (workflowId: string) => {
    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    setDeleteDialog({
      open: true,
      title: "Delete Workflow",
      description: `Are you sure you want to delete "${workflow.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await workflowAPI.delete(workflowId);
          setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
          setDeleteDialog({ ...deleteDialog, open: false });
        } catch (error) {
          console.error("Failed to delete workflow:", error);
          setDeleteDialog({ ...deleteDialog, open: false });
        }
      },
    });
  };

  const handleEditWorkflow = (workflowId: string) => {
    router.push(`/workflows?id=${workflowId}`);
  };

  const handleViewWorkflow = (workflowId: string) => {
    router.push(`/workflows?id=${workflowId}`);
  };

  const handleChatWorkflow = (workflowId: string) => {
    // Navigate to dedicated workflow chat page
    router.push(`/workflows/${workflowId}/chat`);
  };


  const handleManualRefresh = () => {
    loadWorkflows(true);
  };
  const handleCreateWorkflow = () => {
    router.push("/workflows");
  };

  return (
    <AppLayout>
      <div
        className={`${chatStyles.customScrollbar} w-full h-full flex items-start justify-center grow-0 overflow-y-auto py-[20px]`}
      >
        <div className="scale-100 max-w-[1040px] mx-auto w-full">
          <div className="w-full flex flex-col gap-6">
            {/* Header */}
            <div className="w-full flex justify-between items-start">
              {/* Left */}
              <div className="flex flex-col">
                <h1 className="font-clash font-normal leading-[140%] text-[24px] text-black">
                  Your Workflows
                </h1>
                <p className="font-geist font-normal leading-[140%] text-[13px] text-black">
                  Manage your workflow automations.
                </p>
              </div>

              {/* Right */}
              <div className="flex items-center gap-3">
                {/* Refresh Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualRefresh}
                  disabled={isRefreshing}
                  className={cn(
                    "h-9 gap-2",
                    isRefreshing && "opacity-70 cursor-not-allowed"
                  )}
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      isRefreshing && "animate-spin"
                    )}
                  />
                  {isRefreshing ? "Syncing..." : "Refresh"}
                </Button>

                {workflows.length === 0 && !isLoading ? (
                  <div className="animate-pulse text-left bg-red-100 border-2 border-dashed border-red-200 rounded-[8px] px-3 py-2 flex items-center gap-4">
                    <MessageSquareWarning size={26} />
                    <div className="flex flex-col">
                      <h1 className="font-inter font-medium leading-[140%] text-base text-black tracking-tight">
                        No Workflows Found
                      </h1>
                      <p className="font-geist font-normal leading-[140%] text-[13px] text-black">
                        Create a workflow to start automating.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="font-inter border border-main-border rounded-[16px] shadow-xl shadow-zinc-100 flex flex-col items-center justify-center gap-8 py-16">
                <div className="text-center flex flex-col items-center gap-3">
                  <h2 className="font-semibold text-[32px] text-[#0A0A0A]">
                    Loading Workflows...
                  </h2>
                  <p className="text-base text-[#4b5563]">
                    Please wait while we fetch your workflows.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="mx-auto w-full">
                  <div className="flex w-full flex-col md:flex-row md:flex-nowrap gap-6 pb-0">
                    {/* Left - Total Credits */}
                    <StatCard
                      title="Credits Usage"
                      value={(user?.creditsRemainingDisplay ?? "0")}
                      suffix="Credits Left"
                      className="relative w-[601px] h-[148px] flex-none p-0!"
                    >
                      <div className="relative flex h-full w-full flex-col">
                        <div className="h-full flex flex-col justify-between mx-[14px] my-[14px]">
                          {/* Top */}
                          <div className="flex justify-between ">
                            {/* Left */}
                            <div className="flex flex-col">
                              <p className="font-inter font-semibold text-base leading-[140%] tracking-tight text-black">
                                Platform Usage
                              </p>
                              <p className="text-xs text-[#737373]">
                                Shared across all features
                              </p>
                            </div>

                            {/* Right */}
                            <div className="flex items-end gap-2">
                              <p className="font-inter font-normal text-[32px] leading-[120%] text-black">
                                {user?.creditsRemainingDisplay ?? "0"}
                              </p>
                              <span className="font-inter font-normal leading-[154%] text-sm text-black">
                                credits left
                              </span>
                            </div>
                          </div>

                          {/* Bottom */}
                          <div className="mt-4 flex flex-col gap-2">
                            {(() => {
                              const byCategory = user?.usage?.by_category;
                              const totalCredits = user?.creditsTotal ?? 0;
                              const usedCredits = user?.creditsUsed ?? 0;

                              // Split total used credits among categories by their ratio
                              const rawChat = byCategory?.chat ?? 0;
                              const rawPersona = byCategory?.persona ?? 0;
                              const rawWorkflow = byCategory?.workflow ?? 0;
                              const rawTotal = rawChat + rawPersona + rawWorkflow;

                              let chatCredits = 0;
                              let personaCredits = 0;
                              let workflowCredits = 0;
                              if (rawTotal > 0) {
                                chatCredits = Math.round((rawChat / rawTotal) * usedCredits);
                                personaCredits = Math.round((rawPersona / rawTotal) * usedCredits);
                                workflowCredits = Math.max(0, usedCredits - chatCredits - personaCredits);
                              }

                              // Bar segment widths as % of total plan credits
                              const seg1 = totalCredits > 0 ? +((chatCredits / totalCredits) * 100).toFixed(2) : 0;
                              const seg2 = totalCredits > 0 ? +((personaCredits / totalCredits) * 100).toFixed(2) : 0;
                              const seg3 = totalCredits > 0 ? +((workflowCredits / totalCredits) * 100).toFixed(2) : 0;

                              return (
                                <>
                                  {/* Row 1 - Progress graph */}
                                  <div className="w-full h-2 rounded-[8px] bg-zinc-100 shadow-inner shadow-zinc-300 flex overflow-hidden">
                                    <div
                                      className="h-full bg-linear-to-b from-[#5A9CB5] via-[#5A9CB5]/75 via-25% to-[#5A9CB5]/90"
                                      style={{ width: `${seg1}%` }}
                                    />
                                    <div
                                      className="h-full bg-linear-to-b from-[#FACE68] via-[#FACE68]/75 via-25% to-[#FACE68]/90"
                                      style={{ width: `${seg2}%` }}
                                    />
                                    <div
                                      className="h-full bg-linear-to-b from-[#FA6868] via-[#FA6868]/60 via-25% to-[#FA6868]/90"
                                      style={{ width: `${seg3}%` }}
                                    />
                                  </div>

                                  {/* Row 2 - Legend + reset info */}
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-2 px-1 py-1">
                                        <div className="w-3.5 h-3.5 rounded bg-linear-to-b from-[#5A9CB5] via-[#5A9CB5]/75 via-25% to-[#5A9CB5]/90" />
                                        <p className="font-geist text-[11px] text-[#737373]">
                                          Chat{" "}
                                          <span className="font-medium text-black">
                                            {chatCredits.toLocaleString()}
                                          </span>
                                        </p>
                                      </div>
                                      <p className="text-[#D4D4D4] text-xs">|</p>
                                      <div className="flex items-center gap-2 px-1 py-1">
                                        <div className="w-3.5 h-3.5 rounded bg-linear-to-b from-[#FACE68] via-[#FACE68]/75 via-25% to-[#FACE68]/90" />
                                        <p className="font-geist text-[11px] text-[#737373]">
                                          Persona{" "}
                                          <span className="font-medium text-black">
                                            {personaCredits.toLocaleString()}
                                          </span>
                                        </p>
                                      </div>
                                      <p className="text-[#D4D4D4] text-xs">|</p>
                                      <div className="flex items-center gap-2 px-1 py-1">
                                        <div className="w-3.5 h-3.5 rounded bg-linear-to-b from-[#FA6868] via-[#FA6868]/60 via-25% to-[#FA6868]/90" />
                                        <p className="font-geist text-[11px] text-[#737373]">
                                          Workflow{" "}
                                          <span className="font-medium text-black">
                                            {workflowCredits.toLocaleString()}
                                          </span>
                                        </p>
                                      </div>
                                    </div>
                                    <p className="text-[11px] text-[#737373] whitespace-nowrap">
                                      {user?.usage?.last_reset_date
                                        ? `Last reset ${formatDate(user.usage.last_reset_date)}`
                                        : "Resets 12:00AM UTC"}
                                    </p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    </StatCard>

                    {/* Middle - Active Consumers */}
                    <StatCard
                      title="Active Consumers"
                      value={activeConsumers}
                      suffix="Users"
                      className="max-w-[200px] w-full h-[148px] flex-none !p-0"
                    >
                      <div className="relative flex h-full w-full flex-col">
                        <div className="flex flex-col ml-[14px] mt-[14px]">
                          <p className="font-inter font-semibold text-base font-semibold leading-[140%] tracking-tight text-black">
                            Active Consumers
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 ml-[14px] pt-2">
                          <div className="flex items-center gap-2">
                            <p className="font-inter font-normal text-[32px] leading-[120%] text-black">
                              {activeConsumers}
                            </p>
                            <span className="font-inter font-normal leading-[154%] text-sm text-[#B3B3B3]">
                              Users
                            </span>
                          </div>
                        </div>
                        {/* Avatar Stack */}
                        <div className="absolute bottom-[14px] left-[14px] flex items-center -space-x-2">
                          {[userAvatar2, userAvatar, userAvatar3].map(
                            (src, index) => (
                              <div
                                key={index}
                                className="h-8 w-8 rounded-full border border-white overflow-hidden"
                                style={{ zIndex: 0 + index, opacity: activeConsumers === 0 ? 0.35 : 1 }}
                              >
                                <Image
                                  src={src}
                                  alt="User avatar"
                                  width={32}
                                  height={32}
                                  className="h-full w-full rounded-full object-cover"
                                />
                              </div>
                            )
                          )}
                          {activeConsumers === 0 && (
                            <span className="ml-3 text-[11px] text-[#B3B3B3] whitespace-nowrap font-geist">
                              No users yet
                            </span>
                          )}
                        </div>
                      </div>
                    </StatCard>

                    {/* Right - Create Workflow */}
                    <StatCard
                      title="Create Workflow"
                      value=""
                      className="h-[148px] max-w-[200px] w-full flex-1 !px-4 !py-4"
                    >
                      <div className="flex h-full w-full flex-col items-center justify-center gap-6">
                        {/* Workflow Icons Stack */}
                        <div
                          className="relative top-4 left-2 flex -space-x-2"
                          style={{ width: "126px", height: "40px" }}
                        >
                          {[1, 2, 3].map((index) => (
                            <div
                              key={index}
                              className="relative h-10 w-10 rounded-full border border-white overflow-hidden bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center"
                              style={{ zIndex: 0 + index }}
                            >
                              <Workflow className="h-5 w-5 text-white" />
                            </div>
                          ))}
                        </div>

                        {/* Create Workflow Button */}
                        <Button
                          size="sm"
                          className={cn(
                            "cursor-pointer mt-4 h-10 w-[150px] min-h-[40px] gap-2 rounded-[8px] bg-[var(--general-primary,#171717)] px-1 py-[9.5px] text-white hover:bg-black",
                            workflows.length === 0
                              ? "animate-pulse"
                              : "animate-none"
                          )}
                          onClick={handleCreateWorkflow}
                        >
                          <span className="text-sm font-medium">
                            Create Workflow
                          </span>
                        </Button>
                      </div>
                    </StatCard>
                  </div>
                </div>

                {/* Command Center + Table */}
                <CommandCenter
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  description="Real-time monitoring and management of workflow automations."
                  statusOptions={WORKFLOW_STATUS_OPTIONS}
                  className="w-full gap-0"
                >
                  <div className="mx-auto flex w-full flex-col overflow-x-auto md:overflow-x-visible">
                    <div className="w-full">
                      <Table className="w-full border-collapse">
                        <TableHeader>
                          <TableRow className="h-9 rounded-xl border-t border-b border-[#E5E5E5] bg-[#F5F5F5] hover:bg-[#F5F5F5]">
                            <TableHead colSpan={8} className="p-0 h-9">
                              <div className="flex w-fit md:w-full items-center h-full text-[12px] font-inter font-bold uppercase tracking-normal text-[#0E1620]">
                                {/* Spacer */}
                                <div className="w-[47px] h-full shrink-0"></div>

                                {/* Workflow Unit */}
                                <div className="w-[180px] h-full shrink-0 flex items-center justify-start px-2.5">
                                  <p>Workflow Unit</p>
                                </div>

                                {/* Credit Usage */}
                                <div className="w-[180px] h-full shrink-0 flex items-center justify-center px-2.5">
                                  <p>Credit Usage</p>
                                </div>

                                {/* Consumers */}
                                <div className="w-[180px] h-full shrink-0 flex items-center justify-center px-2.5">
                                  <p>Consumers</p>
                                </div>

                                {/* Status */}
                                <div className="w-[180px] h-full shrink-0 flex items-center justify-center px-2.5">
                                  <p>Status</p>
                                </div>

                                {/* Last Activity */}
                                <div className="w-[180px] h-full shrink-0 flex items-center justify-center px-2.5">
                                  <p>Last Activity</p>
                                </div>

                                {/* Actions */}
                                <div className="flex-1 h-full shrink-0 flex items-center justify-center px-2.5">
                                  {/* <p>Actions</p> */}
                                </div>
                              </div>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredWorkflows.length === 0 ? (
                            <TableRow>
                              <td
                                colSpan={8}
                                className="py-8 text-center text-muted-foreground"
                              >
                                No workflows found
                              </td>
                            </TableRow>
                          ) : (
                            filteredWorkflows.map((workflow) => (
                              <WorkflowWrapper
                                key={workflow.id}
                                workflow={workflow}
                                onPause={() => handlePauseWorkflow(workflow.id)}
                                onResume={() => handlePauseWorkflow(workflow.id)}
                                onDelete={() => handleDeleteWorkflow(workflow.id)}
                                onEdit={() => handleEditWorkflow(workflow.id)}
                                onView={() => handleViewWorkflow(workflow.id)}
                                onChat={() => handleChatWorkflow(workflow.id)}
                                onShare={() =>
                                  setShareDialog({
                                    open: true,
                                    workflowName: workflow.name,
                                    shareEmail: "",
                                  })
                                }
                              />
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CommandCenter>
              </>
            )}
          </div>

          {/* Workflow Share Dialog */}
          <Dialog
            open={shareDialog.open}
            onOpenChange={(open) => setShareDialog({ ...shareDialog, open })}
          >
            <DialogContent
              className="border-none p-2 gap-3"
              style={{
                width: "420px",
                maxWidth: "420px",
                borderRadius: "10px",
                padding: "8px",
              }}
            >
              <DialogTitle className="sr-only">Share Workflow</DialogTitle>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <h3
                    style={{
                      fontFamily: "Clash Grotesk Variable",
                      fontWeight: 400,
                      fontSize: "24px",
                      lineHeight: "120%",
                      letterSpacing: "-2%",
                      color: "#0A0A0A",
                    }}
                  >
                    Share &quot;{shareDialog.workflowName}&quot;
                  </h3>
                </div>

                {/* Email Input */}
                <div className="w-full min-h-[36px] text-black border border-main-border rounded-[8px] flex items-center gap-2 pl-3">
                  <Search size={16} className="text-[#525252]" />
                  <Input
                    type="email"
                    placeholder="Enter email for adding people"
                    value={shareDialog.shareEmail}
                    onChange={(e) =>
                      setShareDialog({ ...shareDialog, shareEmail: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && shareDialog.shareEmail.trim()) {
                        setShareDialog({ ...shareDialog, shareEmail: "" });
                      }
                    }}
                    className="flex-1 h-full border-none py-[7.5px]"
                  />
                </div>

                {/* User List */}
                <div
                  className="flex flex-col gap-3"
                  style={{ width: "404px", height: "196px", overflowY: "auto" }}
                >
                  {/* Owner row */}
                  <div
                    className="flex items-center justify-between"
                    style={{ width: "404px", height: "40px", paddingRight: "8px", paddingLeft: "8px" }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "50%",
                          backgroundColor: "#F5F5F5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        <Share2 size={18} className="text-[#B3B3B3]" />
                      </div>
                      <div className="flex flex-col">
                        <span style={{ fontWeight: 600, fontSize: "12px", lineHeight: "140%", textTransform: "capitalize", color: "#0A0A0A" }}>
                          You
                        </span>
                        <span style={{ fontSize: "11px", color: "#666666" }}>
                          {maskEmail(user?.email)}
                        </span>
                      </div>
                    </div>
                    <div
                      className="rounded-full"
                      style={{
                        width: "86px",
                        height: "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#FBEEB1",
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "#B47800",
                      }}
                    >
                      Owner
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="font-geist font-medium mr-2 flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    onClick={() => setShareDialog({ ...shareDialog, open: false })}
                    style={{ fontSize: "14px", color: "#666666", padding: "8px 16px" }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (shareDialog.shareEmail.trim()) {
                        setShareDialog({ ...shareDialog, shareEmail: "" });
                      }
                    }}
                    style={{
                      width: "51px",
                      height: "32px",
                      borderRadius: "8px",
                      padding: "5.5px 3px",
                      backgroundColor: "#171717",
                      color: "#FAFAFA",
                      marginTop: "3px",
                      fontSize: "14px",
                      fontWeight: 500,
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <AlertDialog
            open={deleteDialog.open}
            onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{deleteDialog.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleteDialog.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={deleteDialog.onConfirm}
                  className="bg-red-600 text-white hover:bg-red-600/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </AppLayout>
  );
}
