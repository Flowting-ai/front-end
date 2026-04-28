"use client";

import React from "react";
import ReactFlow, {
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Panel,
} from "reactflow";
import "reactflow/dist/style.css";

import TopBar from "../TopBar";
import LeftSidebar from "../LeftSidebar";
import { DocumentNodeInspector } from "../inspectors/DocumentNodeInspector";
import { ChatNodeInspector } from "../inspectors/ChatNodeInspector";
import { PinNodeInspector } from "../inspectors/PinNodeInspector";
import { PersonaNodeInspector } from "../inspectors/PersonaNodeInspector";
import { ModelNodeInspector } from "../inspectors/ModelNodeInspector";
import { EdgeDetailsDialog } from "../dialogs/EdgeDetailsDialog";
import { LoadWorkflowDialog } from "../dialogs/LoadWorkflowDialog";
import { WorkflowChat } from "../chat/WorkflowChat";
import ContextMenu from "./ContextMenu";
import UtilitySection from "./UtilitySection";
import Footer from "./Footer";
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
import CustomNode from "./CustomNode";
import CustomEdge from "./CustomEdge";
import { WorkflowNodeData, WorkflowEdge, WorkflowNode } from "../types";
import { X } from "lucide-react";
import { UpgradePlanDialog } from "@/components/pricing/upgrade-plan-dialog";
import { useWorkflowState } from "@/hooks/use-workflow-state";

const NODE_TYPES = { custom: CustomNode };
const EDGE_TYPES = { default: CustomEdge };

// ─── Inner canvas (must live inside ReactFlowProvider) ───────────────────────

