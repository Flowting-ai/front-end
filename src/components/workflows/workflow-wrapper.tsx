"use client";

import * as React from "react";
import { WorkflowRow, type WorkflowItem, type WorkflowRowProps } from "./workflow-row";

export type { WorkflowItem };

export interface WorkflowWrapperProps extends Omit<WorkflowRowProps, 'workflow'> {
  workflow: WorkflowItem;
}

export const WorkflowWrapper = React.forwardRef<HTMLTableRowElement, WorkflowWrapperProps>(
  ({ workflow, ...rowProps }, ref) => {
    return <WorkflowRow ref={ref} workflow={workflow} {...rowProps} />;
  }
);

WorkflowWrapper.displayName = "WorkflowWrapper";
