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
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import { BulkActionBar } from "@/components/personas/bulk-action-bar";
import { PersonaWrapper } from "@/components/personas/persona-wrapper";
import { Persona } from "@/components/personas/unified-row";
import { CommandCenter } from "@/components/personas/command-center";
import {
  BarChart3,
  Users,
  Plus,
  Pause,
  Search,
  Share2,
  Trash2,
  TrendingUp,
  ChartLine,
  MessageSquareWarning,
} from "lucide-react";
import userAvatar from "@/avatars/userAvatar.png";
import userAvatar2 from "@/avatars/userAvatar2.png";
import userAvatar3 from "@/avatars/userAvatar3.png";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import {
  fetchPersonas,
  deletePersona as deletePersonaApi,
  updatePersona,
  type BackendPersona,
  type PersonaStatus,
} from "@/lib/api/personas";
import { workflowAPI } from "@/components/workflows/workflow-api";
import { cn, formatRelativeTime } from "@/lib/utils";
import { API_BASE_URL } from "@/lib/config";
import Link from "next/link";

// Helper to construct full avatar URL from relative or absolute paths
const getFullAvatarUrl = (url: string | null | undefined): string | null => {
  if (!url || url.trim() === "") return null;
  // Already a full URL (http/https) or data URL
  if (
    url.startsWith("http") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  ) {
    return url;
  }
  // Relative path - prepend backend URL
  return `${API_BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

function maskEmail(email: string | null | undefined): string {
  if (!email) return "your@email.com";
  const atIndex = email.indexOf("@");
  if (atIndex <= 3) return email;
  return email.slice(0, 3) + "*".repeat(atIndex - 3) + email.slice(atIndex);
}

export default function PersonaAdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const hasFetchedPersonas = React.useRef(false);
  const [personas, setPersonas] = React.useState<Persona[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [expandedPersonaIds, setExpandedPersonaIds] = React.useState<string[]>(
    [],
  );
  const [selectedConsumerIds, setSelectedConsumerIds] = React.useState<
    string[]
  >([]);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [shareDialog, setShareDialog] = React.useState<{
    open: boolean;
    personaName: string;
    shareEmail: string;
  }>({
    open: false,
    personaName: "",
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
  const [tokenUsage, setTokenUsage] = React.useState(0);

  // Auth0: access token is handled by the auth context/jwt-utils helpers.

  // Fetch personas from backend
  React.useEffect(() => {
    const loadPersonas = async () => {
      // Skip if already fetched
      if (hasFetchedPersonas.current) {
        return;
      }
      setIsLoading(true);
      try {
        const backendPersonas = await fetchPersonas(
          undefined,
        );
        hasFetchedPersonas.current = true;

        // Transform backend data to match frontend Persona interface
        // Map backend status ("test" | "completed") to frontend status ("active" | "paused" | "inactive")
        const transformedPersonas: Persona[] = backendPersonas.map((bp) => ({
          id: bp.id,
          name: bp.name,
          description: bp.prompt?.slice(0, 100) || "No description",
          avatar: getFullAvatarUrl(bp.imageUrl) || "/personas/persona1.png",
          // Dynamic status mapping:
          // - "test" (newly created) → "active" (default for new personas)
          // - "completed" (user has set) → "paused" (user explicitly paused it)
          status: bp.status === "completed" ? "paused" : "active",
          tokensUsed: 0, // TODO: Backend doesn't provide this yet
          consumersCount: 0, // TODO: Backend doesn't provide this yet
          consumers: [], // TODO: Backend doesn't provide this yet
          createdAt: bp.createdAt ?? bp.created_at,
          lastActivity: formatRelativeTime(bp.updatedAt ?? bp.updated_at),
          version: "v1.0",
        }));

        setPersonas(transformedPersonas);
      } catch (error) {
        console.error("Failed to load personas:", error);
        // Optionally show error toast to user
      } finally {
        setIsLoading(false);
      }
    };

    loadPersonas();
  }, []); // Empty deps - only load once on mount

  // Calculate stats
  const totalTokens = React.useMemo(() => {
    return personas.reduce((sum, p) => sum + p.tokensUsed, 0);
  }, [personas]);

  const activeConsumers = React.useMemo(() => {
    return personas.reduce(
      (sum, p) => sum + p.consumers.filter((c) => c.status === "active").length,
      0,
    );
  }, [personas]);

  // Filter personas
  const filteredPersonas = React.useMemo(() => {
    if (statusFilter === "all") return personas;

    return personas.filter((p) => p.status === statusFilter);
  }, [personas, statusFilter]);

  const handleToggleExpand = (personaId: string) => {
    setExpandedPersonaIds((prev) =>
      prev.includes(personaId)
        ? prev.filter((id) => id !== personaId)
        : [...prev, personaId],
    );
  };

  const handleToggleConsumer = (consumerId: string) => {
    setSelectedConsumerIds((prev) =>
      prev.includes(consumerId)
        ? prev.filter((id) => id !== consumerId)
        : [...prev, consumerId],
    );
  };

  const handleSelectAllConsumersForPersona = (personaId: string) => {
    const persona = personas.find((p) => p.id === personaId);
    if (!persona) return;

    const consumerIds = persona.consumers.map((consumer) => consumer.id);
    const hasAllSelected = consumerIds.every((id) =>
      selectedConsumerIds.includes(id),
    );

    setSelectedConsumerIds((prev) =>
      hasAllSelected
        ? prev.filter((id) => !consumerIds.includes(id))
        : Array.from(new Set([...prev, ...consumerIds])),
    );
  };

  const handlePauseAllConsumersForPersona = (personaId: string) => {
    const persona = personas.find((p) => p.id === personaId);
    if (!persona) return;

    const targetIds = persona.consumers
      .filter((consumer) => selectedConsumerIds.includes(consumer.id))
      .map((consumer) => consumer.id);

    if (targetIds.length === 0) return;

    setPersonas((prev) =>
      prev.map((persona) =>
        persona.id === personaId
          ? {
              ...persona,
              consumers: persona.consumers.map((consumer) =>
                targetIds.includes(consumer.id)
                  ? {
                      ...consumer,
                      status: "paused",
                    }
                  : consumer,
              ),
            }
          : persona,
      ),
    );
  };

  const handleDeleteAllConsumersForPersona = (personaId: string) => {
    const persona = personas.find((p) => p.id === personaId);
    if (!persona) return;

    const consumerIds = persona.consumers
      .filter((consumer) => selectedConsumerIds.includes(consumer.id))
      .map((consumer) => consumer.id);

    if (consumerIds.length === 0) return;

    setDeleteDialog({
      open: true,
      title: "Delete All Consumers",
      description: `Are you sure you want to delete ${consumerIds.length} consumer(s) for "${persona.name}"? This action cannot be undone.`,
      onConfirm: () => {
        setPersonas((prev) =>
          prev.map((entry) =>
            entry.id === personaId
              ? {
                  ...entry,
                  consumers: entry.consumers.filter(
                    (consumer) => !consumerIds.includes(consumer.id),
                  ),
                  consumersCount: entry.consumers.filter(
                    (consumer) => !consumerIds.includes(consumer.id),
                  ).length,
                }
              : entry,
          ),
        );
        setSelectedConsumerIds((prev) =>
          prev.filter((id) => !consumerIds.includes(id)),
        );
        setDeleteDialog((prevDialog) => ({ ...prevDialog, open: false }));
      },
    });
  };

  const handlePausePersona = async (personaId: string) => {
    // Find current persona to determine new status
    const persona = personas.find((p) => p.id === personaId);
    if (!persona) return;

    // Calculate new frontend status
    const newFrontendStatus: "active" | "paused" =
      persona.status === "active" ? "paused" : "active";

    // Map frontend status to backend status
    // - "active" → "test" (active/default state)
    // - "paused" → "completed" (user explicitly paused)
    const newBackendStatus: PersonaStatus =
      newFrontendStatus === "active" ? "test" : "completed";

    // Optimistically update UI
    setPersonas((prev) =>
      prev.map((p) =>
        p.id === personaId ? { ...p, status: newFrontendStatus } : p,
      ),
    );
    // Notify sidebar immediately so it reflects the change without a refresh
    window.dispatchEvent(new CustomEvent("persona:status-changed", {
      detail: { personaId, status: newBackendStatus },
    }));

    // Persist to backend
    try {
      await updatePersona(
        personaId,
        { status: newBackendStatus },
      );
    } catch (error) {
      console.error("Failed to update persona status:", error);
      // Revert optimistic update on error
      setPersonas((prev) =>
        prev.map((p) =>
          p.id === personaId ? { ...p, status: persona.status } : p,
        ),
      );
      // Revert sidebar as well
      window.dispatchEvent(new CustomEvent("persona:status-changed", {
        detail: { personaId, status: persona.status === "active" ? "test" : "completed" },
      }));
      // Optionally show error toast
    }
  };

  const handleDeletePersona = async (personaId: string) => {
    const persona = personas.find((p) => p.id === personaId);
    if (!persona) return;

    // Check if persona is used in any workflow before allowing deletion
    try {
      const { workflows } = await workflowAPI.list();
      if (workflows.length > 0) {
        const usageResults = await Promise.all(
          workflows.map(async (wf) => {
            try {
              const dto = await workflowAPI.get(wf.id);
              const usesPersona = dto.nodes?.some(
                (node) => node.data?.selectedPersona === personaId,
              );
              return usesPersona ? wf.name : null;
            } catch {
              return null;
            }
          }),
        );
        const usedInWorkflows = usageResults.filter(Boolean) as string[];
        if (usedInWorkflows.length > 0) {
          setDeleteDialog({
            open: true,
            title: "Cannot Delete Persona",
            description: `"${persona.name}" is used in ${usedInWorkflows.length} workflow${usedInWorkflows.length > 1 ? "s" : ""}: ${usedInWorkflows.join(", ")}. Remove it from those workflows before deleting.`,
            onConfirm: () =>
              setDeleteDialog((prev) => ({ ...prev, open: false })),
          });
          return;
        }
      }
    } catch (error) {
      console.error("Failed to check workflow usage:", error);
      // If the check fails, proceed with normal delete flow
    }

    setDeleteDialog({
      open: true,
      title: "Delete Persona",
      description: `Are you sure you want to delete "${persona.name}"? This action cannot be undone and will affect ${persona.consumersCount} consumer(s).`,
      onConfirm: async () => {
        try {
          await deletePersonaApi(personaId);
          setPersonas((prev) => prev.filter((p) => p.id !== personaId));
          setDeleteDialog((prev) => ({ ...prev, open: false }));
        } catch (error) {
          console.error("Failed to delete persona:", error);
          setDeleteDialog((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleBulkPause = () => {
    setPersonas((prev) =>
      prev.map((p) => {
        const hasSelectedConsumers = p.consumers.some((c) =>
          selectedConsumerIds.includes(c.id),
        );
        if (!hasSelectedConsumers) return p;

        return {
          ...p,
          consumers: p.consumers.map((c) =>
            selectedConsumerIds.includes(c.id)
              ? { ...c, status: c.status === "active" ? "paused" : "active" }
              : c,
          ),
        };
      }),
    );
  };

  const handleBulkDelete = () => {
    setDeleteDialog({
      open: true,
      title: "Delete Selected Consumers",
      description: `Are you sure you want to delete ${selectedConsumerIds.length} consumer(s)? This action cannot be undone.`,
      onConfirm: () => {
        setPersonas((prev) =>
          prev.map((p) => ({
            ...p,
            consumers: p.consumers.filter(
              (c) => !selectedConsumerIds.includes(c.id),
            ),
            consumersCount: p.consumers.filter(
              (c) => !selectedConsumerIds.includes(c.id),
            ).length,
          })),
        );
        setSelectedConsumerIds([]);
        setDeleteDialog({ ...deleteDialog, open: false });
      },
    });
  };

  const handleCreatePersona = () => {
    router.push("/personas");
  };

  return (
    <AppLayout>
      <div
        className={`${chatStyles.customScrollbar} w-full h-full flex items-start justify-center grow-0 overflow-y-auto py-[20px]`}
      >
        <div className="scale-100 mx-auto w-full">
          <div className="w-full flex flex-col gap-6">
            {/* Header */}
            <div className="pl-32 pr-4 w-full flex justify-between">
              {/* Left */}
              <div className="flex flex-col">
                <h1 className="font-clash font-normal leading-[140%] text-[24px] text-black">
                  Your Personas
                </h1>
                <p className="font-geist font-normal leading-[140%] text-[13px] text-black">
                  Manage your custom agents.
                </p>
              </div>

              {/* Right */}
              {personas.length === 0 && !isLoading ? (
                <div className="animate-slide-in-right animate-pulse text-left bg-red-100 border-2 border-dashed border-red-200 rounded-[8px] px-3 py-2 flex items-center gap-4">
                  <MessageSquareWarning size={26} />
                  <div className="flex flex-col">
                    <h1 className="font-inter font-medium leading-[140%] text-base text-black tracking-tight">
                      No Personas Found
                    </h1>
                    <p className="font-geist font-normal leading-[140%] text-[13px] text-black">
                      Create a persona to start managing.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="max-w-[1040px] mx-auto w-full font-inter border border-main-border rounded-[16px] shadow-xl shadow-zinc-100 flex flex-col items-center justify-center gap-8 py-16">
                <div className="text-center flex flex-col items-center gap-3">
                  <h2 className="font-semibold text-[32px] text-[#0A0A0A]">
                    Loading Personas...
                  </h2>
                  <p className="text-base text-[#4b5563]">
                    Please wait while we fetch your personas.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="max-w-[1040px] mx-auto w-full">
                  <div className="flex w-full flex-col md:flex-row md:flex-nowrap gap-6 pb-0">
                    {/* Left - Tokens Usage */}
                    <StatCard
                      title="Tokens Usage"
                      value={Math.round(user?.budgetConsumedPercent ?? 0) + "%"}
                      suffix="Used"
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
                                {Math.round(user?.budgetConsumedPercent ?? 0) +
                                  "%"}
                              </p>
                              <span className="font-inter font-normal leading-[154%] text-sm text-black">
                                used
                              </span>
                            </div>
                          </div>

                          {/* Bottom */}
                          <div className="mt-4 flex flex-col gap-2">
                            {(() => {
                              const monthlyPct = Math.min(
                                user?.budgetConsumedPercent ?? 0,
                                100,
                              );
                              const seg1 = +(monthlyPct * 0.4).toFixed(1);
                              const seg2 = +(monthlyPct * 0.35).toFixed(1);
                              const seg3 = +(
                                monthlyPct - seg1 - seg2
                              ).toFixed(1);

                              return (
                                <>
                                  {/* Row 1 - Progress graph */}
                                  <div className="w-full h-2 rounded-[8px] bg-zinc-100 shadow-inner shadow-zinc-300 flex overflow-hidden">
                                    <div
                                      className="h-full bg-linear-to-b from-[#5A9CB5] via-[#5A9CB5]/75 via-25% to-[#5A9CB5]/90"
                                      style={{ width: `20%` }}
                                    />
                                    <div
                                      className="h-full bg-linear-to-b from-[#FACE68] via-[#FACE68]/75 via-25% to-[#FACE68]/90"
                                      style={{ width: `20%` }}
                                    />
                                    <div
                                      className="h-full bg-linear-to-b from-[#FA6868] via-[#FA6868]/60 via-25% to-[#FA6868]/90"
                                      style={{ width: `20%` }}
                                    />
                                  </div>

                                  {/* Row 2 - Legend + reset info */}
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-2 px-1 py-1">
                                        <div className="w-3.5 h-3.5 rounded bg-linear-to-b from-[#5A9CB5] via-[#5A9CB5]/75 via-25% to-[#5A9CB5]/90" />
                                        <p className="font-geist text-[11px] text-[#737373]">
                                          Chat Board{" "}
                                          <span className="font-medium text-black">
                                            {seg1}%
                                          </span>
                                        </p>
                                      </div>
                                      <p className="text-[#D4D4D4] text-xs">|</p>
                                      <div className="flex items-center gap-2 px-1 py-1">
                                        <div className="w-3.5 h-3.5 rounded bg-linear-to-b from-[#FACE68] via-[#FACE68]/75 via-25% to-[#FACE68]/90" />
                                        <p className="font-geist text-[11px] text-[#737373]">
                                          AI Assistants{" "}
                                          <span className="font-medium text-black">
                                            {seg2}%
                                          </span>
                                        </p>
                                      </div>
                                      <p className="text-[#D4D4D4] text-xs">|</p>
                                      <div className="flex items-center gap-2 px-1 py-1">
                                        <div className="w-3.5 h-3.5 rounded bg-linear-to-b from-[#FA6868] via-[#FA6868]/60 via-25% to-[#FA6868]/90" />
                                        <p className="font-geist text-[11px] text-[#737373]">
                                          FlowBuilder{" "}
                                          <span className="font-medium text-black">
                                            {seg3}%
                                          </span>
                                        </p>
                                      </div>
                                    </div>
                                    <p className="text-[11px] text-[#737373] whitespace-nowrap">
                                      Resets 12:00AM UTC
                                    </p>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        {/* <button className="cursor-pointer absolute bottom-[14px] left-[14px] inline-flex h-[26px] min-h-[24px] w-[161px] items-center justify-center gap-1.5 rounded-[8px] border border-[#E5E5E5] bg-white px-2 py-[3px] text-xs font-medium text-black transition-colors hover:bg-gray-100">
                            <TrendingUp className="h-3 w-3" />
                            {user?.budgetRemaining ? `$${user.budgetRemaining} remaining` : "Budget usage"}
                          </button> */}
                      </div>
                      {/* <div className="absolute top-3.5 right-3.5 w-[34px] h-[34px] border border-main-border rounded-[8px] flex items-center justify-center">
                        <ChartLine size={20} strokeWidth={1} />
                      </div> */}
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
                                style={{
                                  zIndex: 0 + index,
                                  opacity: activeConsumers === 0 ? 0.35 : 1,
                                }}
                              >
                                <Image
                                  src={src}
                                  alt="User avatar"
                                  width={32}
                                  height={32}
                                  className="h-full w-full rounded-full object-cover"
                                />
                              </div>
                            ),
                          )}
                          {activeConsumers === 0 && (
                            <span className="ml-3 text-[11px] text-[#B3B3B3] whitespace-nowrap font-geist">
                              No users yet
                            </span>
                          )}
                        </div>
                      </div>
                    </StatCard>
                    {/* Right - Create Persona */}
                    <StatCard
                      title="Create Persona"
                      value=""
                      className="h-[148px] max-w-[200px] w-full flex-1 !px-4 !py-4"
                    >
                      <div className="flex h-full w-full flex-col items-center justify-center gap-6">
                        {/* Avatar Stack */}
                        <div
                          className="relative top-4 left-2 flex -space-x-2"
                          style={{ width: "126px", height: "40px" }}
                        >
                          {[
                            "/avatars/avatar3.svg",
                            "/avatars/avatar2.svg",
                            "/avatars/avatar1.svg",
                          ].map((src, index) => (
                            <div
                              key={`${src}-${index}`}
                              className="relative h-10 w-10 rounded-full border border-white overflow-hidden"
                              style={{ zIndex: 0 + index }}
                            >
                              <Image
                                src={src}
                                alt="Persona avatar"
                                width={32}
                                height={32}
                                className="h-full w-full rounded-full object-cover"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Create Persona Button*/}
                        <Button
                          size="sm"
                          className={cn(
                            "cursor-pointer mt-4 h-10 w-[150px] min-h-[40px] gap-2 rounded-[8px] bg-[var(--general-primary,#171717)] px-1 py-[9.5px] text-white hover:bg-black",
                            personas.length === 0
                              ? "animate-pulse"
                              : "animate-none",
                          )}
                          onClick={handleCreatePersona}
                        >
                          {/* <Plus className="h-4 w-4" /> */}
                          <span className="text-sm font-medium">
                            Create Persona
                          </span>
                        </Button>
                      </div>
                    </StatCard>
                  </div>
                  {Math.round(user?.budgetConsumedPercent ?? 0) >= 100 && (
                    <div className="w-full h-auto flex items-center justify-start max-w-sm mt-2">
                      <p className="text-sm text-[#D97757]">
                        You&apos;ve reached this month&apos;s Standard credit
                        limit. Add more credits to continue without
                        interruption:{" "}
                        <Link href="#">
                          <span className="underline text-red-700">
                            Upgrade
                          </span>
                        </Link>
                      </p>
                    </div>
                  )}
                </div>

                {/* Command Center + Table */}
                <CommandCenter
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  className="max-w-[1040px] mx-auto w-full gap-0 overflow-hidden"
                >
                  <div className="mx-auto flex w-full  flex-col overflow-x-auto md:overflow-x-visible p-0">
                    <Table className="w-full border-collapse">
                      <TableHeader>
                        <TableRow className="h-9 rounded-xl border-t border-b border-[#E5E5E5] bg-[#F5F5F5] hover:bg-[#F5F5F5]">
                          <TableHead colSpan={8} className="p-0 h-9">
                            <div className="flex w-fit md:w-full items-center h-full text-[12px] font-inter font-bold uppercase tracking-normal text-[#0E1620]">
                              {/* Spacer */}
                              <div className="w-[47px] h-full shrink-0"></div>

                              {/* Persona Unit */}
                              <div className="w-[180px] h-full shrink-0 flex items-center justify-start px-2.5">
                                <p>Persona Unit</p>
                              </div>

                              {/* Token Usage */}
                              <div className="w-[180px] h-full shrink-0 flex items-center justify-center px-2.5">
                                <p>Token Usage</p>
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
                        {filteredPersonas.length === 0 ? (
                          <TableRow>
                            <td
                              colSpan={8}
                              className="py-8 text-center text-muted-foreground"
                            >
                              No personas found
                            </td>
                          </TableRow>
                        ) : (
                          filteredPersonas.map((persona) => (
                            <PersonaWrapper
                              key={persona.id}
                              persona={persona}
                              expanded={expandedPersonaIds.includes(persona.id)}
                              onToggleExpand={() =>
                                handleToggleExpand(persona.id)
                              }
                              selectedConsumerIds={selectedConsumerIds}
                              onToggleConsumer={handleToggleConsumer}
                              onPause={() => handlePausePersona(persona.id)}
                              onResume={() => handlePausePersona(persona.id)}
                              onDelete={() => handleDeletePersona(persona.id)}
                              onModifyConfig={() =>
                                router.push(
                                  `/personas/new/configure?personaId=${persona.id}`,
                                )
                              }
                              onChat={() =>
                                router.push(`/personas/${persona.id}/chat`)
                              }
                              onSelectAllConsumers={() =>
                                handleSelectAllConsumersForPersona(persona.id)
                              }
                              onPauseAllConsumers={() =>
                                handlePauseAllConsumersForPersona(persona.id)
                              }
                              onDeleteAllConsumers={() =>
                                handleDeleteAllConsumersForPersona(persona.id)
                              }
                              onShare={() => {
                                setShareDialog({
                                  open: true,
                                  personaName: persona.name,
                                  shareEmail: "",
                                });
                              }}
                            />
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CommandCenter>

                {/* Bulk Actions */}
                <BulkActionBar
                  selectedCount={selectedConsumerIds.length}
                  onClear={() => setSelectedConsumerIds([])}
                  actions={[
                    {
                      label: "Pause Selected",
                      icon: <Pause className="h-4 w-4" />,
                      onClick: handleBulkPause,
                    },
                    {
                      label: "Delete Selected",
                      icon: <Trash2 className="h-4 w-4" />,
                      tone: "danger",
                      onClick: handleBulkDelete,
                    },
                  ]}
                  className="w-full"
                />
              </>
            )}
          </div>

          {/* Persona Share Dialog */}
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
              <DialogTitle className="sr-only">Share Persona</DialogTitle>
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
                    Share &quot;{shareDialog.personaName}&quot;
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
                      setShareDialog({
                        ...shareDialog,
                        shareEmail: e.target.value,
                      })
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
                    style={{
                      width: "404px",
                      height: "40px",
                      paddingRight: "8px",
                      paddingLeft: "8px",
                    }}
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
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: "12px",
                            lineHeight: "140%",
                            textTransform: "capitalize",
                            color: "#0A0A0A",
                          }}
                        >
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
                    onClick={() =>
                      setShareDialog({ ...shareDialog, open: false })
                    }
                    style={{
                      fontSize: "14px",
                      color: "#666666",
                      padding: "8px 16px",
                    }}
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
