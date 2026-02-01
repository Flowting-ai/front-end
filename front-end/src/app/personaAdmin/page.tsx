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
import { BulkActionBar } from "@/components/personas/bulk-action-bar";
import { PersonaWrapper } from "@/components/personas/persona-wrapper";
import { Persona } from "@/components/personas/unified-row";
import { CommandCenter } from "@/components/personas/command-center";
import {
  BarChart3,
  Users,
  Plus,
  Pause,
  Trash2,
  TrendingUp,
  ChartLine,
} from "lucide-react";
import userAvatar from "@/avatars/userAvatar.png"
import userAvatar2 from "@/avatars/userAvatar2.png"
import userAvatar3 from "@/avatars/userAvatar3.png"
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import {
  fetchPersonas,
  deletePersona as deletePersonaApi,
  type BackendPersona,
} from "@/lib/api/personas";

// Mock data (kept for reference/development only - NOT used in production)
// The actual data is fetched from the backend API in the useEffect hook
const MOCK_PERSONAS: Persona[] = [
  {
    id: "1",
    name: "Marketing Assistant",
    description: "T: 0.3",
    avatar: "/personas/persona1.png",
    status: "active",
    tokensUsed: 1250000,
    consumersCount: 12,
    createdAt: "2024-01-15",
    lastActivity: "2 hours ago",
    version: "v1.2",
    consumers: [
      {
        id: "c1",
        name: "Sarah Johnson",
        email: "sarah.j@company.com",
        avatar: "/avatars/sarah.png",
        tokensUsed: 450000,
        lastActivity: "1 hour ago",
        status: "active",
      },
      {
        id: "c2",
        name: "Mike Chen",
        email: "mike.c@company.com",
        avatar: "/avatars/mike.png",
        tokensUsed: 320000,
        lastActivity: "3 hours ago",
        status: "active",
      },
      {
        id: "c3",
        name: "Emma Davis",
        email: "emma.d@company.com",
        tokensUsed: 280000,
        lastActivity: "5 hours ago",
        status: "paused",
      },
    ],
  },
  {
    id: "2",
    name: "Product Strategist",
    description: "Analyzes feedback and creates...",
    avatar: "/personas/persona2.png",
    status: "active",
    tokensUsed: 980000,
    consumersCount: 8,
    createdAt: "2024-02-01",
    lastActivity: "1 day ago",
    version: "v2.0",
    consumers: [
      {
        id: "c4",
        name: "Alex Turner",
        email: "alex.t@company.com",
        tokensUsed: 520000,
        lastActivity: "12 hours ago",
        status: "active",
      },
      {
        id: "c5",
        name: "Lisa Wong",
        email: "lisa.w@company.com",
        tokensUsed: 460000,
        lastActivity: "1 day ago",
        status: "active",
      },
    ],
  },
  {
    id: "3",
    name: "Data Analyst",
    description: "T: 0.3",
    avatar: "/personas/persona3.png",
    status: "paused",
    tokensUsed: 750000,
    consumersCount: 5,
    createdAt: "2024-01-20",
    lastActivity: "3 days ago",
    version: "v1.5",
    consumers: [
      {
        id: "c6",
        name: "David Park",
        email: "david.p@company.com",
        tokensUsed: 380000,
        lastActivity: "2 days ago",
        status: "paused",
      },
    ],
  },
  {
    id: "4",
    name: "Customer Support",
    description: "T: 0.3",
    avatar: "/personas/persona4.png",
    status: "active",
    tokensUsed: 1820000,
    consumersCount: 25,
    createdAt: "2023-12-10",
    lastActivity: "30 minutes ago",
    version: "v3.1",
    consumers: [
      {
        id: "c7",
        name: "Rachel Green",
        email: "rachel.g@company.com",
        tokensUsed: 620000,
        lastActivity: "30 minutes ago",
        status: "active",
      },
      {
        id: "c8",
        name: "Tom Harris",
        email: "tom.h@company.com",
        tokensUsed: 580000,
        lastActivity: "45 minutes ago",
        status: "active",
      },
      {
        id: "c9",
        name: "Nina Patel",
        email: "nina.p@company.com",
        tokensUsed: 420000,
        lastActivity: "2 hours ago",
        status: "active",
      },
    ],
  },
];

