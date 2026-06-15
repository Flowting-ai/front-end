'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { m, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  SearchOneIcon,
  FolderAddIcon,
  FolderOneIcon,
  SidebarLeftIcon,
  MoreHorizontalIcon,
  BubbleChatIcon,
  UserAiIcon,
  NeuralNetworkIcon,
  CalendarThreeIcon,
  AlertTwoIcon,
  UserAddOneIcon,
  TokenCircleIcon,
  SettingsOneIcon,
  ShapesOneIcon,
  AuditTwoIcon,
  LinkSixIcon,
  PlayListIcon,
  ExchangeOneIcon,
  GlobalSearchIcon,
  RadarThreeIcon,
  BrainTwoIcon,
  ViewIcon,
  DashboardSquareOneIcon,
} from '@strange-huge/icons'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { SidebarProjectsSection } from '@/components/SidebarProjectsSection'
import { IconButton } from '@/components/IconButton'
import { Tooltip } from '@/components/Tooltip'
import { AccountMenu } from '@/components/AccountMenu'
import { OrgBadge } from '@/components/OrgBadge'
import type { ChipColor } from '@/components/Chip'

// ── Souvenir wordmark SVG (115×20px) ──────────────────────────────────────────

function SouvenirWordmark() {
  return (
    <svg
      width="115"
      height="20"
      viewBox="0 0 115 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Souvenir"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path d="M105.65 8.36C105.65 8.16 105.62 8.02 105.56 7.96C105.51 7.90 105.38 7.86 105.19 7.86H103.73C103.54 7.86 103.43 7.83 103.40 7.77C103.36 7.70 103.35 7.58 103.35 7.39V6.73C103.35 6.55 103.37 6.42 103.41 6.36C103.46 6.30 103.58 6.27 103.76 6.27H107.85C107.99 6.27 108.10 6.29 108.18 6.34C108.26 6.37 108.3 6.47 108.3 6.64V7.94C108.3 8.16 108.31 8.28 108.35 8.31C108.39 8.34 108.46 8.25 108.56 8.04C108.89 7.45 109.33 6.96 109.88 6.57C110.44 6.17 111.16 5.98 112.04 5.98C112.83 5.98 113.51 6.20 114.10 6.66C114.70 7.11 115 7.73 115 8.53C115 8.90 114.92 9.25 114.77 9.58C114.62 9.90 114.41 10.16 114.14 10.36C113.87 10.56 113.56 10.65 113.21 10.65C112.71 10.65 112.30 10.53 111.97 10.27C111.63 10.01 111.47 9.66 111.47 9.23C111.47 8.91 111.52 8.66 111.62 8.49C111.72 8.31 111.82 8.17 111.93 8.07C112.03 7.96 112.08 7.86 112.08 7.76C112.08 7.64 112.03 7.55 111.93 7.49C111.83 7.43 111.65 7.40 111.36 7.40C110.81 7.40 110.30 7.64 109.84 8.11C109.39 8.57 109.03 9.19 108.77 9.96C108.50 10.72 108.37 11.54 108.37 12.42V17.50C108.37 17.69 108.39 17.83 108.44 17.91C108.48 17.97 108.60 18.01 108.79 18.01H110.34C110.50 18.01 110.60 18.04 110.62 18.11C110.66 18.17 110.67 18.28 110.67 18.44V19.19C110.67 19.34 110.65 19.45 110.61 19.51C110.58 19.57 110.48 19.60 110.33 19.60H103.73C103.60 19.60 103.50 19.58 103.44 19.55C103.38 19.51 103.35 19.44 103.35 19.32V18.37C103.35 18.22 103.37 18.13 103.42 18.09C103.48 18.03 103.58 18.01 103.72 18.01H105.11C105.31 18.01 105.44 17.98 105.52 17.93C105.61 17.87 105.65 17.75 105.65 17.56V8.36Z" fill="var(--neutral-700)"/>
      <path d="M96.32 1.70C96.32 1.21 96.49 0.81 96.83 0.48C97.18 0.16 97.60 0 98.07 0C98.55 0 98.96 0.16 99.30 0.48C99.64 0.81 99.81 1.21 99.81 1.70C99.81 2.18 99.64 2.58 99.30 2.90C98.96 3.23 98.55 3.39 98.07 3.39C97.60 3.39 97.18 3.23 96.83 2.90C96.49 2.58 96.32 2.18 96.32 1.70ZM96.54 7.86H94.81C94.69 7.86 94.60 7.84 94.57 7.81C94.54 7.77 94.53 7.69 94.53 7.57V6.61C94.53 6.38 94.64 6.27 94.85 6.27H99.31C99.42 6.27 99.48 6.29 99.51 6.32C99.54 6.36 99.56 6.43 99.56 6.54V17.70C99.56 17.81 99.57 17.89 99.61 17.95C99.65 17.99 99.72 18.01 99.83 18.01H101.55C101.67 18.01 101.75 18.02 101.8 18.05C101.84 18.07 101.86 18.15 101.86 18.28V19.28C101.86 19.41 101.85 19.49 101.82 19.53C101.8 19.58 101.72 19.60 101.59 19.60H94.92C94.77 19.60 94.67 19.58 94.61 19.55C94.56 19.51 94.53 19.43 94.53 19.29V18.39C94.53 18.22 94.56 18.12 94.62 18.07C94.68 18.03 94.79 18.01 94.94 18.01H96.53C96.67 18.01 96.76 17.99 96.78 17.95C96.82 17.89 96.83 17.80 96.83 17.66V8.17C96.83 7.96 96.74 7.86 96.54 7.86Z" fill="var(--neutral-700)"/>
      <path d="M78.87 7.86H77.24C77.11 7.86 77.02 7.84 76.98 7.78C76.94 7.73 76.92 7.63 76.92 7.49V6.62C76.92 6.49 76.95 6.40 76.99 6.35C77.04 6.30 77.12 6.27 77.24 6.27H81.44C81.59 6.27 81.70 6.32 81.77 6.41C81.84 6.50 81.87 6.61 81.87 6.75V8.11C81.87 8.43 81.90 8.59 81.95 8.58C82.00 8.57 82.07 8.49 82.17 8.35C82.58 7.68 83.14 7.12 83.84 6.67C84.55 6.21 85.45 5.98 86.55 5.98C87.63 5.98 88.47 6.14 89.08 6.45C89.70 6.77 90.13 7.23 90.39 7.85C90.64 8.46 90.77 9.23 90.77 10.14V17.43C90.77 17.66 90.79 17.82 90.84 17.89C90.89 17.97 91.03 18.01 91.26 18.01H92.73C92.87 18.01 92.97 18.04 93.01 18.10C93.05 18.15 93.07 18.25 93.07 18.41V19.26C93.07 19.43 93.04 19.53 92.97 19.56C92.91 19.59 92.80 19.60 92.63 19.60H86.19C86.05 19.60 85.96 19.57 85.93 19.51C85.90 19.44 85.89 19.33 85.89 19.18V18.41C85.89 18.26 85.90 18.16 85.94 18.10C85.98 18.04 86.08 18.01 86.22 18.01H87.52C87.74 18.01 87.88 17.98 87.95 17.93C88.01 17.87 88.05 17.73 88.05 17.51V10.44C88.05 9.53 87.87 8.84 87.50 8.37C87.14 7.90 86.57 7.66 85.79 7.66C85.03 7.66 84.36 7.87 83.78 8.28C83.20 8.69 82.75 9.25 82.42 9.96C82.11 10.67 81.95 11.47 81.95 12.35V17.48C81.95 17.68 81.99 17.82 82.06 17.89C82.14 17.97 82.28 18.01 82.47 18.01H83.65C83.83 18.01 83.95 18.03 84.01 18.09C84.08 18.14 84.11 18.26 84.11 18.44V19.20C84.11 19.36 84.08 19.47 84.02 19.52C83.97 19.57 83.87 19.60 83.71 19.60H77.28C77.12 19.60 77.02 19.57 76.98 19.51C76.94 19.45 76.92 19.34 76.92 19.18V18.43C76.92 18.25 76.96 18.14 77.03 18.09C77.10 18.03 77.21 18.01 77.38 18.01H78.75C78.94 18.01 79.06 17.99 79.12 17.96C79.19 17.92 79.23 17.80 79.23 17.62V8.13C79.23 8.01 79.20 7.94 79.14 7.91C79.09 7.88 79.00 7.86 78.87 7.86Z" fill="var(--neutral-700)"/>
      <path d="M63.10 13.19C63.10 11.83 63.34 10.60 63.81 9.51C64.28 8.43 64.99 7.57 65.93 6.94C66.88 6.30 68.06 5.98 69.48 5.98C70.37 5.98 71.14 6.11 71.79 6.38C72.43 6.64 72.98 7.00 73.41 7.46C73.85 7.92 74.21 8.43 74.47 9.01C74.74 9.59 74.92 10.19 75.03 10.81C75.15 11.43 75.21 12.05 75.21 12.65C75.21 12.82 75.18 12.93 75.12 12.97C75.06 13.02 74.94 13.04 74.75 13.04H66.53C66.39 13.04 66.28 13.06 66.21 13.11C66.15 13.17 66.12 13.26 66.12 13.41C66.13 14.30 66.25 15.13 66.48 15.90C66.72 16.66 67.09 17.28 67.60 17.75C68.12 18.21 68.80 18.44 69.64 18.44C70.60 18.44 71.40 18.18 72.03 17.64C72.66 17.10 73.15 16.38 73.49 15.47C73.52 15.38 73.55 15.31 73.59 15.25C73.63 15.19 73.72 15.16 73.84 15.16H74.87C75.00 15.16 75.08 15.19 75.11 15.23C75.15 15.27 75.16 15.34 75.14 15.45C74.89 16.34 74.51 17.13 74.01 17.79C73.52 18.46 72.88 18.97 72.09 19.34C71.32 19.71 70.39 19.89 69.31 19.89C67.96 19.89 66.82 19.59 65.90 18.97C64.98 18.35 64.28 17.53 63.81 16.51C63.34 15.49 63.10 14.39 63.10 13.19ZM66.53 11.72H71.91C72.08 11.72 72.19 11.71 72.22 11.68C72.26 11.65 72.28 11.59 72.27 11.49C72.27 11.08 72.21 10.63 72.09 10.16C71.98 9.67 71.81 9.21 71.58 8.78C71.35 8.35 71.06 7.99 70.71 7.72C70.36 7.45 69.94 7.31 69.46 7.31C68.73 7.31 68.12 7.52 67.63 7.93C67.15 8.34 66.79 8.85 66.56 9.48C66.32 10.10 66.19 10.73 66.19 11.37C66.18 11.51 66.19 11.60 66.22 11.65C66.27 11.70 66.37 11.72 66.53 11.72Z" fill="var(--neutral-700)"/>
      <path d="M55.54 15.47L58.25 8.28C58.32 8.11 58.33 8.00 58.28 7.95C58.23 7.89 58.11 7.86 57.89 7.86H56.55C56.33 7.86 56.22 7.74 56.22 7.49V6.62C56.22 6.51 56.24 6.42 56.28 6.36C56.32 6.30 56.41 6.27 56.52 6.27H61.61C61.78 6.27 61.90 6.30 61.96 6.35C62.02 6.39 62.05 6.51 62.05 6.70V7.55C62.05 7.69 62.02 7.78 61.97 7.81C61.92 7.84 61.82 7.86 61.68 7.86H60.39C60.20 7.86 60.09 7.89 60.05 7.95C60.02 8.00 59.98 8.09 59.93 8.22L55.50 19.61C55.47 19.72 55.41 19.79 55.34 19.82C55.26 19.85 55.14 19.87 54.98 19.87H54.25C54.10 19.87 53.98 19.85 53.90 19.82C53.84 19.79 53.78 19.73 53.74 19.62L49.12 8.13C49.07 8.00 49.00 7.93 48.92 7.90C48.84 7.87 48.71 7.86 48.53 7.86H47.18C47.06 7.86 46.97 7.84 46.92 7.78C46.88 7.73 46.86 7.66 46.86 7.55V6.71C46.86 6.52 46.90 6.40 46.99 6.35C47.07 6.30 47.20 6.27 47.37 6.27H53.87C54.00 6.27 54.09 6.30 54.13 6.35C54.18 6.39 54.21 6.49 54.21 6.63V7.46C54.21 7.66 54.17 7.78 54.10 7.81C54.03 7.84 53.89 7.86 53.70 7.86H52.48C52.29 7.86 52.17 7.89 52.14 7.95C52.11 8.01 52.13 8.11 52.18 8.25L54.72 15.43C54.82 15.69 54.89 15.90 54.94 16.07C55.00 16.24 55.06 16.32 55.12 16.32C55.18 16.32 55.24 16.24 55.30 16.09C55.37 15.93 55.45 15.73 55.54 15.47Z" fill="var(--neutral-700)"/>
      <path d="M33.21 15.73V8.30C33.21 8.13 33.19 8.01 33.15 7.95C33.11 7.89 33.01 7.86 32.86 7.86H31.37C31.20 7.86 31.08 7.84 31.01 7.81C30.95 7.77 30.91 7.66 30.91 7.49V6.75C30.91 6.55 30.94 6.42 30.99 6.36C31.05 6.30 31.18 6.27 31.37 6.27H35.45C35.65 6.27 35.78 6.29 35.83 6.34C35.90 6.38 35.94 6.50 35.94 6.68V15.43C35.94 16.34 36.12 17.07 36.47 17.61C36.84 18.16 37.41 18.43 38.19 18.43C38.95 18.43 39.62 18.21 40.2 17.77C40.77 17.31 41.23 16.72 41.55 15.97C41.87 15.22 42.04 14.40 42.04 13.52V8.31C42.04 8.11 41.99 7.98 41.91 7.94C41.83 7.89 41.70 7.86 41.51 7.86H40.18C40.05 7.86 39.96 7.85 39.89 7.82C39.83 7.79 39.80 7.71 39.80 7.59V6.66C39.80 6.51 39.82 6.41 39.85 6.36C39.89 6.30 39.99 6.27 40.13 6.27H44.44C44.59 6.27 44.67 6.30 44.71 6.36C44.74 6.41 44.76 6.52 44.76 6.67V17.56C44.76 17.76 44.79 17.88 44.84 17.93C44.89 17.98 45.02 18.01 45.22 18.01H46.64C46.77 18.01 46.87 18.03 46.95 18.07C47.02 18.11 47.06 18.19 47.06 18.33V19.16C47.06 19.33 47.04 19.45 47.01 19.51C46.98 19.57 46.87 19.60 46.70 19.60H42.55C42.35 19.60 42.23 19.57 42.18 19.51C42.13 19.44 42.10 19.30 42.10 19.10V17.65C42.10 17.55 42.07 17.48 42.01 17.43C41.95 17.38 41.87 17.44 41.77 17.60C41.37 18.27 40.82 18.82 40.13 19.25C39.44 19.68 38.54 19.89 37.42 19.89C36.35 19.89 35.52 19.73 34.90 19.42C34.29 19.10 33.85 18.64 33.60 18.02C33.34 17.41 33.21 16.64 33.21 15.73Z" fill="var(--neutral-700)"/>
      <path d="M20.05 12.68C20.05 13.71 20.13 14.67 20.30 15.56C20.47 16.45 20.79 17.17 21.25 17.71C21.72 18.26 22.39 18.53 23.26 18.53C23.91 18.53 24.45 18.38 24.87 18.07C25.29 17.77 25.61 17.36 25.84 16.84C26.08 16.32 26.24 15.75 26.33 15.11C26.42 14.48 26.47 13.84 26.47 13.19C26.47 12.16 26.38 11.20 26.21 10.31C26.04 9.42 25.72 8.70 25.25 8.16C24.79 7.61 24.13 7.34 23.26 7.34C22.61 7.34 22.07 7.49 21.65 7.80C21.23 8.11 20.90 8.52 20.67 9.04C20.44 9.55 20.28 10.13 20.19 10.76C20.09 11.39 20.05 12.03 20.05 12.68ZM16.93 13.20C16.93 11.84 17.16 10.61 17.63 9.53C18.10 8.43 18.80 7.57 19.74 6.94C20.68 6.30 21.85 5.98 23.26 5.98C24.66 5.98 25.84 6.29 26.77 6.91C27.71 7.53 28.41 8.34 28.88 9.36C29.35 10.38 29.59 11.48 29.59 12.68C29.59 14.05 29.35 15.27 28.88 16.36C28.41 17.44 27.71 18.30 26.77 18.94C25.84 19.58 24.66 19.89 23.26 19.89C21.85 19.89 20.68 19.59 19.74 18.97C18.80 18.36 18.10 17.54 17.63 16.52C17.16 15.51 16.93 14.40 16.93 13.20Z" fill="var(--neutral-700)"/>
      <path d="M12.33 6.23C12.26 5.32 11.99 4.53 11.53 3.85C11.08 3.17 10.49 2.64 9.76 2.26C9.05 1.89 8.25 1.70 7.37 1.70C5.97 1.70 4.97 1.98 4.37 2.54C3.77 3.11 3.47 3.80 3.47 4.63C3.47 5.36 3.67 5.94 4.07 6.38C4.48 6.80 5.02 7.14 5.68 7.40C6.36 7.66 7.10 7.89 7.90 8.09C8.70 8.30 9.50 8.53 10.30 8.78C11.10 9.04 11.84 9.38 12.50 9.80C13.17 10.21 13.71 10.77 14.11 11.46C14.52 12.15 14.73 13.05 14.73 14.14C14.73 15.40 14.44 16.46 13.88 17.34C13.32 18.21 12.51 18.88 11.45 19.33C10.39 19.77 9.13 20 7.67 20C6.68 20 5.77 19.83 4.94 19.50C4.12 19.16 3.42 18.74 2.85 18.24C2.65 18.06 2.51 17.99 2.42 18.02C2.35 18.05 2.25 18.19 2.14 18.46L1.76 19.37C1.69 19.54 1.62 19.64 1.54 19.67C1.47 19.71 1.32 19.73 1.07 19.73H0.51C0.30 19.73 0.17 19.70 0.10 19.64C0.03 19.59 0 19.46 0 19.26V13.32C0 13.13 0.03 13.02 0.10 12.99C0.17 12.94 0.30 12.92 0.49 12.92H1.21C1.40 12.92 1.51 12.96 1.55 13.04C1.61 13.11 1.64 13.22 1.64 13.38C1.72 14.19 1.99 14.97 2.45 15.74C2.92 16.51 3.56 17.15 4.37 17.65C5.19 18.15 6.16 18.41 7.30 18.41C8.40 18.41 9.29 18.23 9.97 17.88C10.65 17.52 11.15 17.07 11.46 16.52C11.78 15.98 11.94 15.42 11.94 14.86C11.94 14.05 11.74 13.42 11.34 12.95C10.94 12.48 10.40 12.10 9.73 11.82C9.06 11.53 8.33 11.29 7.53 11.09C6.72 10.89 5.92 10.67 5.12 10.44C4.32 10.21 3.59 9.90 2.92 9.51C2.26 9.13 1.72 8.62 1.31 7.98C0.91 7.34 0.71 6.50 0.71 5.47C0.71 4.54 0.88 3.75 1.21 3.08C1.54 2.41 2.00 1.85 2.58 1.40C3.17 0.96 3.84 0.64 4.59 0.43C5.34 0.22 6.14 0.11 6.98 0.11C7.80 0.11 8.58 0.24 9.30 0.51C10.03 0.76 10.65 1.11 11.17 1.56C11.32 1.69 11.45 1.77 11.55 1.78C11.66 1.78 11.78 1.66 11.89 1.42L12.27 0.56C12.31 0.48 12.35 0.43 12.37 0.42C12.41 0.39 12.48 0.38 12.60 0.38H13.59C13.76 0.38 13.86 0.41 13.91 0.47C13.96 0.53 13.98 0.65 13.98 0.83V6.38C13.98 6.56 13.95 6.67 13.88 6.71C13.81 6.74 13.69 6.76 13.50 6.76H12.82C12.56 6.76 12.42 6.73 12.40 6.67C12.38 6.61 12.36 6.47 12.33 6.23Z" fill="var(--neutral-700)"/>
    </svg>
  )
}

