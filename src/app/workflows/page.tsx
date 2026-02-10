'use client';

import React, { Suspense } from 'react';
import WorkflowCanvas from '@/components/workflows/WorkflowCanvas';

export default function WorkflowPage() {
  return (
    <Suspense fallback={null}>
      <WorkflowCanvas />
    </Suspense>
  );
}