export default function PersonaAdminPage() {
  const router = useRouter();
  const { csrfToken } = useAuth();
  const [personas, setPersonas] = React.useState<Persona[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [expandedPersonaIds, setExpandedPersonaIds] = React.useState<string[]>(
    []
  );
  const [selectedConsumerIds, setSelectedConsumerIds] = React.useState<
    string[]
  >([]);
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

  // Fetch personas from backend
  React.useEffect(() => {
    const loadPersonas = async () => {
      setIsLoading(true);
      try {
        const backendPersonas = await fetchPersonas(undefined, csrfToken);

        // Transform backend data to match frontend Persona interface
        const transformedPersonas: Persona[] = backendPersonas.map((bp) => ({
          id: bp.id,
          name: bp.name,
          description: bp.prompt?.slice(0, 100) || "No description",
          avatar: bp.imageUrl || "/personas/persona1.png",
          status: bp.status === "completed" ? "active" : "paused",
          tokensUsed: 0, // TODO: Backend doesn't provide this yet
          consumersCount: 0, // TODO: Backend doesn't provide this yet
          consumers: [], // TODO: Backend doesn't provide this yet
          createdAt: bp.createdAt,
          lastActivity: bp.updatedAt,
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
  }, [csrfToken]);

  // Calculate stats
  const totalTokens = React.useMemo(() => {
    return personas.reduce((sum, p) => sum + p.tokensUsed, 0);
  }, [personas]);

  const activeConsumers = React.useMemo(() => {
    return personas.reduce(
      (sum, p) => sum + p.consumers.filter((c) => c.status === "active").length,
      0
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
        : [...prev, personaId]
    );
  };

  const handleToggleConsumer = (consumerId: string) => {
    setSelectedConsumerIds((prev) =>
      prev.includes(consumerId)
        ? prev.filter((id) => id !== consumerId)
        : [...prev, consumerId]
    );
  };

  const handleSelectAllConsumersForPersona = (personaId: string) => {
    const persona = personas.find((p) => p.id === personaId);
    if (!persona) return;

    const consumerIds = persona.consumers.map((consumer) => consumer.id);
    const hasAllSelected = consumerIds.every((id) =>
      selectedConsumerIds.includes(id)
    );

    setSelectedConsumerIds((prev) =>
      hasAllSelected
        ? prev.filter((id) => !consumerIds.includes(id))
        : Array.from(new Set([...prev, ...consumerIds]))
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
                  : consumer
              ),
            }
          : persona
      )
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
                    (consumer) => !consumerIds.includes(consumer.id)
                  ),
                  consumersCount: entry.consumers.filter(
                    (consumer) => !consumerIds.includes(consumer.id)
                  ).length,
                }
              : entry
          )
        );
        setSelectedConsumerIds((prev) =>
          prev.filter((id) => !consumerIds.includes(id))
        );
        setDeleteDialog((prevDialog) => ({ ...prevDialog, open: false }));
      },
    });
  };

  const handlePausePersona = (personaId: string) => {
    setPersonas((prev) =>
      prev.map((p) =>
        p.id === personaId
          ? { ...p, status: p.status === "active" ? "paused" : "active" }
          : p
      )
    );
  };

  const handleDeletePersona = (personaId: string) => {
    const persona = personas.find((p) => p.id === personaId);
    if (!persona) return;

    setDeleteDialog({
      open: true,
      title: "Delete Persona",
      description: `Are you sure you want to delete "${persona.name}"? This action cannot be undone and will affect ${persona.consumersCount} consumer(s).`,
      onConfirm: async () => {
        try {
          await deletePersonaApi(personaId, csrfToken);
          setPersonas((prev) => prev.filter((p) => p.id !== personaId));
          setDeleteDialog({ ...deleteDialog, open: false });
        } catch (error) {
          console.error("Failed to delete persona:", error);
          // Optionally show error toast to user
          setDeleteDialog({ ...deleteDialog, open: false });
        }
      },
    });
  };

  const handleBulkPause = () => {
    setPersonas((prev) =>
      prev.map((p) => {
        const hasSelectedConsumers = p.consumers.some((c) =>
          selectedConsumerIds.includes(c.id)
        );
        if (!hasSelectedConsumers) return p;

        return {
          ...p,
          consumers: p.consumers.map((c) =>
            selectedConsumerIds.includes(c.id)
              ? { ...c, status: c.status === "active" ? "paused" : "active" }
              : c
          ),
        };
      })
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
              (c) => !selectedConsumerIds.includes(c.id)
            ),
            consumersCount: p.consumers.filter(
              (c) => !selectedConsumerIds.includes(c.id)
            ).length,
          }))
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
        className={`${chatStyles.customScrollbar} w-full h-full flex items-start justify-center grow-0 overflow-y-auto border py-[20px]`}
      >
        <div className="border-0 border-pink-500 scale-100 max-w-[1040px] mx-auto w-full">
          <div className="w-full flex flex-col gap-6">
            {/* Header */}
            <div className="flex flex-col">
              <h1 className="font-clash font-[400] leading-[140%] text-[24px] text-black">
                Your Personas
              </h1>
              <p className="font-geist font-[400] leading-[140%] text-[13px] text-black">
                Manage your custom agents.
              </p>
            </div>

            {/* Loading State */}
            {isLoading ? (
              <div className="font-inter border border-main-border rounded-[16px] shadow-xl shadow-zinc-100 flex flex-col items-center justify-center gap-8 py-16">
                <div className="text-center flex flex-col items-center gap-3">
                  <h2 className="font-semibold text-[32px] text-[#0A0A0A]">
                    Loading Personas...
                  </h2>
                  <p className="text-[16px] text-[#4b5563]">
                    Please wait while we fetch your personas.
                  </p>
                </div>
              </div>
            ) : /* Empty State */ personas.length === 0 ? (
              <div className="font-inter border border-main-border rounded-[16px] shadow-xl shadow-zinc-100 flex flex-col items-center justify-center gap-8 py-16">
                <div className="text-center flex flex-col items-center gap-3">
                  <h2 className="font-semibold text-[32px] text-[#0A0A0A]">
                    No Personas Yet
                  </h2>
                  <p className="text-[16px] text-[#4b5563]">
                    Start by creating a new persona based on your requirements.
                  </p>
                </div>

                <StatCard
                  title="Create Persona"
                  value=""
                  className="w-auto h-[148px] shadow-xl shadow-black/5 flex-none px-4! py-4!"
                >
                  <div className="flex h-full w-full flex-col items-center justify-center gap-6">
                    {/* Avatar Stack */}
                    <div className="w-[126px] h-[40px] flex items-center justify-center -space-x-2">
                      {[
                        "/avatars/avatar1.svg",
                        "/avatars/avatar2.svg",
                        "/avatars/avatar3.svg",
                      ].map((src, index) => (
                        <div
                          key={`${src}-${index}`}
                          className="relative h-10 w-10 rounded-full border-2 border-white shadow-md overflow-hidden"
                          style={{ zIndex: 4 - index }}
                        >
                          <Image
                            src={src}
                            alt="Persona avatar"
                            width={41}
                            height={40}
                            className="h-full w-full rounded-full object-contain"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Create Persona Button */}
                    <Button
                      size="sm"
                      className="cursor-pointer w-auto min-h-[36px] h-[36px] bg-[#171717] text-white hover:bg-black rounded-[8px] px-1 py-[9.5px]"
                      onClick={handleCreatePersona}
                    >
                      <Plus className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Create Persona
                      </span>
                    </Button>
                  </div>
                </StatCard>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div className="mx-auto w-full">
                  <div className="flex w-full flex-col md:flex-row md:flex-nowrap gap-6 pb-0">
                    {/* Left - Tokens Usage */}
                    <StatCard
                      title="Tokens Usage"
                      value={(totalTokens / 1000000).toFixed(1) + "M"}
                      suffix="Tokens"
                      className="relative w-[400px] h-[148px] flex-none p-0!"
                    >
                      <div className="relative flex h-full w-full flex-col">
                        <div className="flex flex-col ml-[14px] mt-[14px]">
                          <p className="font-inter font-[600] text-[16px] leading-[140%] tracking-tight text-black">
                            Tokens Usage
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 ml-[14px] pt-2">
                          <div className="flex items-center gap-2">
                            <p className="font-inter font-[400] text-[32px] font-normal leading-[120%] text-black">
                              {(totalTokens / 1000000).toFixed(1) + "M"}
                            </p>
                            <span className="font-inter font-[400] leading-[154%] text-[14px] text-[#B3B3B3]">
                              Tokens
                            </span>
                          </div>
                        </div>
                        <button className="cursor-pointer absolute bottom-[14px] left-[14px] inline-flex h-[26px] min-h-[24px] w-[161px] items-center justify-center gap-1.5 rounded-[8px] border border-[#E5E5E5] bg-white px-2 py-[3px] text-xs font-medium text-black transition-colors hover:bg-gray-100">
                          <TrendingUp className="h-3 w-3" />
                          +0% vs last period
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
                            <p className="font-inter font-[400] text-[32px] leading-[120%] text-black">
                              {activeConsumers}
                            </p>
                            <span className="font-inter font-[400] leading-[154%] text-[14px] text-[#B3B3B3]">
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

                        {/* Create Persona Button inside the card on row 1*/}
                        <Button
                          size="sm"
                          className="cursor-pointer mt-4 h-10 w-[150px] min-h-[40px] gap-2 rounded-[8px] bg-[var(--general-primary,#171717)] px-1 py-[9.5px] text-white hover:bg-black"
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
                </div>

                {/* Command Center + Table */}
                <CommandCenter
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  className="w-full gap-0"
                >
                  <div className="mx-auto flex w-full flex-col overflow-x-auto md:overflow-x-visible">
                    <div
                      className={`w-full`}
                    >
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
                                expanded={expandedPersonaIds.includes(
                                  persona.id
                                )}
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
                                    `/personas/new/configure?personaId=${persona.id}`
                                  )
                                }
                                onChat={() =>
                                  router.push(
                                    `/personas/new/configure?personaId=${persona.id}&chatMode=true`
                                  )
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
                              />
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
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