// ── Organisation building icon (Figma 4010:3389 — not yet in @strange-huge/icons) ──

function OrgBuildingIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden style={{ display: 'block', flexShrink: 0 }}>
      <path d="M2.5 17.5h15M4.5 17.5V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v12.5M8 17.5v-3.5h4v3.5M7.25 7.5h1.5M11.25 7.5h1.5M7.25 11h1.5M11.25 11h1.5" stroke="var(--neutral-600)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SidebarProject {
  id: string
  label: string
  chatItems?: Array<{ id: string; label: string }>
}

export interface SidebarSchedule {
  id:        string
  label:     string
  /** Visual status indicator rendered to the left of the label */
  status:    'active' | 'warning'
  /** Count shown as a "X New" badge on the right */
  newCount?: number
}

export interface SidebarAgent {
  id:         string
  label:      string
  chatItems?: Array<{ id: string; label: string }>
}

export interface SidebarAdminItem {
  id:    string
  label: string
  /** Nested items — renders the row as an expandable section (e.g. Tools). */
  children?: SidebarAdminItem[]
}

export interface SidebarAdminGroup {
  id:    string
  /** Group header label (e.g. "Organization"). */
  label: string
  items: SidebarAdminItem[]
}

const DEFAULT_ADMIN_GROUPS: SidebarAdminGroup[] = [
  {
    id: 'organization',
    label: 'Organization',
    items: [
      { id: 'general',      label: 'General' },
      { id: 'members',      label: 'Members' },
      { id: 'teams',        label: 'Teams' },
      { id: 'plans-usage',  label: 'Plans & Usage' },
      { id: 'analytics',    label: 'Analytics' },
      { id: 'connectors',   label: 'Connectors' },
      { id: 'security',     label: 'Security' },
      { id: 'activity-log', label: 'Activity Log' },
    ],
  },
  {
    id: 'company-data',
    label: 'Company Data',
    items: [
      { id: 'connected-data', label: 'Connected Data' },
      { id: 'folders',        label: 'Folders' },
      { id: 'websites',       label: 'Websites' },
      { id: 'tools',          label: 'Tools', children: [] },
      { id: 'triggers',       label: 'Triggers' },
    ],
  },
  {
    id: 'models',
    label: 'Models',
    items: [
      { id: 'model-providers', label: 'Model Providers' },
    ],
  },
]

