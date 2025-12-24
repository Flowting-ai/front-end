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
import { PersonaRow, Persona } from "@/components/personas/persona-row";
import { CommandCenter } from "@/components/personas/command-center";
import {
  BarChart3,
  Users,
  Plus,
  Pause,
  Trash2,
} from "lucide-react";

// Mock data
const MOCK_PERSONAS: Persona[] = [
  {
    id: "1",
    name: "Marketing Assistant",
    description: "Helps with content creation and marketing strategy",
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
    description: "Analyzes feedback and creates product roadmaps",
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
    description: "Processes and interprets complex datasets",
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
    description: "Handles customer inquiries and support tickets",
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
  const [personas, setPersonas] = React.useState<Persona[]>(MOCK_PERSONAS);
  const [expandedPersonaIds, setExpandedPersonaIds] = React.useState<string[]>([]);
  const [selectedConsumerIds, setSelectedConsumerIds] = React.useState<string[]>([]);
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

  // Calculate stats
  const totalTokens = React.useMemo(() => {
    return personas.reduce((sum, p) => sum + p.tokensUsed, 0);
  }, [personas]);

  const activeConsumers = React.useMemo(() => {
    return personas.reduce(
      (sum, p) =>
        sum + p.consumers.filter((c) => c.status === "active").length,
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
    const hasAllSelected = consumerIds.every((id) => selectedConsumerIds.includes(id));

    setSelectedConsumerIds((prev) =>
      hasAllSelected ? prev.filter((id) => !consumerIds.includes(id)) : Array.from(new Set([...prev, ...consumerIds]))
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
                  consumers: entry.consumers.filter((consumer) => !consumerIds.includes(consumer.id)),
                  consumersCount: entry.consumers.filter((consumer) => !consumerIds.includes(consumer.id)).length,
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
      onConfirm: () => {
        setPersonas((prev) => prev.filter((p) => p.id !== personaId));
        setDeleteDialog({ ...deleteDialog, open: false });
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
      <div className={`${chatStyles.customScrollbar} h-full w-full overflow-y-auto`}>
        <div className="mx-auto flex w-full max-w-[1200px] justify-center px-4 py-6 md:px-8 md:py-8">
          <div className="flex w-full max-w-[1005px] flex-col gap-[33px]">
            {/* Header */}
            <div className="flex flex-col gap-4 text-[var(--colors-gray-900,#0f172a)] md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-1 text-[var(--colors-gray-900,#0f172a)]">
                <h1 className="font-display text-[24px] font-normal leading-[33.6px] text-[var(--colors-gray-900,#0f172a)]">
                  Your Personas
                </h1>
                <p className="text-[12px] leading-[16.8px] text-[var(--colors-gray-600,#4b5563)]">
                  Manage your custom agents.
                </p>
              </div>
              {/* <Button
                type="button"
                size="sm"
                className="h-9 rounded-[8px] border border-transparent bg-[#171717] px-4 text-xs font-semibold uppercase tracking-[0.08em] text-white shadow-[0_8px_15px_rgba(0,0,0,0.15)] transition-colors hover:bg-black"
                onClick={handleCreatePersona}
              >
                <Plus className="mr-1 h-4 w-4" />
                Create Persona
              </Button> */}
            </div>

            {/* Empty State */}
            {personas.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-8 py-16">
                <div className="flex flex-col items-center gap-3 text-center">
                  <h2 className="text-[32px] font-semibold text-[var(--colors-gray-900,#0f172a)]">
                    No Personas Yet
                  </h2>
                  <p className="text-[16px] text-[var(--colors-gray-600,#4b5563)]">
                    Start by creating a new persona based on your requirements
                  </p>
                </div>
                
                <StatCard
                  title="Create Persona"
                  value=""
                  className="h-[148px] w-[180px] flex-none !px-4 !py-4"
                >
                  <div className="flex h-full w-full flex-col items-center justify-center gap-6">
                    {/* Avatar Stack */}
                    <div className="flex -space-x-2" style={{ width: '126px', height: '40px' }}>
                      {[1, 2, 3].map((index) => (
                        <div
                          key={index}
                          className="relative h-10 w-10 rounded-full border-2 border-white bg-gradient-to-br from-purple-400 to-pink-400 shadow-md"
                          style={{ zIndex: 4 - index }}
                        >
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                            {index === 1 ? 'P' : index === 2 ? 'A' : 'I'}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Create Persona Button */}
                    <Button
                      size="sm"
                      className="h-10 w-[134px] min-h-[40px] gap-2 rounded-[8px] bg-[var(--general-primary,#171717)] px-1 py-[9.5px] text-white hover:bg-black"
                      onClick={handleCreatePersona}
                    >
                      <Plus className="h-4 w-4" />
                      <span className="text-sm font-medium">Create Persona</span>
                    </Button>
                  </div>
                </StatCard>
              </div>
            ) : (
              <>
                {/* Stats */}
                <div
                  className={`flex w-full flex-nowrap gap-6 overflow-x-auto pb-1 ${chatStyles.customScrollbar}`}
                >
              <StatCard
                title="Tokens Usage"
                value={(totalTokens / 1000000).toFixed(1) + "M"}
                suffix="Tokens"
                change="+12.4%"
                trend="up"
                icon={<BarChart3 className="h-6 w-6 text-[var(--colors-gray-500,#6b7280)]" />}
                className="h-[148px] w-[325px] flex-none"
              />
              <StatCard
                title="Active Consumers"
                value={activeConsumers}
                suffix="Users"
                change="+8.2%"
                trend="up"
                icon={<Users className="h-6 w-6 text-[var(--colors-gray-500,#6b7280)]" />}
                className="h-[148px] w-[325px] flex-none"
              />
              <StatCard
                title="Create Persona"
                value=""
                className="h-[148px] w-[180px] flex-none !px-4 !py-4"
              >
                <div className="flex h-full w-full flex-col items-center justify-center gap-6">
                  {/* Avatar Stack */}
                  <div className="flex -space-x-2" style={{ width: '126px', height: '40px' }}>
                    {MOCK_PERSONAS.slice(0, 3).map((persona, index) => (
                      <div
                        key={persona.id}
                        className="relative h-10 w-10 rounded-full border-2 border-white bg-gradient-to-br from-purple-400 to-pink-400 shadow-md"
                        style={{ zIndex: 3 - index }}
                      >
                        <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                          {persona.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Create Persona Button */}
                  <Button
                    size="sm"
                    className="h-10 w-[134px] min-h-[40px] gap-2 rounded-[8px] bg-[var(--general-primary,#171717)] px-1 py-[9.5px] text-white hover:bg-black"
                    onClick={handleCreatePersona}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">Create Persona</span>
                  </Button>
                </div>
              </StatCard>
            </div>

            {/* Command Center + Table */}
            <CommandCenter
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              className="w-full"
            >
              <div className="mx-auto flex w-full max-w-[1005px] flex-col gap-[15px]">
                <div className="flex h-9 w-full items-center rounded-[8px] border border-[#E5E5E5] bg-[#F5F5F5] px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4B5563]">
                  <div className="w-[60px]"></div>
                  <div className="w-[155px]">Persona Unit</div>
                  <div className="w-[110px] text-right pr-2 ml-3">Token Usage</div>
                  <div className="w-[130px] ml-3">Consumers</div>
                  <div className="w-[95px] ml-3">Status</div>
                  <div className="w-[130px] ml-3">Last Activity</div>
                  <div className="ml-3 flex items-center gap-2">
                    <div className="w-9"></div>
                    <div className="w-8"></div>
                  </div>
                </div>
                <div className="w-full overflow-hidden">
                  <Table className="w-full border-collapse">
                    <TableHeader className="sr-only">
                      <TableRow>
                        <TableHead>Toggle</TableHead>
                        <TableHead>Persona</TableHead>
                        <TableHead>Tokens Used</TableHead>
                        <TableHead>Consumers</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead>Messages</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPersonas.length === 0 ? (
                        <TableRow>
                          <td colSpan={8} className="py-8 text-center text-muted-foreground">
                            No personas found
                          </td>
                        </TableRow>
                      ) : (
                        filteredPersonas.map((persona) => (
                          <PersonaRow
                            key={persona.id}
                            persona={persona}
                            expanded={expandedPersonaIds.includes(persona.id)}
                            onToggleExpand={() => handleToggleExpand(persona.id)}
                            selectedConsumerIds={selectedConsumerIds}
                            onToggleConsumer={handleToggleConsumer}
                            onPause={() => handlePausePersona(persona.id)}
                            onResume={() => handlePausePersona(persona.id)}
                            onDelete={() => handleDeletePersona(persona.id)}
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
            onOpenChange={(open) =>
              setDeleteDialog({ ...deleteDialog, open })
            }
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
