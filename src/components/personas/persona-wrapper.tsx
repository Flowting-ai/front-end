"use client";

import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Pause, Trash2 } from "lucide-react";
import { UnifiedRow, Persona, Consumer } from "./unified-row";

export interface PersonaWrapperProps {
  persona: Persona;
  expanded?: boolean;
  onToggleExpand?: () => void;
  selectedConsumerIds?: string[];
  onToggleConsumer?: (consumerId: string) => void;
  onPause?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
  onModifyConfig?: () => void;
  onSelectAllConsumers?: () => void;
  onPauseAllConsumers?: () => void;
  onDeleteAllConsumers?: () => void;
}

export const PersonaWrapper = React.forwardRef<HTMLTableRowElement, PersonaWrapperProps>(
  (
    {
      persona,
      expanded = false,
      onToggleExpand,
      selectedConsumerIds = [],
      onToggleConsumer,
      onPause,
      onResume,
      onDelete,
      onModifyConfig,
      onSelectAllConsumers,
      onPauseAllConsumers,
      onDeleteAllConsumers,
    },
    ref
  ) => {
    const allConsumersSelected =
      persona.consumers.length > 0 &&
      persona.consumers.every((c) => selectedConsumerIds.includes(c.id));

    const someConsumersSelected =
      !allConsumersSelected &&
      persona.consumers.some((c) => selectedConsumerIds.includes(c.id));

    const personaConsumerIds = persona.consumers.map((consumer) => consumer.id);
    const selectedConsumersForPersona = personaConsumerIds.filter((id) => selectedConsumerIds.includes(id));
    const hasSelectedConsumers = selectedConsumersForPersona.length > 0;

    const handleSelectAllConsumersClick = () => {
      if (onSelectAllConsumers) {
        onSelectAllConsumers();
        return;
      }
      if (!onToggleConsumer) return;
      persona.consumers.forEach((consumer) => {
        if (!selectedConsumerIds.includes(consumer.id)) {
          onToggleConsumer(consumer.id);
        }
      });
    };

    const handlePauseAllConsumersClick = () => {
      onPauseAllConsumers?.();
    };

    const handleDeleteAllConsumersClick = () => {
      onDeleteAllConsumers?.();
    };

    return (
      <>
        <UnifiedRow
          ref={ref}
          variant="persona"
          id={persona.id}
          name={persona.name}
          description={persona.description}
          avatar={persona.avatar}
          tokensUsed={persona.tokensUsed}
          status={persona.status}
          lastActivity={persona.lastActivity}
          consumersCount={persona.consumersCount}
          consumers={persona.consumers}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onPause={onPause}
          onResume={onResume}
          onDelete={onDelete}
          onModifyConfig={onModifyConfig}
          selectedConsumerIds={selectedConsumerIds}
          onToggleConsumer={onToggleConsumer}
          onSelectAllConsumers={onSelectAllConsumers}
          onPauseAllConsumers={onPauseAllConsumers}
          onDeleteAllConsumers={onDeleteAllConsumers}
        />
        
        {expanded && persona.consumers.length > 0 && (
          <>
            <TableRow className="bg-[#F5F5F5] !border-0 border-none">
              <TableCell
                colSpan={8}
                className="!border-0 border-none bg-[#F5F5F5] p-0 align-top"
              >
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2">
                    <div className="space-y-0.5">
                      <p className="text-[13px] font-semibold text-[#111827]">Resource Consumers</p>
                      <p className="text-[12px] text-[#6B7280]">
                        {persona.consumers.length} {persona.consumers.length === 1 ? "user" : "users"} connected
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 text-[12px] font-medium text-[#374151] transition-colors hover:text-[#F59E0B]",
                          !hasSelectedConsumers && "pointer-events-none opacity-40"
                        )}
                        onClick={handlePauseAllConsumersClick}
                      >
                        <Pause className="h-[14px] w-[14px]" />
                        <span>Pause all</span>
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-1.5 text-[12px] font-medium text-[#374151] transition-colors hover:text-[#EF4444]",
                          !hasSelectedConsumers && "pointer-events-none opacity-40"
                        )}
                        onClick={handleDeleteAllConsumersClick}
                      >
                        <Trash2 className="h-[14px] w-[14px]" />
                        <span>Delete all</span>
                      </button>
                      <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-[#374151]">
                        <Checkbox
                          checked={allConsumersSelected ? true : someConsumersSelected ? "indeterminate" : false}
                          onCheckedChange={handleSelectAllConsumersClick}
                          className="h-[14px] w-[14px] rounded-[4px] border border-[#D4D4D4] data-[state=checked]:border-[#6366F1] data-[state=checked]:bg-[#6366F1]"
                          style={{ 
                            opacity: 1, 
                            top: '1px', 
                            left: '1px',
                            boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)'
                          }}
                        />
                        Select all
                      </label>
                    </div>
                  </div>
                </div>
              </TableCell>
            </TableRow>
            {persona.consumers.map((consumer) => (
              <UnifiedRow
                key={consumer.id}
                variant="consumer"
                id={consumer.id}
                name={consumer.name}
                email={consumer.email}
                avatar={consumer.avatar}
                tokensUsed={consumer.tokensUsed}
                status={consumer.status}
                lastActivity={consumer.lastActivity}
                selected={selectedConsumerIds.includes(consumer.id)}
                onToggle={() => onToggleConsumer?.(consumer.id)}
                onPause={onPause}
                onResume={onResume}
                onDelete={onDelete}
              />
            ))}
          </>
        )}
      </>
    );
  }
);

PersonaWrapper.displayName = "PersonaWrapper";
