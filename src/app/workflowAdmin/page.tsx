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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { workflowAPI } from "@/components/workflows/workflow-api";
import type { WorkflowMetadata } from "@/components/workflows/types";
import userAvatar from "@/avatars/userAvatar.png";
import userAvatar2 from "@/avatars/userAvatar2.png";
import userAvatar3 from "@/avatars/userAvatar3.png";
import Image from "next/image";
import type { Consumer } from "@/components/workflows/workflow-row";

// Mock consumers data (replace with actual API data when available)
const MOCK_CONSUMERS: Consumer[] = [
  {
    id: "c1",
    name: "Sarah Johnson",
    email: "sarah.j@company.com",
    avatar: "/avatars/avatar1.svg",
    lastActivity: "1 hour ago",
    status: "active",
  },
  {
    id: "c2",
    name: "Mike Chen",
    email: "mike.c@company.com",
    avatar: "/avatars/avatar2.svg",
    lastActivity: "3 hours ago",
    status: "active",
  },
  {
    id: "c3",
    name: "Emma Davis",
    email: "emma.d@company.com",
    avatar: "/avatars/avatar3.svg",
    lastActivity: "5 hours ago",
    status: "active",
  },
];

const WORKFLOW_STATUS_OPTIONS: StatusOption[] = [
  { value: "all", label: "All Workflows" },
  { value: "active", label: "Active Workflows" },
  { value: "paused", label: "Paused Workflows" },
  { value: "inactive", label: "Inactive Workflows" },
];

export default function WorkflowAdminPage() {
  const router = useRouter();
  const hasFetchedWorkflows = React.useRef(false);
  const [workflows, setWorkflows] = React.useState<WorkflowItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("all");
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
        status: "active" as const, // Default status - can be enhanced later
        creditUsage: wf.nodeCount * 1000 + wf.edgeCount * 500, // Mock calculation
        consumers: index < 2 ? MOCK_CONSUMERS : MOCK_CONSUMERS.slice(0, 2), // Mock consumers
        consumersCount: index < 2 ? MOCK_CONSUMERS.length : 2, // Mock count
        nodeCount: wf.nodeCount,
        edgeCount: wf.edgeCount,
        lastActivity: wf.lastExecuted || "Never",
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
        tags: wf.tags,
        version: "v1.0",
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

    const newStatus: "active" | "paused" =
      workflow.status === "active" ? "paused" : "active";

    // Optimistically update UI
    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === workflowId ? { ...w, status: newStatus } : w
      )
    );

    // TODO: Persist to backend when API supports status updates
    try {
      // await workflowAPI.update(workflowId, { status: newStatus });
    } catch (error) {
      console.error("Failed to update workflow status:", error);
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
    // Execute workflow and open in chat mode
    router.push(`/workflows?id=${workflowId}&chatMode=true`);
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
        className={`${chatStyles.customScrollbar} w-full h-full flex items-start justify-center grow-0 overflow-y-auto border py-[20px]`}
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
                      <h1 className="font-inter font-medium leading-[140%] text-[16px] text-black tracking-tight">
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
                  <p className="text-[16px] text-[#4b5563]">
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
                      title="Credit Usage"
                      value={(totalCredits / 1000).toFixed(1) + "K"}
                      suffix="Credits"
                      className="relative w-[400px] h-[148px] flex-none p-0!"
                    >
                      <div className="relative flex h-full w-full flex-col">
                        <div className="flex flex-col ml-[14px] mt-[14px]">
                          <p className="font-inter font-[600] text-[16px] leading-[140%] tracking-tight text-black">
                            Credit Usage
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 ml-[14px] pt-2">
                          <div className="flex items-center gap-2">
                            <p className="font-inter font-normal text-[32px] leading-[120%] text-black">
                              {(totalCredits / 1000).toFixed(1) + "K"}
                            </p>
                            <span className="font-inter font-normal leading-[154%] text-[14px] text-[#B3B3B3]">
                              Credits
                            </span>
                          </div>
                        </div>
                        <button className="cursor-pointer absolute bottom-[14px] left-[14px] inline-flex h-[26px] min-h-[24px] w-[161px] items-center justify-center gap-1.5 rounded-[8px] border border-[#E5E5E5] bg-white px-2 py-[3px] text-xs font-medium text-black transition-colors hover:bg-gray-100">
                          <TrendingUp className="h-3 w-3" />
                          Across {workflows.length} workflows
                        </button>
                      </div>
                      <div className="absolute top-3.5 right-3.5 w-[34px] h-[34px] border border-main-border rounded-[8px] flex items-center justify-center">
                        <ChartLine size={20} strokeWidth={1} />
                      </div>
                    </StatCard>

                    {/* Middle - Active Consumers */}
                    <StatCard
                      title="Active Consumers"
                      value={activeConsumers}
                      suffix="Users"
                      className="w-[400px] h-[148px] flex-none !p-0"
                    >
                      <div className="relative flex h-full w-full flex-col">
                        <div className="flex flex-col ml-[14px] mt-[14px]">
                          <p className="font-inter font-[600] text-[16px] font-semibold leading-[140%] tracking-tight text-black">
                            Active Consumers
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 ml-[14px] pt-2">
                          <div className="flex items-center gap-2">
                            <p className="font-inter font-normal text-[32px] leading-[120%] text-black">
                              {activeConsumers}
                            </p>
                            <span className="font-inter font-normal leading-[154%] text-[14px] text-[#B3B3B3]">
                              Users
                            </span>
                          </div>
                        </div>
                        {/* Avatar Stack */}
                        <div className="absolute bottom-[14px] left-[14px] flex -space-x-2">
                          {[userAvatar2, userAvatar, userAvatar3].map(
                            (src, index) => (
                              <div
                                key={index}
                                className="h-8 w-8 rounded-full border border-white overflow-hidden"
                                style={{ zIndex: 0 + index, opacity: 1 }}
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
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