const ADMIN_ITEM_ICONS: Record<string, React.ReactElement<{ triggered?: boolean }>> = {
  'general':         <SettingsOneIcon size={20} />,
  'members':         <UserAddOneIcon size={20} />,
  'teams':           <DashboardSquareOneIcon size={20} />,
  'plans-usage':     <TokenCircleIcon size={20} />,
  'analytics':       <AuditTwoIcon size={20} />,
  'connectors':      <LinkSixIcon size={20} />,
  'security':        <ViewIcon size={20} />,
  'activity-log':    <PlayListIcon size={20} />,
  'connected-data':  <ExchangeOneIcon size={20} />,
  'folders':         <FolderOneIcon size={20} />,
  'websites':        <GlobalSearchIcon size={20} />,
  'tools':           <ShapesOneIcon size={20} />,
  'triggers':        <RadarThreeIcon size={20} />,
  'model-providers': <BrainTwoIcon size={20} />,
}

const DEFAULT_AGENTS: SidebarAgent[] = [
  { id: 'agent-1', label: 'Folder name', chatItems: [{ id: 'agent-1-chat-0', label: 'Label' }, { id: 'agent-1-chat-1', label: 'Label' }] },
  { id: 'agent-2', label: 'Folder name', chatItems: [{ id: 'agent-2-chat-0', label: 'Label' }, { id: 'agent-2-chat-1', label: 'Label' }] },
]

const PROJECT_LIMIT = 5

const DEFAULT_PROJECTS: SidebarProject[] = [
  { id: 'folder-1', label: 'Folder name', chatItems: [{ id: 'folder-1-chat-0', label: 'Label' }, { id: 'folder-1-chat-1', label: 'Label' }] },
  { id: 'folder-2', label: 'Folder name', chatItems: [{ id: 'folder-2-chat-0', label: 'Label' }, { id: 'folder-2-chat-1', label: 'Label' }] },
  { id: 'folder-3', label: 'Folder name', chatItems: [{ id: 'folder-3-chat-0', label: 'Label' }, { id: 'folder-3-chat-1', label: 'Label' }] },
]

export interface SidebarRecentItem {
  id:    string
  label: string
}

