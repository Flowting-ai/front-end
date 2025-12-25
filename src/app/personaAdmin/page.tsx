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
} from "lucide-react";

// Mock data
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
                {/* 
                  RESPONSIVE BEHAVIOR: Stat Cards
                  - Mobile (< 768px): flex-col stacks cards vertically, no horizontal scroll
                  - Tablet/Desktop (>= 768px): md:flex-row arranges cards horizontally with md:overflow-x-auto for scrolling if needed
                  - This ensures mobile users see all cards without horizontal scrolling
                  - Container width matches table: md:max-w-[1200px] lg:max-w-[1400px] for alignment
                */}
                <div className="mx-auto w-full md:max-w-[1200px] lg:max-w-[1400px]">
                  <div
                    className="flex w-full flex-col md:flex-row md:flex-nowrap gap-6 md:overflow-x-auto pb-1"
                  >
              <StatCard
                title="Tokens Usage"
                value={(totalTokens / 1000000).toFixed(1) + "M"}
                suffix="Tokens"
                className="h-[148px] w-[325px] flex-none !p-0"
              >
                <div className="relative flex h-full w-full flex-col">
                  <div className="flex flex-col ml-[14px] mt-[14px]">
                    <p className="text-[16px] font-semibold leading-[140%] tracking-tight text-[var(--colors-gray-900,#0f172a)]" style={{ fontFamily: 'Inter', fontWeight: 600 }}>
                      Tokens Usage
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ml-[14px] pt-2">
                    <div className="flex items-baseline gap-2">
                      <p className="text-[32px] font-normal leading-[120%] text-[var(--colors-gray-900,#0f172a)]" style={{ fontFamily: 'Inter', fontWeight: 400 }}>
                        {(totalTokens / 1000000).toFixed(1) + "M"}
                      </p>
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--colors-gray-500,#6b7280)]">
                        Tokens
                      </span>
                    </div>
                  </div>
                  <button className="absolute bottom-[14px] left-[14px] inline-flex h-[26px] min-h-[24px] w-[161px] items-center justify-center gap-1.5 rounded-[8px] border border-[var(--general-border,#e5e5e5)] bg-white px-2 py-[3px] text-xs font-medium text-black transition-colors hover:bg-gray-100">
                    <TrendingUp className="h-3 w-3" />
                    +12.4% vs last period
                  </button>
                </div>
              </StatCard>
              <StatCard
                title="Active Consumers"
                value={activeConsumers}
                suffix="Users"
                className="h-[148px] w-[325px] flex-none !p-0"
              >
                <div className="relative flex h-full w-full flex-col">
                  <div className="flex flex-col ml-[14px] mt-[14px]">
                    <p className="text-[16px] font-semibold leading-[140%] tracking-tight text-[var(--colors-gray-900,#0f172a)]" style={{ fontFamily: 'Inter', fontWeight: 600 }}>
                      Active Consumers
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 ml-[14px] pt-2">
                    <div className="flex items-baseline gap-2">
                      <p className="text-[32px] font-normal leading-[120%] text-[var(--colors-gray-900,#0f172a)]" style={{ fontFamily: 'Inter', fontWeight: 400 }}>
                        {activeConsumers}
                      </p>
                      <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--colors-gray-500,#6b7280)]">
                        Users
                      </span>
                    </div>
                  </div>
                  {/* Avatar Stack */}
                  <div className="absolute bottom-[14px] left-[14px] flex -space-x-2">
                    {personas
                      .filter(p => p.status === 'active')
                      .flatMap(p => p.consumers.filter(c => c.status === 'active'))
                      .slice(0, 4)
                      .map((consumer, index) => (
                        <div
                          key={consumer.id}
                          className="h-8 w-8 rounded-full border-2 border-white shadow-md"
                          style={{ zIndex: 4 - index, opacity: 1 }}
                        >
                          {consumer.avatar ? (
                            <img 
                              src={consumer.avatar} 
                              alt={consumer.name}
                              className="h-full w-full rounded-full object-cover"
                              style={{ opacity: 1 }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-indigo-400 text-xs font-semibold text-white">
                              {consumer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </StatCard>
              <StatCard
                title="Create Persona"
                value=""
                className="h-[148px] w-[180px] flex-none !px-4 !py-4"
              >
                <div className="flex h-full w-full flex-col items-center justify-center gap-6">
                  {/* Avatar Stack */}
                  <div className="relative top-4 left-2 flex -space-x-2" style={{ width: '126px', height: '40px' }}>
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
                  
                  {/* Create Persona Button inside the card on row 1*/}
                  <Button
                    size="sm"
                    className="mt-4 h-10 w-[150px] min-h-[40px] gap-2 rounded-[8px] bg-[var(--general-primary,#171717)] px-1 py-[9.5px] text-white hover:bg-black"
                    onClick={handleCreatePersona}
                  >
                    {/* <Plus className="h-4 w-4" /> */}
                    <span className="text-sm font-medium">Create Persona</span>
                  </Button>
                </div>
              </StatCard>
            </div>
                </div>

            {/* Command Center + Table */}
            {/* 
              RESPONSIVE TABLE STRUCTURE:
              
              Parent Container:
              - Mobile: overflow-x-auto allows horizontal scrolling for full table content
              - Desktop: md:overflow-x-visible removes scrollbar, md:max-w-[1200px] lg:max-w-[1400px] centers content
              
              Table Width:
              - Mobile: w-fit makes table width match content exactly (no empty space after Actions column)
              - Desktop: md:w-full makes table expand to fill container width
              
              Breakpoints used:
              - xs: < 640px (mobile)
              - sm: >= 640px (large mobile)
              - md: >= 768px (tablet)
              - lg: >= 1024px (laptop)
              - xl: >= 1280px (desktop)
            */}
            <CommandCenter
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              className="w-full"
            >
              <div className="mx-auto flex w-full md:max-w-[1200px] lg:max-w-[1400px] flex-col overflow-x-auto md:overflow-x-visible">
                <div className={`w-fit md:w-full ${chatStyles.customScrollbar}`}>
                  <Table className="w-fit md:w-full border-collapse">
                    <TableHeader>
                      <TableRow className="!border-0 border-none h-9 rounded-[8px] border border-[#E5E5E5] bg-[#F5F5F5] hover:bg-[#F5F5F5]">
                        <TableHead colSpan={8} className="p-0 h-9">
                          {/* 
                            RESPONSIVE HEADER ROW:
                            - Mobile: w-fit makes header match content width
                            - Desktop: md:w-full makes header expand to container width
                            - Each column uses responsive width classes that match data rows exactly
                          */}
                          <div className="flex w-fit md:w-full items-center h-full text-[11px] font-semibold uppercase tracking-[0.12em] text-[#4B5563]">
                            {/* Spacer - Responsive: 8px -> 10px -> 12px */}
                            <div className="w-2 md:w-2.5 lg:w-3 flex-shrink-0"></div>
                            
                            {/* Persona Unit - Responsive: 140px -> 160px -> 170px -> 180px -> 190px */}
                            <div className="w-[140px] sm:w-[160px] md:w-[170px] lg:w-[180px] xl:w-[190px] flex-shrink-0 text-center">Persona Unit</div>
                            
                            {/* Token Usage - Responsive: 70px -> 80px -> 100px -> 110px */}
                            <div className="w-[70px] sm:w-[80px] md:w-[100px] lg:w-[110px] flex-shrink-0 text-center">Token Usage</div>
                            
                            {/* Consumers - Responsive: 90px -> 100px -> 130px -> 150px -> 180px */}
                            <div className="w-[90px] sm:w-[100px] md:w-[130px] lg:w-[150px] xl:w-[180px] flex-shrink-0 text-center">Consumers</div>
                            
                            {/* Status - Responsive: 75px -> 85px -> 95px -> 100px */}
                            <div className="w-[75px] sm:w-[85px] md:w-[95px] lg:w-[100px] flex-shrink-0 text-center">Status</div>
                            
                            {/* Last Activity - Responsive: 80px -> 100px -> 120px -> 130px */}
                            <div className="w-[80px] sm:w-[100px] md:w-[120px] lg:w-[130px] flex-shrink-0 text-center">Last Activity</div>
                            
                            {/* Actions - Responsive: 80px -> 90px -> 100px -> 110px */}
                            <div className="w-[80px] sm:w-[90px] md:w-[100px] lg:w-[110px] flex-shrink-0 text-center">Actions</div>
                          </div>
                        </TableHead>
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
                          <PersonaWrapper
                            key={persona.id}
                            persona={persona}
                            expanded={expandedPersonaIds.includes(persona.id)}
                            onToggleExpand={() => handleToggleExpand(persona.id)}
                            selectedConsumerIds={selectedConsumerIds}
                            onToggleConsumer={handleToggleConsumer}
                            onPause={() => handlePausePersona(persona.id)}
                            onResume={() => handlePausePersona(persona.id)}
                            onDelete={() => handleDeletePersona(persona.id)}
                            onModifyConfig={() => router.push(`/personas/new/configure?personaId=${persona.id}`)}
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
