"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/Button";
import type { AIModel } from "@/types/ai-model";
import { getModelIcon } from "@/lib/model-icons";

interface ModelSwitchDialogProps {
  isOpen: boolean;
  fromModel: AIModel | null;
  toModel: AIModel | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ModelSwitchDialog({
  isOpen,
  fromModel,
  toModel,
  onConfirm,
  onCancel,
}: ModelSwitchDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && fromModel && toModel && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              backgroundColor: "rgba(0,0,0,0.4)",
            }}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            role="alertdialog"
            aria-labelledby="model-switch-title"
            aria-describedby="model-switch-desc"
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 61,
              width: "400px",
              maxWidth: "calc(100vw - 32px)",
              backgroundColor: "var(--neutral-white)",
              borderRadius: "16px",
              boxShadow: "var(--shadow-xl)",
              padding: "24px",
            }}
          >
            {/* Warning icon */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                backgroundColor: "var(--yellow-50)",
                marginBottom: "16px",
              }}
            >
              <AlertTriangle size={20} style={{ color: "var(--yellow-600)" }} />
            </div>

            <h3
              id="model-switch-title"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--font-size-body-lg)",
                fontWeight: "var(--font-weight-semibold)",
                color: "var(--neutral-900)",
                margin: "0 0 8px",
              }}
            >
              Switch model mid-chat?
            </h3>

            <p
              id="model-switch-desc"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--font-size-body-sm)",
                color: "var(--neutral-600)",
                lineHeight: 1.5,
                margin: "0 0 20px",
              }}
            >
              Switching from{" "}
              <strong>{fromModel.modelName}</strong> to{" "}
              <strong>{toModel.modelName}</strong>. Your conversation history
              will be preserved, but the new model may respond differently.
            </p>

            {/* Model comparison */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px",
                borderRadius: "10px",
                backgroundColor: "var(--neutral-50)",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                <img
                  src={getModelIcon(fromModel.companyName, fromModel.modelName)}
                  alt=""
                  width={20}
                  height={20}
                  style={{ borderRadius: "4px" }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                    color: "var(--neutral-600)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {fromModel.modelName}
                </span>
              </div>

              <span style={{ color: "var(--neutral-400)", fontSize: "14px" }}>→</span>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                <img
                  src={getModelIcon(toModel.companyName, toModel.modelName)}
                  alt=""
                  width={20}
                  height={20}
                  style={{ borderRadius: "4px" }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                    color: "var(--neutral-900)",
                    fontWeight: "var(--font-weight-medium)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {toModel.modelName}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={onConfirm}>
                Switch Model
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