const DEFAULT_RECENTS: SidebarRecentItem[] = [
  { id: 'recent-0', label: 'Label' },
  { id: 'recent-1', label: 'Label' },
  { id: 'recent-2', label: 'Label' },
  { id: 'recent-3', label: 'Label' },
  { id: 'recent-4', label: 'Label' },
]

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Account display name */
  userName?: string
  /** Account subtitle / email */
  userEmail?: string
  /** Account avatar image URL */
  avatarSrc?: string
  /** Called when "Settings" is selected from the account dropdown menu */
  onSettingsClick?: () => void
  /** Called when "Help" is selected from the account dropdown menu */
  onHelpClick?: () => void
  /** Called when "Sign Out" is selected from the account dropdown menu */
  onLogoutClick?: () => void
  /** Whether the user is authenticated — controls "Sign Out" vs "Sign In" label */
  isAuthenticated?: boolean
  /** Called when New chat is clicked */
  onNewChat?: () => void
  /** Override label for the "New chat" button — e.g. "New brain thread" on brain pages */
  newChatLabel?: string
  /** Force the new-chat button into selected state regardless of internal click tracking */
  newChatButtonSelected?: boolean
  /** Called when Search is clicked */
  onSearch?: () => void
  /** Called when the sidebar collapse/toggle button is clicked */
  onCollapse?: () => void
  /** Called when the Chats tab is clicked — always navigates to new chat */
  onChatTabClick?: () => void
  /** Called when the Chat board nav item is clicked */
  onChatsClick?: () => void
  /** Called when the Projects nav item is clicked */
  onProjectsClick?: () => void
  /** Called when the Persona nav item is clicked */
  onPersonasClick?: () => void
  /** Called when the Brain nav item is clicked */
  onBrainClick?: () => void
  /** Called when All Brain Threads nav item is clicked (Brain section only) */
  onAllBrainThreadsClick?: () => void
  /** When true, the Projects section is hidden inside the Chats tab. Use on brain pages. */
  hideProjects?: boolean
  /** Called when "Show" is clicked on the Recents section header */
  onShowAllRecents?: React.MouseEventHandler<HTMLButtonElement>
  /**
   * Project folders to render in the Projects section.
   * Max 5 are shown; if more are provided a "Show all" item appears.
   * Defaults to two demo folders when omitted.
   */
  projects?: SidebarProject[]
  /** Called when the "Show all" projects item is clicked (only rendered when projects.length > 5) */
  onShowAllProjects?: () => void
  /** Fully custom Projects section content - replaces the entire projects area including header */
  projectItems?: React.ReactNode
  /**
   * Recent chats rendered in the Recents section. Each item is editable in
   * place (double-click → rename). Defaults to five "Label" placeholders.
   */
  recents?: SidebarRecentItem[]
  /**
   * Fully custom Recents section items - replaces the default chat rows.
   * Removes the "Recents" header and show/hide toggle.
   */
  recentItems?: React.ReactNode
  /**
   * Custom content rendered at the top of the brain tab body (above Recents).
   * Typically a show/hide section listing scheduled tasks.
   */
  scheduledTasksItems?: React.ReactNode
  /**
   * Start in collapsed (icon-only) state.
   * @default false
   */
  defaultCollapsed?: boolean
  /**
   * Initial tab shown on first mount. 'new-chat' and 'projects' map to the
   * 'chats' tab.
   * @default 'chats'
   */
  defaultBodySection?: 'chats' | 'agents' | 'brain' | 'admin' | 'new-chat' | 'projects'
  /**
   * Initial selected item id within the body section — overrides the default
   * of using `defaultBodySection` as the selected id. Use to pre-highlight
   * a specific admin nav item based on the current URL.
   */
  defaultSelectedItem?: string
  /** When true, the Search nav item is shown as selected (e.g. while the search modal is open). */
  searchActive?: boolean
  /**
   * Controlled "current chat" id — driven by the app router. When set, the
   * Sidebar highlights the matching chat row and auto-expands the parent project.
   */
  activeChatId?: string | null
  /**
   * Fires when the user clicks a chat row. Pair with `activeChatId` for
   * controlled selection.
   */
  onSelectChat?: (id: string) => void
  /**
   * Render function for the footer account slot. Receives `collapsed` so the
   * consumer can pass it to AccountMenu and get icon-only mode for free.
   */
  accountMenu?: (collapsed: boolean) => React.ReactNode
  // ── Organisation / Admin ─────────────────────────────────────────────────────
  /**
   * Organisation name shown in the badge to the right of the wordmark.
   * When omitted, no badge renders.
   */
  orgName?: string
  /** Organisation logo URL. Falls back to a monogram when omitted. */
  orgLogoSrc?: string
  /** Stable org identifier for deterministic badge colour assignment. */
  orgId?: string
  /** Explicit badge colour override. */
  orgColor?: ChipColor
  /**
   * When true, the org badge is interactive and enters admin mode.
   * Only Owner/Admin roles should pass this. @default false
   */
  showAdmin?: boolean
  /** Grouped org/admin nav shown in the admin body. Defaults to the standard three groups. */
  adminGroups?: SidebarAdminGroup[]
  /** Fires when an org/admin row is clicked. */
  onAdminSectionClick?: (id: string) => void
  /** Fully custom org section content — replaces the default admin nav. */
  adminItems?: React.ReactNode
  /** Called when Organisation nav item is clicked (also fires on admin entry via badge). */
  onOrganisationClick?: () => void
  // ── Brain ────────────────────────────────────────────────────────────────────
  /**
   * When true, shows a 6px filled red dot on the Brain icon signalling
   * that a Brain run is paused and waiting for user action.
   */
  brainNeedsInput?: boolean
  /** Brain section schedules. Section renders only when at least one schedule exists. */
  schedules?: SidebarSchedule[]
  /** Fires when a schedule row is clicked. */
  onScheduleClick?: (id: string) => void
  /** Called when "New thread" is clicked (Brain tab primary action). */
  onNewBrainThread?: () => void
  /** Called when Schedules quick-access item is clicked (Brain tab). */
  onSchedulesClick?: () => void
  /** Called when "See all" is clicked in the Schedules section. */
  onShowAllSchedules?: () => void
  /** Custom Brain section thread items — replaces default recents when Brain is active. */
  brainRecentItems?: React.ReactNode
  /** Override: replaces the entire Schedules section including header. */
  brainScheduleItems?: React.ReactNode
  // ── Agents ───────────────────────────────────────────────────────────────────
  /** Agent folders shown in the Agents tab. Defaults to two demo folders. */
  agents?: SidebarAgent[]
  /** Fully custom Agents section content. */
  agentItems?: React.ReactNode
  /** Called when "New agent chat" is clicked (Agents tab primary action). */
  onNewAgentChat?: () => void
  /** Called when "New agent" (create new agent) is clicked inside the agents list. */
  onNewAgent?: () => void
  /** Fires when an agent folder row is clicked. */
  onAgentClick?: (id: string) => void
}

// ── Section show/hide animation ───────────────────────────────────────────────
// Same three-layer pattern as SidebarProjectsSection expand/collapse.

// Layer 1 - height clip
const sectionHeightVariants = {
  open: {
    height: 'auto' as const,
    transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const },
  },
  closed: {
    height: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as const, delay: 0.14 },
  },
}

// Layer 2 - stagger orchestrator
const sectionStaggerVariants = {
  open: {
    transition: { staggerChildren: 0.04, delayChildren: 0.24 },
  },
  closed: {
    transition: {},
  },
}

// Layer 3 - per-item: fade + drift
const sectionItemVariants = {
  open:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' as const } },
  closed: { opacity: 0, y: 5, transition: { duration: 0.12, ease: 'easeIn'  as const } },
}

// ── Default content ────────────────────────────────────────────────────────────

// Persists across mounts - false on first sidebar load, true on every return to that section.
let projectsAnimatedOnce  = false
let schedulesAnimatedOnce = false
let agentsAnimatedOnce    = false

interface DefaultProjectItemsProps {
  projects: SidebarProject[]
  activeFolder: string | null
  expandedFolders: Set<string>
  selectedItem: string | null
  activeChatId?: string | null
  onSelect: (id: string) => void
  onChatClick: (id: string) => void
  onFolderOpen: (id: string) => void
  onFolderExpand: (id: string, expanded: boolean) => void
  onShowAllProjects?: () => void
}

// eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
function DefaultProjectItems({ projects, activeFolder, expandedFolders, selectedItem, activeChatId, onSelect, onChatClick, onFolderOpen, onFolderExpand, onShowAllProjects }: DefaultProjectItemsProps) {
  const [shown, setShown] = useState(true)
  const [overflow, setOverflow] = useState<'visible' | 'hidden'>('visible')
  const shouldAnimate = projectsAnimatedOnce
  useEffect(() => { projectsAnimatedOnce = true }, [])
  const [editingItem,    setEditingItem]    = useState<string | null>(null)
  const [chatLabels,     setChatLabels]     = useState<Record<string, string>>(() =>
    Object.fromEntries(
      projects.flatMap(p => (p.chatItems ?? []).map(c => [c.id, c.label]))
    )
  )
  const [projectLabels, setProjectLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(projects.map(p => [p.id, p.label]))
  )

  const visibleProjects = projects.slice(0, PROJECT_LIMIT)
  const hasMore = projects.length > PROJECT_LIMIT

  return (
    <>
      <SidebarMenuItem fluid variant="header" label="Projects" shown={shown} onShowClick={() => setShown(s => !s)} />
      {/* Persistent wrapper - never unmounts so items are always interactive.
          initial={false} ensures items start at their animate state on first render. */}
      <m.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        <m.div
          animate={shown ? 'open' : 'closed'}
          initial={shouldAnimate ? 'closed' : false}
          variants={sectionStaggerVariants}
          style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          <m.div variants={sectionItemVariants}>
            <SidebarMenuItem fluid variant="default" label="New project" icon={<FolderAddIcon size={20} />}
              selected={selectedItem === 'new-project'}
              onClick={() => onSelect('new-project')}
            />
          </m.div>

          {visibleProjects.map((project) => (
            <m.div key={project.id} variants={sectionItemVariants}>
              <SidebarProjectsSection
                fluid
                label={projectLabels[project.id] ?? project.label}
                active={activeFolder === project.id}
                expanded={expandedFolders.has(project.id)}
                onClick={() => onFolderOpen(project.id)}
                onExpandedChange={(v) => onFolderExpand(project.id, v)}
                onCommit={(val) => setProjectLabels(prev => ({ ...prev, [project.id]: val || prev[project.id] }))}
              >
                {project.chatItems && project.chatItems.length > 0 && [
                  <SidebarMenuItem key="header" fluid variant="header" label="Recent" />,
                  ...project.chatItems.map((chat) => {
                    const isSelected = activeChatId != null
                      ? activeChatId === chat.id
                      : selectedItem === chat.id
                    return (
                    <SidebarMenuItem
                      key={chat.id}
                      fluid
                      variant={editingItem === chat.id ? 'chat-item-edit' : 'chat-item'}
                      label={chatLabels[chat.id] ?? chat.label}
                      selected={isSelected}
                      onClick={() => onChatClick(chat.id)}
                      onDoubleClick={() => { if (isSelected) setEditingItem(chat.id) }}
                      onRename={() => setEditingItem(chat.id)}
                      onCommit={(val) => { setChatLabels(prev => ({ ...prev, [chat.id]: val || prev[chat.id] })); setEditingItem(null) }}
                      onCancel={() => setEditingItem(null)}
                    />
                    )
                  }),
                ]}
              </SidebarProjectsSection>
            </m.div>
          ))}

          {hasMore && (
            <m.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                icon={<MoreHorizontalIcon size={20} />}
                label="Show all"
                onClick={onShowAllProjects}
              />
            </m.div>
          )}
        </m.div>
      </m.div>
    </>
  )
}