function WorkflowCanvasInner() {
  const reactFlowWrapper = React.useRef<HTMLDivElement>(null);

  const {
    // ReactFlow viewport helpers
    fitView,
    zoomIn,
    zoomOut,
    // Nodes & edges
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    selectedNode,
    selectedEdges,
    // History
    history,
    historyIndex,
    handleUndo,
    handleRedo,
    // Workflow metadata
    workflowName,
    setWorkflowName,
    workflowId,
    saveStatus,
    hasUnsavedChanges,
    isSaving,
    thumbnail,
    setThumbnail,
    setThumbnailFile,
    // Canvas UI preferences
    snapToGrid,
    showMinimap,
    setShowMinimap,
    highlightedNodeType,
    contextMenu,
    setContextMenu,
    // Inspector / panel state
    showInstructions,
    currentInstructionsNodeId,
    instructions,
    setInstructions,
    showDocumentInspector,
    documentNodeId,
    showChatInspector,
    chatNodeId,
    showPinInspector,
    pinNodeId,
    showPersonaInspector,
    personaNodeId,
    showModelInspector,
    modelNodeId,
    showEdgeDetails,
    selectedEdgeForDetails,
    showWorkflowChat,
    setShowWorkflowChat,
    // External API data
    allChats,
    allPins,
    allPersonas,
    allModels,
    // Execution
    isExecuting,
    handleRunStart,
    handleNodeStatusChange,
    // Plan-limit & dialogs
    user,
    showWorkflowUpgradeDialog,
    setShowWorkflowUpgradeDialog,
    showLoadDialog,
    setShowLoadDialog,
    isClearDialogOpen,
    setIsClearDialogOpen,
    showLeaveConfirm,
    setShowLeaveConfirm,
    workflowCount,
    // Derived
    canTestWorkflow,
    testWorkflowDisabledReason,
    // Callbacks — node / edge operations
    onConnect,
    isValidConnection,
    onEdgeClick,
    onDragOver,
    onDragStart,
    addNode,
    onNodeClickFromPalette,
    onDrop,
    onNodeDragStart,
    onNodeDragStop,
    handleUpdateNode,
    handleDeleteNode,
    handleDeleteDocumentNode,
    handleDelete,
    handleDuplicate,
    handleDeleteEdges,
    // Selection / pane
    onNodeClick,
    onPaneClick,
    onPaneContextMenu,
    onNodeContextMenu,
    // Instructions panel
    handleOpenInstructions,
    handleCloseInstructions,
    handleClearInstructions,
    handleSaveInstructions,
    handleSaveAndClose,
    handleTextareaKeyDown,
    // Inspector close / update
    handleCloseDocumentInspector,
    handleUpdateDocumentNode,
    handleCloseChatInspector,
    handleUpdateChatNode,
    handleClosePinInspector,
    handleUpdatePinNode,
    handleClosePersonaInspector,
    handleUpdatePersonaNode,
    handleCloseModelInspector,
    handleUpdateModelNode,
    // Edge details
    handleCloseEdgeDetails,
    // Persistence
    handleSave,
    handleLoadWorkflow,
    handleClear,
    handleConfirmClear,
    handleTest,
    handleRun,
    handleBack,
    handleShare,
  } = useWorkflowState();

  return (
    <div className="w-full h-screen relative bg-[#F2F2F2]">
      {/* Top Bar */}
      <TopBar
        workflowName={workflowName}
        onNameChange={setWorkflowName}
        onBack={handleBack}
        onSave={handleSave}
        onTest={handleTest}
        onRun={handleRun}
        onShare={handleShare}
        workflowId={workflowId}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        isExecuting={isExecuting}
        canTestWorkflow={canTestWorkflow}
        testDisabledReason={testWorkflowDisabledReason}
        saveStatus={saveStatus}
        thumbnail={thumbnail}
        onThumbnailChange={(preview, file) => {
          setThumbnail(preview);
          setThumbnailFile(file ?? null);
        }}
      />

      {/* Main Canvas */}
      <div ref={reactFlowWrapper} className="relative w-full h-full">
        <ReactFlow
          nodes={nodes.map((node) => ({
            ...node,
            data: {
              ...node.data,
              isHighlighted:
                highlightedNodeType === (node.data as WorkflowNodeData).type,
              onOpenInstructions: () => handleOpenInstructions(node.id),
            },
          }))}
          edges={edges.map((edge) => ({
            ...edge,
            type: "default",
            selected: selectedEdges.includes(edge.id),
            data: {
              ...(edge.data as Record<string, unknown>),
              onDeleteEdge: handleDeleteEdges,
            },
            animated: !selectedEdges.includes(edge.id),
          }))}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onNodeClick={onNodeClick}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onDrop={onDrop}
          onDragOver={onDragOver}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          snapToGrid={snapToGrid}
          snapGrid={[20, 20]}
          fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 1.5 }}
          attributionPosition="bottom-right"
          defaultEdgeOptions={{
            style: { strokeWidth: 2, stroke: "#8B8B8B" },
            animated: false,
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={25}
            size={4}
            color="#E4E4E4"
          />
          {showMinimap && nodes.length > 0 && (
            <MiniMap
              className="bottom-10! bg-white! rounded-2xl! shadow-sm! shadow-zinc-400! overflow-hidden!"
              nodeColor={(node) => {
                const data = node.data as WorkflowNodeData;
                switch (data.type) {
                  case "document": return "#B47800";
                  case "chat":     return "#B47800";
                  case "pin":      return "#B47800";
                  case "persona":  return "#3C6CFF";
                  case "model":    return "#3C6CFF";
                  case "start":    return "#16A34A";
                  case "end":      return "#DC2626";
                  default:         return "#9ca3af";
                }
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          )}
        </ReactFlow>

        {/* Instructions Panel */}
        {showInstructions && (
          <div className="z-50 absolute top-4 right-4 bg-white w-90 h-auto border border-[#E5E5E5] rounded-2xl shadow-lg flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-[#1E1E1E]">Instructions</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleClearInstructions}
                  className="cursor-pointer font-geist font-medium text-sm text-[#404040] hover:text-[#1E1E1E] transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleCloseInstructions}
                  className="cursor-pointer text-xs font-medium text-[#404040] hover:text-[#1E1E1E] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <p className="font-normal text-sm text-[#757575]">
              Add instructions to transform, filter, or format the data before it
              reaches the next node.
            </p>

            <textarea
              value={instructions}
              onChange={(e) => handleSaveInstructions(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder={`Press Enter to save and close, or Shift + Enter to insert a new line.\nPlease provide clear, specific, and well-structured instructions to ensure accurate and efficient workflow execution.`}
              className="flex-1 w-full font-geist font-normal text-sm text-[#0A0A0A] border border-[#E5E5E5] rounded-[8px] p-3 placeholder:text-[#9F9F9F] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[180px]"
            />

            <button
              onClick={handleSaveAndClose}
              className="cursor-pointer w-full h-9 rounded-[8px] bg-[#2C2C2C] text-white text-sm font-medium hover:bg-[#1F1F1F] transition-colors"
            >
              Save Instructions
            </button>
          </div>
        )}

        {/* Document Node Inspector */}
        {showDocumentInspector && documentNodeId && (
          <DocumentNodeInspector
            nodeData={nodes.find((n) => n.id === documentNodeId)?.data as WorkflowNodeData}
            onClose={handleCloseDocumentInspector}
            onUpdate={(data) => handleUpdateDocumentNode(documentNodeId, data)}
            onDelete={() => handleDeleteDocumentNode(documentNodeId)}
          />
        )}

        {/* Chat Node Inspector */}
        {showChatInspector && chatNodeId && (
          <ChatNodeInspector
            nodeData={nodes.find((n) => n.id === chatNodeId)?.data as WorkflowNodeData}
            onClose={handleCloseChatInspector}
            onUpdate={(data) => handleUpdateChatNode(chatNodeId, data)}
            onDelete={() => handleDeleteNode(chatNodeId)}
            allChats={allChats}
          />
        )}

        {/* Pin Node Inspector */}
        {showPinInspector && pinNodeId && (
          <PinNodeInspector
            nodeData={nodes.find((n) => n.id === pinNodeId)?.data as WorkflowNodeData}
            onClose={handleClosePinInspector}
            onUpdate={(data) => handleUpdatePinNode(pinNodeId, data)}
            onDelete={() => handleDeleteNode(pinNodeId)}
            allPins={allPins}
          />
        )}

        {/* Persona Node Inspector */}
        {showPersonaInspector && personaNodeId && (
          <PersonaNodeInspector
            nodeData={nodes.find((n) => n.id === personaNodeId)?.data as WorkflowNodeData}
            onClose={handleClosePersonaInspector}
            onUpdate={(data) => handleUpdatePersonaNode(personaNodeId, data)}
            onDelete={() => handleDeleteNode(personaNodeId)}
            allPersonas={allPersonas}
            allModels={allModels}
          />
        )}

        {/* Model Node Inspector */}
        {showModelInspector && modelNodeId && (
          <ModelNodeInspector
            nodeData={nodes.find((n) => n.id === modelNodeId)?.data as WorkflowNodeData}
            onClose={handleCloseModelInspector}
            onUpdate={(data) => handleUpdateModelNode(modelNodeId, data)}
            onDelete={() => handleDeleteNode(modelNodeId)}
            allModels={allModels}
          />
        )}

        {/* Edge Details Dialog */}
        {showEdgeDetails && selectedEdgeForDetails && (
          <EdgeDetailsDialog
            edge={selectedEdgeForDetails as WorkflowEdge}
            nodes={nodes as WorkflowNode[]}
            edges={edges as WorkflowEdge[]}
            onClose={handleCloseEdgeDetails}
            edgeIndex={edges.findIndex((e) => e.id === selectedEdgeForDetails.id)}
          />
        )}
      </div>

      {/* Left Sidebar */}
      <LeftSidebar onDragStart={onDragStart} onNodeClick={onNodeClickFromPalette} />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onAddNode={(type) =>
            addNode(type, { x: contextMenu.x - 120, y: contextMenu.y - 40 })
          }
          onDuplicate={selectedNode ? handleDuplicate : undefined}
          onDelete={
            selectedNode &&
            selectedNode.id !== "start-node" &&
            selectedNode.id !== "end-node"
              ? handleDelete
              : selectedEdges.length > 0
                ? () => handleDeleteEdges(selectedEdges)
                : undefined
          }
          selectedNodeId={selectedNode?.id}
          selectedEdgeIds={selectedEdges}
        />
      )}

      {/* Utility Section */}
      <UtilitySection
        onUndo={handleUndo}
        onRedo={handleRedo}
        onFitView={() => fitView({ duration: 300 })}
        onClear={handleClear}
        onSave={() => void handleSave()}
        onLoad={() => setShowLoadDialog(true)}
        onZoomIn={() => zoomIn({ duration: 300 })}
        onZoomOut={() => zoomOut({ duration: 300 })}
        onToggleMinimap={() => setShowMinimap(!showMinimap)}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        showMinimap={showMinimap}
        saveDisabled={!hasUnsavedChanges}
      />

      {/* Footer */}
      <Footer nodeCount={nodes.length} connectionCount={edges.length} />

      {/* Load Workflow Dialog */}
      {showLoadDialog && (
        <LoadWorkflowDialog
          onClose={() => setShowLoadDialog(false)}
          onLoad={handleLoadWorkflow}
        />
      )}

      {/* Workflow Chat Interface (Test mode overlay) */}
      {showWorkflowChat && (
        <div
          className="fixed right-0 top-0 bottom-0 z-50 animate-slide-in-right"
          style={{ width: "100vw", height: "100vh" }}
        >
          <WorkflowChat
            mode="overlay"
            workflowId={workflowId || "temp"}
            workflowName={workflowName}
            onClose={() => setShowWorkflowChat(false)}
            selectedModel={null}
            onRunStart={handleRunStart}
            onNodeStatusChange={handleNodeStatusChange}
          />
        </div>
      )}

      {/* Clear Workflow Confirmation Dialog */}
      <AlertDialog
        open={isClearDialogOpen}
        onOpenChange={(open) => {
          if (!open) setIsClearDialogOpen(false);
        }}
      >
        <AlertDialogContent className="rounded-[8px] bg-white border border-[#D4D4D4]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black">
              Clear entire workflow?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B7280]">
              This action removes all nodes and connections from the canvas. Only
              Start and End nodes will remain. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-[8px] bg-white border border-[#D4D4D4] text-black hover:bg-[#f5f5f5]"
              onClick={() => setIsClearDialogOpen(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[8px] bg-white border border-[#D4D4D4] text-red-600 hover:bg-[#f5f5f5]"
              onClick={handleConfirmClear}
            >
              Clear workflow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave with unsaved changes */}
      <AlertDialog
        open={showLeaveConfirm}
        onOpenChange={(open) => {
          if (!open) setShowLeaveConfirm(false);
        }}
      >
        <AlertDialogContent className="rounded-[8px] bg-white border-main-border border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black">
              Unsaved changes
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B7280]">
              You have unsaved changes. Do you want to save before leaving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-[8px] bg-white border border-[#D4D4D4] text-black hover:bg-[#f5f5f5]"
              onClick={() => setShowLeaveConfirm(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-[8px] bg-white border border-[#D4D4D4] text-black hover:bg-[#f5f5f5]"
              onClick={() => {
                setShowLeaveConfirm(false);
                // router is not available here — handleBack owns navigation
                window.location.href = "/workflows/admin";
              }}
            >
              Don&apos;t save
            </AlertDialogAction>
            <AlertDialogAction
              className="rounded-[8px] text-white bg-zinc-600 hover:bg-[#0A0A0A]"
              onClick={async () => {
                const saved = await handleSave();
                if (saved) {
                  setShowLeaveConfirm(false);
                  window.location.href = "/workflows/admin";
                }
              }}
            >
              Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Workflow plan-limit upgrade dialog */}
      {user?.planType && (
        <UpgradePlanDialog
          open={showWorkflowUpgradeDialog}
          onOpenChange={setShowWorkflowUpgradeDialog}
          currentPlan={user.planType}
          resource="workflows"
          currentCount={workflowCount}
        />
      )}
    </div>
  );
}

// ─── Public component (wraps inner in ReactFlowProvider) ─────────────────────

export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
