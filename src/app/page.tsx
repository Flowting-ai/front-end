
'use client';

import { useContext } from 'react';
import type { Message } from '@/components/chat/chat-message';
import { ChatInterface } from '@/components/chat/chat-interface';
import { AppLayoutContext } from '@/context/app-layout-context';

// Main page component
export default function Home() {
  const context = useContext(AppLayoutContext);
  if (!context) {
    throw new Error('Home component must be used within an AppLayoutProvider');
  }

  const { 
    activeChatId, // Using this to decide which view to show
  } = context;

  // The actual rendering logic is now handled within AppLayout
  // This component can be simplified or used for other page-specific logic if needed.
  return null;
}