// ── DefaultAgentItems ─────────────────────────────────────────────────────────
// Mirrors DefaultProjectItems — agent folders use UserAiIcon instead of FolderOneIcon.

interface DefaultAgentItemsProps {
  agents: SidebarAgent[]
  activeFolder: string | null
  expandedFolders: Set<string>
  selectedItem: string | null
  activeChatId?: string | null
  onSelect: (id: string) => void
  onChatClick: (id: string) => void
  onFolderOpen: (id: string) => void
  onFolderExpand: (id: string, expanded: boolean) => void
  onAgentClick?: (id: string) => void
  onNewAgent?: () => void
}

function DefaultAgentItems({ agents, activeFolder, expandedFolders, selectedItem, activeChatId, onSelect, onChatClick, onFolderOpen, onFolderExpand, onAgentClick, onNewAgent }: DefaultAgentItemsProps) {
  const [shown, setShown] = useState(true)
  const [overflow, setOverflow] = useState<'visible' | 'hidden'>('visible')
  const shouldAnimate = agentsAnimatedOnce
  useEffect(() => { agentsAnimatedOnce = true }, [])
  const [editingItem,   setEditingItem]   = useState<string | null>(null)
  const [chatLabels,    setChatLabels]    = useState<Record<string, string>>(() =>
    Object.fromEntries(agents.flatMap(a => (a.chatItems ?? []).map(c => [c.id, c.label])))
  )
  const [agentLabels, setAgentLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(agents.map(a => [a.id, a.label]))
  )

  const visibleAgents = agents.slice(0, PROJECT_LIMIT)
  const hasMore = agents.length > PROJECT_LIMIT

  const handleFolderOpen = (id: string) => {
    onFolderOpen(id)
    onAgentClick?.(id)
  }

  return (
    <>
      <SidebarMenuItem fluid variant="header" label="Agents" shown={shown} onShowClick={() => setShown(s => !s)} />
      <m.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        <m.div
          animate={shown ? 'open' : 'closed'}
          initial={shouldAnimate ? 'closed' : false}
          variants={sectionStaggerVariants}
          style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          <m.div variants={sectionItemVariants}>
            <SidebarMenuItem fluid variant="default" label="New agent" icon={<FolderAddIcon size={20} />}
              selected={selectedItem === 'new-agent'}
              onClick={() => { onSelect('new-agent'); onNewAgent?.() }}
            />
          </m.div>

          {visibleAgents.map((agent) => (
            <m.div key={agent.id} variants={sectionItemVariants}>
              <SidebarProjectsSection
                fluid
                label={agentLabels[agent.id] ?? agent.label}
                active={activeFolder === agent.id}
                expanded={expandedFolders.has(agent.id)}
                icon={<UserAiIcon size={20} />}
                onClick={() => handleFolderOpen(agent.id)}
                onExpandedChange={(v) => onFolderExpand(agent.id, v)}
                onCommit={(val) => setAgentLabels(prev => ({ ...prev, [agent.id]: val || prev[agent.id] }))}
              >
                {agent.chatItems && agent.chatItems.length > 0 && [
                  <SidebarMenuItem key="header" fluid variant="header" label="Recent" />,
                  ...agent.chatItems.map((chat) => {
                    const isSelected = activeChatId != null ? activeChatId === chat.id : selectedItem === chat.id
                    return (
                      <SidebarMenuItem
                        key={chat.id}
                        fluid
                        variant={editingItem === chat.id ? 'chat-item-edit' : 'chat-item'}
                        label={chatLabels[chat.id] ?? chat.label}
                        selected={isSelected}
                        onClick={() => onChatClick(chat.id)}
                        onDoubleClick={() => { if (isSelected) setEditingItem(chat.id) }}
                        onRename={() => setEditingItem(chat.id)}
                        onCommit={(val) => { setChatLabels(prev => ({ ...prev, [chat.id]: val || prev[chat.id] })); setEditingItem(null) }}
                        onCancel={() => setEditingItem(null)}
                      />
                    )
                  }),
                ]}
              </SidebarProjectsSection>
            </m.div>
          ))}

          {hasMore && (
            <m.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                icon={<MoreHorizontalIcon size={20} />}
                label="See all"
                onClick={() => onSelect('agents-see-all')}
              />
            </m.div>
          )}
        </m.div>
      </m.div>
    </>
  )
}

// ── DefaultBrainScheduleItems ─────────────────────────────────────────────────
// Same three-layer stagger pattern. Renders only when schedules.length > 0.

const SCHEDULE_LIMIT = 2

interface DefaultBrainScheduleItemsProps {
  schedules:           SidebarSchedule[]
  selectedItem:        string | null
  onSelect:            (id: string) => void
  onScheduleClick?:    (id: string) => void
  onShowAllSchedules?: () => void
}

function DefaultBrainScheduleItems({ schedules, selectedItem, onSelect, onScheduleClick, onShowAllSchedules }: DefaultBrainScheduleItemsProps) {
  const [shown,    setShown]    = useState(true)
  const [overflow, setOverflow] = useState<'visible' | 'hidden'>('visible')
  const shouldAnimate = schedulesAnimatedOnce
  useEffect(() => { schedulesAnimatedOnce = true }, [])

  const visibleSchedules = schedules.slice(0, SCHEDULE_LIMIT)
  const hasMore = schedules.length > SCHEDULE_LIMIT

  const handleClick = (id: string) => {
    onSelect(id)
    onScheduleClick?.(id)
  }

  return (
    <>
      <SidebarMenuItem fluid variant="header" label="Recent schedules" shown={shown} onShowClick={() => setShown(s => !s)} />
      <m.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        <m.div
          animate={shown ? 'open' : 'closed'}
          initial={shouldAnimate ? 'closed' : false}
          variants={sectionStaggerVariants}
          style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          {visibleSchedules.map((schedule) => (
            <m.div key={schedule.id} variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                label={schedule.label}
                selected={selectedItem === schedule.id}
                icon={
                  schedule.status === 'warning'
                    ? (
                      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <AlertTwoIcon size={16} color="var(--color-yellow-500)" />
                      </span>
                    )
                    : (
                      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--color-blue-500)', flexShrink: 0 }} />
                      </span>
                    )
                }
                shortcut={schedule.newCount ? `${schedule.newCount} New` : undefined}
                onClick={() => handleClick(schedule.id)}
              />
            </m.div>
          ))}

          {hasMore && (
            <m.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                icon={<MoreHorizontalIcon size={20} />}
                label="See all"
                onClick={onShowAllSchedules}
              />
            </m.div>
          )}
        </m.div>
      </m.div>
    </>
  )
}

// ── DefaultAdminItems ─────────────────────────────────────────────────────────

interface AdminGroupProps {
  group:         SidebarAdminGroup
  isFirst:       boolean
  selectedItem:  string | null
  onItemClick:   (id: string) => void
  expandedItems: Set<string>
  onToggleItem:  (id: string) => void
}

function AdminGroup({ group, isFirst, selectedItem, onItemClick, expandedItems, onToggleItem }: AdminGroupProps) {
  const [shown, setShown]       = useState(true)
  const [overflow, setOverflow] = useState<'visible' | 'hidden'>('visible')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: isFirst ? 0 : '8px' }}>
      <SidebarMenuItem
        fluid
        variant="header"
        label={group.label}
        shown={shown}
        onShowClick={() => setShown(s => !s)}
      />
      <m.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        <m.div
          animate={shown ? 'open' : 'closed'}
          initial={false}
          variants={sectionStaggerVariants}
          style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          {group.items.map((item) => {
            const icon = ADMIN_ITEM_ICONS[item.id] ?? <SettingsOneIcon size={20} />
            if (item.children) {
              return (
                <m.div key={item.id} variants={sectionItemVariants}>
                  <SidebarProjectsSection
                    fluid
                    label={item.label}
                    icon={icon}
                    active={selectedItem === item.id}
                    expanded={expandedItems.has(item.id)}
                    onClick={() => onItemClick(item.id)}
                    onExpandedChange={() => onToggleItem(item.id)}
                  >
                    {item.children.map((child) => (
                      <SidebarMenuItem
                        key={child.id}
                        fluid
                        variant="chat-item"
                        label={child.label}
                        selected={selectedItem === child.id}
                        onClick={() => onItemClick(child.id)}
                      />
                    ))}
                  </SidebarProjectsSection>
                </m.div>
              )
            }
            return (
              <m.div key={item.id} variants={sectionItemVariants}>
                <SidebarMenuItem
                  fluid
                  variant="default"
                  label={item.label}
                  icon={icon}
                  selected={selectedItem === item.id}
                  onClick={() => onItemClick(item.id)}
                />
              </m.div>
            )
          })}
        </m.div>
      </m.div>
    </div>
  )
}

interface DefaultAdminItemsProps {
  groups:               SidebarAdminGroup[]
  selectedItem:         string | null
  onSelect:             (id: string) => void
  onAdminSectionClick?: (id: string) => void
}

function DefaultAdminItems({ groups, selectedItem, onSelect, onAdminSectionClick }: DefaultAdminItemsProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const handleClick = (id: string) => {
    onSelect(id)
    onAdminSectionClick?.(id)
  }
  const toggleItem = (id: string) => setExpandedItems(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {groups.map((group, gi) => (
        <AdminGroup
          key={group.id}
          group={group}
          isFirst={gi === 0}
          selectedItem={selectedItem}
          onItemClick={handleClick}
          expandedItems={expandedItems}
          onToggleItem={toggleItem}
        />
      ))}
    </div>
  )
}

interface DefaultRecentItemsProps {
  selectedItem: string | null
  activeChatId?: string | null
  onSelect: (id: string) => void
  onChatClick: (id: string) => void
  onShowAll?: React.MouseEventHandler<HTMLButtonElement>
  /** Changes when the active section changes - triggers item stagger re-animation */
  sectionKey: string
  /** Recent chat rows; defaults to five "Label" placeholders. */
  recents: SidebarRecentItem[]
  /** Section header label. Defaults to "Recents". Pass "Recent threads" for Brain mode. */
  sectionLabel?: string
}

function DefaultRecentItems({ selectedItem, activeChatId, onSelect: _onSelect, onChatClick, onShowAll, sectionKey, recents, sectionLabel = 'Recents' }: DefaultRecentItemsProps) {
  const [shown,        setShown]        = useState(true)
  const [overflow,     setOverflow]     = useState<'visible' | 'hidden'>('visible')
  // Skip stagger on first sidebar load; replay it on section switches (key remount).
  const hasAnimatedRef = useRef(false)
  useEffect(() => { hasAnimatedRef.current = true }, [])
  // Reset shown whenever the active section changes so Recents always starts expanded.
  useEffect(() => { setShown(true) }, [sectionKey])
  const [editingItem,  setEditingItem]  = useState<string | null>(null)
  const [itemLabels,   setItemLabels]   = useState<Record<string, string>>(() =>
    Object.fromEntries(recents.map(r => [r.id, r.label]))
  )
  useEffect(() => {
    setItemLabels(Object.fromEntries(recents.map(r => [r.id, r.label])))
  }, [recents])

  const handleToggle: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    setShown(s => !s)
    onShowAll?.(e)
  }

  return (
    <>
      <SidebarMenuItem fluid variant="header" label={sectionLabel} shown={shown} onShowClick={handleToggle} />
      {/* Layer 1 - height: controls shown/hidden toggle */}
      <m.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        {/* Layer 2+3 - stagger: key={sectionKey} remounts on section switch to replay stagger */}
          <m.div
            key={sectionKey}
            animate={shown ? 'open' : 'closed'}
            initial={hasAnimatedRef.current ? 'closed' : false}
            variants={sectionStaggerVariants}
            style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}
          >
            {recents.map(({ id }) => {
              const isSelected = activeChatId != null
                ? activeChatId === id
                : selectedItem === id
              return (
              <m.div key={id} variants={sectionItemVariants}>
                <SidebarMenuItem
                  fluid
                  variant={editingItem === id ? 'chat-item-edit' : 'chat-item'}
                  label={itemLabels[id] ?? 'Label'}
                  selected={isSelected}
                  onClick={() => onChatClick(id)}
                  onDoubleClick={() => { if (isSelected) setEditingItem(id) }}
                  onRename={() => setEditingItem(id)}
                  onCommit={(val) => { setItemLabels(prev => ({ ...prev, [id]: val || prev[id] })); setEditingItem(null) }}
                  onCancel={() => setEditingItem(null)}
                />
              </m.div>
              )
            })}
          </m.div>
      </m.div>
    </>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export function Sidebar({
      ref,
      userName       = 'Label',
      userEmail      = 'Label',
      avatarSrc,
      onSettingsClick,
      onHelpClick,
      onLogoutClick,
      isAuthenticated = false,
      onNewChat,
      newChatLabel,
      newChatButtonSelected,
      onSearch,
      onCollapse,
      onChatTabClick,
      onChatsClick,
      onProjectsClick: _onProjectsClick,
      onPersonasClick,
      onBrainClick,
      onAllBrainThreadsClick,
      hideProjects   = false,
      projects       = DEFAULT_PROJECTS,
      onShowAllProjects,
      projectItems,
      recents        = DEFAULT_RECENTS,
      recentItems,
      scheduledTasksItems,
      onShowAllRecents,
      defaultCollapsed    = false,
      defaultBodySection,
      defaultSelectedItem,
      searchActive,
      activeChatId,
      onSelectChat,
      accountMenu,
      orgName,
      orgLogoSrc,
      orgId,
      orgColor,
      showAdmin           = false,
      adminGroups         = DEFAULT_ADMIN_GROUPS,
      onAdminSectionClick,
      adminItems,
      onOrganisationClick,
      brainNeedsInput     = false,
      schedules           = [],
      onScheduleClick,
      onNewBrainThread,
      onSchedulesClick,
      onShowAllSchedules,
      brainRecentItems,
      brainScheduleItems,
      agents              = DEFAULT_AGENTS,
      agentItems,
      onNewAgentChat,
      onNewAgent,
      onAgentClick,
      className,
      ...props
    // eslint-disable-next-line react-doctor/prefer-useReducer -- multiple useState calls; useReducer refactor deferred
    }: SidebarProps & { ref?: React.Ref<HTMLDivElement> }) {
    // eslint-disable-next-line react-doctor/no-derived-useState -- intentional draft-state pattern; reset handled by key prop or effect
    const [isCollapsed,      setIsCollapsed]      = useState(defaultCollapsed)
    const [collapseHovered,  setCollapseHovered]  = useState(false)
    const [atScrollTop,      setAtScrollTop]      = useState(true)
    const [atScrollBottom,   setAtScrollBottom]   = useState(false)

    // Measured header height — logo + tab strip + nav strip.
    // ResizeObserver keeps the scroll body anchored to the real header bottom,
    // so there are no hand-tuned per-section pixel offsets to drift.
    const headerRef = useRef<HTMLDivElement>(null)
    const [headerH, setHeaderH] = useState(210)
    useEffect(() => {
      const el = headerRef.current
      if (!el) return
      const update = () => setHeaderH(el.offsetHeight)
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    // Scroll-position memory across collapse ↔ expand.
    const bodyScrollRef       = useRef<HTMLDivElement>(null)
    const savedScrollTopRef   = useRef(0)
    useEffect(() => {
      const el = bodyScrollRef.current
      if (!el) return
      if (isCollapsed) {
        savedScrollTopRef.current = el.scrollTop
        el.scrollTop = 0
      } else {
        const id = requestAnimationFrame(() => {
          if (bodyScrollRef.current) bodyScrollRef.current.scrollTop = savedScrollTopRef.current
        })
        return () => cancelAnimationFrame(id)
      }
    }, [isCollapsed])

    const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      setAtScrollTop(el.scrollTop < 34)
      setAtScrollBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
    }
    const [activeFolder,    setActiveFolder]    = useState<string | null>(null)
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [selectedItem,    setSelectedItem]    = useState<string | null>(defaultSelectedItem ?? defaultBodySection ?? null)
    // bodySection controls which content area is shown in the scrollable body.
    const [bodySection, setBodySection] = useState<'chats' | 'agents' | 'brain' | 'admin'>(
      defaultBodySection === 'agents' ? 'agents'
      : defaultBodySection === 'brain' ? 'brain'
      : defaultBodySection === 'admin' ? 'admin'
      : 'chats'
    )

    // Switch section — clears folder/item selection so body starts fresh.
    // Entering Admin also fires onOrganisationClick (back-compat hook).
    const onSelectSection = (section: 'chats' | 'agents' | 'brain' | 'admin') => {
      setBodySection(section)
      setActiveFolder(null)
      if (section === 'admin') onOrganisationClick?.()
    }
    // Select any non-section item (chat items, new-project, etc.) - preserves bodySection
    const onSelect = (id: string) => { setSelectedItem(id); setActiveFolder(null) }
    // Chat-row click — controlled flow when consumer provides onSelectChat.
    const handleChatClick = (id: string) => {
      if (onSelectChat) onSelectChat(id)
      else onSelect(id)
    }
    // Row click - only sets active folder; never affects expansion (icon-only)
    const handleFolderOpen = (id: string) => {
      setActiveFolder(id)
      setSelectedItem(null)
    }
    // Icon click - toggle expansion only; never touches active folder selection
    const handleFolderExpand = (id: string, expanded: boolean) => {
      setExpandedFolders(prev => {
        const next = new Set(prev)
        expanded ? next.add(id) : next.delete(id)
        return next
      })
    }

    // Auto-expand the project that contains `activeChatId`.
    useEffect(() => {
      if (!activeChatId) return
      const parent = projects.find(p => p.chatItems?.some(c => c.id === activeChatId))
      if (!parent) return
      setExpandedFolders(prev => {
        if (prev.has(parent.id)) return prev
        const next = new Set(prev)
        next.add(parent.id)
        return next
      })
    }, [activeChatId, projects])
    const handleCollapse = useCallback(() => {
      setIsCollapsed(v => !v)
      onCollapse?.()
    }, [onCollapse])

    // ⌘B / Ctrl+B - collapse/expand sidebar
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === 'b') {
          e.preventDefault()
          handleCollapse()
        }
      }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }, [handleCollapse])

    const computedNewChatLabel = newChatLabel ?? (
      bodySection === 'agents' ? 'New agent chat' :
      bodySection === 'brain'  ? 'New thread' :
      'New chat'
    )

    return (
      <div
        ref={ref}
        role="navigation"
        aria-label="Main navigation"
        className={cn(className)}
        style={{
          position:        'relative',
          display:         'flex',
          flexDirection:   'column',
          width:           isCollapsed ? '48px' : '294px',
          height:          '100%',
          backgroundColor: 'var(--neutral-50)',
          overflowX:       'hidden',
          flexShrink:      0,
          zIndex:          0,
          isolation:       'isolate',
          // eslint-disable-next-line react-doctor/no-layout-transition-inline -- sidebar width is dynamic state
          transition:      'width 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        {...props}
      >

        {/* ── Absolute top: logo + collapse + nav items ── */}
        <div ref={headerRef} style={{
          position:        'absolute',
          top:             0,
          left:            0,
          right:           0,
          zIndex:          10,
          backgroundColor: 'var(--neutral-50)',
          display:         'flex',
          flexDirection:   'column',
          gap:             '4px',
        }}>
          {/* ── Logo row ── */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            paddingTop:     '24px',
            paddingBottom:  '8px',
            paddingLeft:    isCollapsed ? '8px' : '20px',
            paddingRight:   '8px',
          }}>
            {/* Wordmark + org badge — only in expanded */}
            {!isCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <button
                  type="button"
                  aria-label={atScrollTop ? 'New chat' : 'Scroll to top'}
                  onClick={() => {
                    const el = bodyScrollRef.current
                    if (!atScrollTop && el) {
                      el.scrollTo({ top: 0, behavior: 'smooth' })
                    } else {
                      onNewChat?.()
                    }
                  }}
                  style={{
                    background:   'none',
                    border:       'none',
                    padding:      0,
                    cursor:       'pointer',
                    display:      'flex',
                    alignItems:   'center',
                    borderRadius: 6,
                  }}
                >
                  <SouvenirWordmark />
                </button>
                {orgName && (
                  <OrgBadge
                    orgName={orgName.length > 10 ? orgName.slice(0, 10) + '…' : orgName}
                    fullName={orgName}
                    orgLogoSrc={orgLogoSrc}
                    orgId={orgId}
                    color={orgColor}
                    interactive={showAdmin}
                    active={bodySection === 'admin'}
                    onClick={() => onSelectSection('admin')}
                    maxNameWidth={100}
                  />
                )}
              </div>
            )}

            {/* Collapse toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <Tooltip content="Expand sidebar" side="right" disabled={!isCollapsed}>
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  icon={
                    <SidebarLeftIcon
                      size={20}
                      variant={isCollapsed ? 'open' : 'close'}
                      triggered={collapseHovered}
                    />
                  }
                  onClick={handleCollapse}
                  onMouseEnter={() => setCollapseHovered(true)}
                  onMouseLeave={() => setCollapseHovered(false)}
                />
              </Tooltip>
            </div>
          </div>

          {/* ── Tab strip — Chats / Agents / Brain.
                Admin is NOT a tab — entered via the OrgBadge.
                When in admin mode, no tab is highlighted (value=""). ── */}
          {!isCollapsed && (
            <div style={{ paddingLeft: '12px', paddingRight: '12px' }}>
              <Tabs
                value={bodySection === 'admin' ? '' : bodySection}
                onValueChange={(v) => onSelectSection(v as 'chats' | 'agents' | 'brain')}
              >
                <TabsList size="medium" fluid>
                  <TabsTrigger value="chats"  icon={<BubbleChatIcon    size={16} />} onClick={onChatTabClick}>Chats</TabsTrigger>
                  <TabsTrigger value="agents" icon={<UserAiIcon        size={16} />} onClick={onPersonasClick}>Agents</TabsTrigger>
                  <TabsTrigger value="brain"  icon={<NeuralNetworkIcon size={16} />} onClick={onBrainClick}>Brain</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}

          {/* ── Nav strip — Primary action + Search + section-specific items ── */}
          <div style={{
            display:       'flex',
            flexDirection: 'column',
            alignItems:    isCollapsed ? 'center' : 'stretch',
            gap:           '4px',
            paddingTop:    '4px',
            paddingBottom: '4px',
            paddingLeft:   '8px',
            paddingRight:  '8px',
            overflow:      'hidden',
          }}>
            {/* New chat / New agent chat / New thread — no primary action in Admin */}
            {bodySection !== 'admin' && (
              <Tooltip content={computedNewChatLabel} side="right" disabled={!isCollapsed}>
                <SidebarMenuItem
                  {...(isCollapsed ? { collapsed: true } : { fluid: true })}
                  variant="new-chat"
                  label={computedNewChatLabel}
                  selected={newChatButtonSelected ?? selectedItem === 'new-chat'}
                  icon={bodySection === 'agents' ? <UserAiIcon size={20} /> : undefined}
                  onClick={() => {
                    setSelectedItem('new-chat')
                    setActiveFolder(null)
                    if (bodySection === 'agents') onNewAgentChat?.()
                    else if (bodySection === 'brain') onNewBrainThread?.()
                    else onNewChat?.()
                  }}
                />
              </Tooltip>
            )}
            {/* Chat Board — Chats section only */}
            {bodySection === 'chats' && onChatsClick && (
              <Tooltip content="Chat Board" side="right" disabled={!isCollapsed}>
                <SidebarMenuItem
                  {...(isCollapsed ? { collapsed: true } : { fluid: true })}
                  variant="default"
                  icon={<BubbleChatIcon size={20} />}
                  label="Chat Board"
                  onClick={onChatsClick}
                />
              </Tooltip>
            )}
            {/* All Brain Threads — Brain section only */}
            {bodySection === 'brain' && onAllBrainThreadsClick && (
              <Tooltip content="All Brain Threads" side="right" disabled={!isCollapsed}>
                <SidebarMenuItem
                  {...(isCollapsed ? { collapsed: true } : { fluid: true })}
                  variant="default"
                  icon={<NeuralNetworkIcon size={20} />}
                  label="All Brain Threads"
                  onClick={onAllBrainThreadsClick}
                />
              </Tooltip>
            )}
            {/* Search — always visible */}
            <Tooltip content="Search" side="right" disabled={!isCollapsed}>
              <SidebarMenuItem
                {...(isCollapsed ? { collapsed: true } : { fluid: true })}
                variant="default"
                icon={<SearchOneIcon size={20} />}
                label="Search"
                shortcut={isCollapsed ? undefined : '⌘ K'}
                selected={searchActive}
                onClick={(e) => { (e.currentTarget as HTMLElement).blur(); onSearch?.() }}
              />
            </Tooltip>
            {/* Schedules quick-access — Brain only */}
            {bodySection === 'brain' && (
              <Tooltip content="Schedules" side="right" disabled={!isCollapsed}>
                <SidebarMenuItem
                  {...(isCollapsed ? { collapsed: true } : { fluid: true })}
                  variant="default"
                  icon={<CalendarThreeIcon size={20} />}
                  label="Schedules"
                  onClick={onSchedulesClick}
                />
              </Tooltip>
            )}
            {/* Collapsed-only section-switch icons + Admin entry */}
            {isCollapsed && (
              <>
                <SidebarMenuItem
                  collapsed
                  variant="default"
                  icon={<BubbleChatIcon size={20} />}
                  label="Chats"
                  selected={bodySection === 'chats'}
                  onClick={() => onSelectSection('chats')}
                />
                <SidebarMenuItem
                  collapsed
                  variant="default"
                  icon={<UserAiIcon size={20} />}
                  label="Agents"
                  selected={bodySection === 'agents'}
                  onClick={() => onSelectSection('agents')}
                />
                <SidebarMenuItem
                  collapsed
                  variant="default"
                  icon={<NeuralNetworkIcon size={20} />}
                  label="Brain"
                  selected={bodySection === 'brain'}
                  onClick={() => onSelectSection('brain')}
                />
                {showAdmin && (
                  <SidebarMenuItem
                    collapsed
                    variant="default"
                    icon={<OrgBuildingIcon size={20} />}
                    label="Organisation"
                    selected={bodySection === 'admin'}
                    onClick={() => onSelectSection('admin')}
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        {/* top: measured header height replaces the old per-section hardcoded offsets */}
        <div ref={bodyScrollRef} className={isCollapsed ? undefined : 'kaya-scrollbar'} onScroll={handleBodyScroll} style={{
          position:      'absolute',
          top:           headerH,
          bottom:        '68px',
          left:          0,
          right:         0,
          overflowY:             isCollapsed ? 'hidden' : 'auto',
          overflowX:             'hidden',
          overscrollBehaviorY:   'contain',
          overscrollBehaviorX:   'none',
          display:       'flex',
          flexDirection: 'column',
          gap:           '4px',
        }}>

          <m.div
            animate={{ opacity: isCollapsed ? 0 : 1, filter: isCollapsed ? 'blur(4px)' : 'blur(0px)' }}
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{ display: 'flex', flexDirection: 'column', pointerEvents: isCollapsed ? 'none' : 'auto' }}
          >
            {/* Section body — projects / agents / brain-schedules / admin */}
            <AnimatePresence initial={false}>
              {!hideProjects && bodySection === 'chats' && (
                <div key="projects-section" style={{
                  display:       'flex',
                  flexDirection: 'column',
                  paddingLeft:   '8px',
                  paddingRight:  '8px',
                  paddingTop:    '8px',
                  paddingBottom: '8px',
                  flexShrink:    0,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {projectItems ?? (
                      <DefaultProjectItems
                        projects={projects}
                        activeFolder={activeFolder}
                        expandedFolders={expandedFolders}
                        selectedItem={selectedItem}
                        activeChatId={activeChatId}
                        onSelect={onSelect}
                        onChatClick={handleChatClick}
                        onFolderOpen={handleFolderOpen}
                        onFolderExpand={handleFolderExpand}
                        onShowAllProjects={onShowAllProjects}
                      />
                    )}
                  </div>
                </div>
              )}
              {bodySection === 'agents' && (
                <div key="agents-section" style={{
                  display:       'flex',
                  flexDirection: 'column',
                  paddingLeft:   '8px',
                  paddingRight:  '8px',
                  paddingTop:    '8px',
                  paddingBottom: '8px',
                  flexShrink:    0,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {agentItems ?? (
                      <DefaultAgentItems
                        agents={agents}
                        activeFolder={activeFolder}
                        expandedFolders={expandedFolders}
                        selectedItem={selectedItem}
                        activeChatId={activeChatId}
                        onSelect={onSelect}
                        onChatClick={handleChatClick}
                        onFolderOpen={handleFolderOpen}
                        onFolderExpand={handleFolderExpand}
                        onAgentClick={onAgentClick}
                        onNewAgent={onNewAgent}
                      />
                    )}
                  </div>
                </div>
              )}
              {bodySection === 'brain' && (scheduledTasksItems != null || schedules.length > 0 || brainScheduleItems != null) && (
                <div key="brain-section" style={{
                  display:       'flex',
                  flexDirection: 'column',
                  paddingLeft:   '8px',
                  paddingRight:  '8px',
                  paddingTop:    '8px',
                  paddingBottom: '8px',
                  flexShrink:    0,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {/* Legacy scheduledTasksItems passthrough for existing consumers */}
                    {scheduledTasksItems}
                    {/* New: schedules section (gates on data or custom override) */}
                    {(schedules.length > 0 || brainScheduleItems != null) && (
                      brainScheduleItems ?? (
                        <DefaultBrainScheduleItems
                          schedules={schedules}
                          selectedItem={selectedItem}
                          onSelect={onSelect}
                          onScheduleClick={onScheduleClick}
                          onShowAllSchedules={onShowAllSchedules}
                        />
                      )
                    )}
                  </div>
                </div>
              )}
              {bodySection === 'admin' && (
                <div key="admin-section" style={{
                  display:       'flex',
                  flexDirection: 'column',
                  paddingLeft:   '8px',
                  paddingRight:  '8px',
                  paddingTop:    '8px',
                  paddingBottom: '8px',
                  flexShrink:    0,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {adminItems ?? (
                      <DefaultAdminItems
                        groups={adminGroups}
                        selectedItem={selectedItem}
                        onSelect={onSelect}
                        onAdminSectionClick={onAdminSectionClick}
                      />
                    )}
                  </div>
                </div>
              )}
            </AnimatePresence>

            {/* Recents — not shown in Admin */}
            {bodySection !== 'admin' && (
              <div style={{
                display:       'flex',
                flexDirection: 'column',
                paddingLeft:   '8px',
                paddingRight:  '8px',
                paddingTop:    '8px',
                paddingBottom: '64px',
                flexShrink:    0,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {recentItems !== undefined ? recentItems : (
                    bodySection === 'brain' && brainRecentItems != null
                      ? brainRecentItems
                      : <DefaultRecentItems
                          key={bodySection}
                          selectedItem={selectedItem}
                          activeChatId={activeChatId}
                          onSelect={onSelect}
                          onChatClick={handleChatClick}
                          onShowAll={onShowAllRecents}
                          sectionKey={bodySection}
                          recents={recents}
                          sectionLabel={bodySection === 'brain' ? 'Recent threads' : 'Recents'}
                        />
                  )}
                </div>
              </div>
            )}
          </m.div>

        </div>

        {/* ── Top scroll fade - blur (behind) + gradient (on top) ── */}
        {[
          { height: 40, blur: 2 },
          { height: 28, blur: 3 },
          { height: 18, blur: 5 },
          { height: 10, blur: 6 },
        ].map(({ height, blur }) => (
          <div key={blur} aria-hidden style={{
            position:            'absolute',
            top:                 headerH,
            transition:          'opacity 150ms ease',
            left:                0, right: 0,
            height:              `${height}px`,
            backdropFilter:      `blur(${blur}px)`,
            WebkitBackdropFilter:`blur(${blur}px)`,
            maskImage:           'linear-gradient(to bottom, black 0%, transparent 100%)',
            WebkitMaskImage:     'linear-gradient(to bottom, black 0%, transparent 100%)',
            pointerEvents:       'none',
            zIndex:              5,
            opacity:             atScrollTop ? 0 : 1,
          }} />
        ))}
        <div aria-hidden style={{
          position:      'absolute',
          top:           headerH,
          transition:    'opacity 150ms ease',
          left:          0, right: 0,
          height:        '40px',
          background:    'linear-gradient(to bottom, var(--neutral-50) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex:        6,
          opacity:       atScrollTop ? 0 : 1,
        }} />

        {/* ── Bottom scroll fade - blur (behind) + gradient (on top) ── */}
        {[
          { height: 40, blur: 2 },
          { height: 28, blur: 3 },
          { height: 18, blur: 5 },
          { height: 10, blur: 6 },
        ].map(({ height, blur }) => (
          <div key={blur} aria-hidden style={{
            position:            'absolute',
            bottom:              '68px',
            left:                0, right: 0,
            height:              `${height}px`,
            backdropFilter:      `blur(${blur}px)`,
            WebkitBackdropFilter:`blur(${blur}px)`,
            maskImage:           'linear-gradient(to top, black 0%, transparent 100%)',
            WebkitMaskImage:     'linear-gradient(to top, black 0%, transparent 100%)',
            pointerEvents:       'none',
            zIndex:              5,
            opacity:             atScrollBottom ? 0 : 1,
            transition:          'opacity 150ms ease',
          }} />
        ))}
        <div aria-hidden style={{
          position:      'absolute',
          bottom:        '68px',
          left:          0, right: 0,
          height:        '40px',
          background:    'linear-gradient(to top, var(--neutral-50) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex:        6,
          opacity:       atScrollBottom ? 0 : 1,
          transition:    'opacity 150ms ease',
        }} />

        {/* ── Absolute bottom: account item + dropup menu ── */}
        <div style={{
          position:        'absolute',
          bottom:          0,
          left:            isCollapsed ? '50%' : 0,
          right:           isCollapsed ? 'auto' : 0,
          transform:       isCollapsed ? 'translateX(-50%)' : undefined,
          width:           isCollapsed ? '48px' : undefined,
          zIndex:          10,
          backgroundColor: 'var(--neutral-50)',
          paddingLeft:     isCollapsed ? '4px' : '10px',
          paddingRight:    isCollapsed ? '4px' : '10px',
          paddingTop:      '12px',
          paddingBottom:   '12px',
          overflow:        'hidden',
        }}>
          {accountMenu ? accountMenu(isCollapsed) : (
            <AccountMenu
              name={userName ?? ''}
              plan={userEmail}
              avatarSrc={avatarSrc}
              collapsed={isCollapsed}
              panelWidth={274}
              placement="top-start"
              onSettings={onSettingsClick}
              onHelp={onHelpClick}
              onLogOut={() => {
                if (isAuthenticated) {
                  onLogoutClick?.()
                } else if (typeof window !== 'undefined') {
                  window.location.href = '/auth/login'
                }
              }}
            />
          )}
        </div>

      </div>
    )
}

Sidebar.displayName = 'Sidebar'

export default Sidebar

// ── Re-exports ────────────────────────────────────────────────────────────────
export { SidebarProvider, useSidebar } from './context'
export type { SidebarContextValue, SidebarProviderProps } from './context'
