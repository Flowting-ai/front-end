'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  SearchOneIcon,
  UserAiIcon,
  NeuralNetworkIcon,
  FolderAddIcon,
  FolderOneIcon,
  SidebarLeftIcon,
  MoreHorizontalIcon,
  BubbleChatIcon,
  BubbleChatAddIcon,
  CalendarFoldIcon,
  AlertTwoIcon,
  UserAddOneIcon,
  TokenCircleIcon,
  SettingsOneIcon,
  ShapesOneIcon,
  AnalyticsOneIcon,
  LinkSixIcon,
  PlayListIcon,
  ExchangeOneIcon,
  GlobalSearchIcon,
  RadarThreeIcon,
  BrainTwoIcon,
  ViewIcon,
  DashboardSquareOneIcon,
  CourtHouseIcon,
  PlusSignIcon,
  AuditTwoIcon,
} from '@strange-huge/icons'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { SidebarProjectsSection } from '@/components/SidebarProjectsSection'
import { IconButton } from '@/components/IconButton'
import { Tabs, TabsList, TabsTrigger } from '@/components/Tabs'
import { OrgBadge } from '@/components/OrgBadge'
import { Badge } from '@/components/Badge'
import { AccountMenu } from '@/components/AccountMenu'
import { TeamSwitcherRow } from '@/components/TeamSwitcherRow'
import { TeamSwitcherDropdown } from '@/components/TeamSwitcherDropdown'
import { Dropdown } from '@/components/Dropdown'
import { RoleBadge } from '@/components/RoleBadge'
import type { WorkspaceRole, RoleBadgeMode } from '@/components/RoleBadge'
import type { ChipColor } from '@/components/Chip'

// ── Slack icon (Hugeicons "slack", stroke-rounded) ────────────────────────────
// Brand glyphs aren't in @strange-huge/icons, so the stroke-rounded paths are
// inlined here and recoloured via currentColor to match the sibling icons.
function SlackIcon({ size = 20 }: { size?: number; triggered?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M13 9.25V3.75C13 2.7835 13.7835 2 14.75 2C15.7165 2 16.5 2.7835 16.5 3.75V9.25C16.5 10.2165 15.7165 11 14.75 11C13.7835 11 13 10.2165 13 9.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 20.25V14.75C7.5 13.7835 8.2835 13 9.25 13C10.2165 13 11 13.7835 11 14.75V20.25C11 21.2165 10.2165 22 9.25 22C8.2835 22 7.5 21.2165 7.5 20.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.75 13L20.25 13C21.2165 13 22 13.7835 22 14.75C22 15.7165 21.2165 16.5 20.25 16.5L14.75 16.5C13.7835 16.5 13 15.7165 13 14.75C13 13.7835 13.7835 13 14.75 13Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.75 7.5L9.25 7.5C10.2165 7.5 11 8.2835 11 9.25C11 10.2165 10.2165 11 9.25 11L3.75 11C2.7835 11 2 10.2165 2 9.25C2 8.2835 2.7835 7.5 3.75 7.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 3.75C7 4.7165 7.7835 5.5 8.75 5.5H10.5V3.75C10.5 2.7835 9.7165 2 8.75 2C7.7835 2 7 2.7835 7 3.75Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M17 20.25C17 19.2835 16.2165 18.5 15.25 18.5H13.5V20.25C13.5 21.2165 14.2835 22 15.25 22C16.2165 22 17 21.2165 17 20.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M20.25 7C19.2835 7 18.5 7.7835 18.5 8.75L18.5 10.5H20.25C21.2165 10.5 22 9.7165 22 8.75C22 7.7835 21.2165 7 20.25 7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3.75 17C4.7165 17 5.5 16.2165 5.5 15.25V13.5L3.75 13.5C2.7835 13.5 2 14.2835 2 15.25C2 16.2165 2.7835 17 3.75 17Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

// ── Organisation building icon (Figma node 4010:3389 — not in @strange-huge/icons) ──
function OrgBuildingIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden style={{ display: 'block', flexShrink: 0 }}>
      <path
        d="M2.5 17.5h15M4.5 17.5V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v12.5M8 17.5v-3.5h4v3.5M7.25 7.5h1.5M11.25 7.5h1.5M7.25 11h1.5M11.25 11h1.5"
        stroke="var(--neutral-600)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
      <path d="M105.653 8.36643C105.653 8.16143 105.623 8.02904 105.564 7.96925C105.512 7.90092 105.389 7.86675 105.193 7.86675H103.735C103.548 7.86675 103.437 7.83686 103.403 7.77707C103.369 7.70873 103.352 7.58061 103.352 7.3927V6.73927C103.352 6.55136 103.373 6.4275 103.415 6.36771C103.467 6.30792 103.582 6.27803 103.761 6.27803H107.852C107.997 6.27803 108.108 6.29938 108.185 6.34209C108.262 6.37625 108.3 6.47875 108.3 6.64958V7.94363C108.3 8.16571 108.317 8.28956 108.351 8.31518C108.394 8.34081 108.466 8.25112 108.568 8.04612C108.892 7.45676 109.331 6.96562 109.885 6.57271C110.448 6.1798 111.168 5.98334 112.046 5.98334C112.831 5.98334 113.517 6.2097 114.105 6.6624C114.702 7.1151 115 7.73863 115 8.53299C115 8.90882 114.923 9.25902 114.77 9.5836C114.625 9.90818 114.416 10.1687 114.143 10.3652C113.879 10.5616 113.568 10.6598 113.21 10.6598C112.715 10.6598 112.302 10.5317 111.97 10.2755C111.637 10.0107 111.471 9.66474 111.471 9.23767C111.471 8.91309 111.522 8.66539 111.624 8.49456C111.727 8.31518 111.829 8.17425 111.931 8.07175C112.034 7.96925 112.085 7.86675 112.085 7.76425C112.085 7.64467 112.034 7.55499 111.931 7.49519C111.837 7.4354 111.65 7.40551 111.369 7.40551C110.815 7.40551 110.307 7.6404 109.847 8.11019C109.395 8.57997 109.037 9.19923 108.773 9.96797C108.509 10.7282 108.377 11.5482 108.377 12.4279V17.5016C108.377 17.6981 108.398 17.8347 108.441 17.9116C108.483 17.9799 108.603 18.0141 108.799 18.0141H110.346C110.508 18.0141 110.601 18.0483 110.627 18.1166C110.661 18.1764 110.678 18.2874 110.678 18.4497V19.1928C110.678 19.3466 110.657 19.4533 110.614 19.5131C110.58 19.5729 110.486 19.6028 110.333 19.6028H103.735C103.607 19.6028 103.509 19.5857 103.441 19.5516C103.381 19.5174 103.352 19.4405 103.352 19.3209V18.3728C103.352 18.2276 103.377 18.1337 103.428 18.091C103.488 18.0397 103.586 18.0141 103.722 18.0141H105.116C105.312 18.0141 105.449 17.9885 105.525 17.9372C105.61 17.8774 105.653 17.7536 105.653 17.5657V8.36643Z" fill="var(--neutral-700)"/>
      <path d="M96.3272 1.70404C96.3272 1.21717 96.4977 0.811445 96.8387 0.486867C97.1882 0.162289 97.6016 0 98.079 0C98.5563 0 98.9655 0.162289 99.3065 0.486867C99.6474 0.811445 99.8179 1.21717 99.8179 1.70404C99.8179 2.18236 99.6474 2.58381 99.3065 2.90839C98.9655 3.23297 98.5563 3.39526 98.079 3.39526C97.6016 3.39526 97.1882 3.23297 96.8387 2.90839C96.4977 2.58381 96.3272 2.18236 96.3272 1.70404ZM96.5446 7.86675H94.8184C94.6905 7.86675 94.6096 7.84967 94.5755 7.8155C94.5499 7.7728 94.5371 7.69165 94.5371 7.57207V6.61115C94.5371 6.38907 94.6437 6.27803 94.8568 6.27803H99.3192C99.4215 6.27803 99.4855 6.29511 99.511 6.32928C99.5451 6.36344 99.5622 6.43604 99.5622 6.54708V17.7066C99.5622 17.8176 99.5792 17.8988 99.6133 17.95C99.6559 17.9927 99.7284 18.0141 99.8307 18.0141H101.557C101.676 18.0141 101.757 18.0269 101.8 18.0525C101.842 18.0782 101.864 18.155 101.864 18.2832V19.2825C101.864 19.4106 101.851 19.496 101.825 19.5388C101.8 19.5815 101.723 19.6028 101.595 19.6028H94.9207C94.7758 19.6028 94.6735 19.5857 94.6138 19.5516C94.5627 19.5174 94.5371 19.432 94.5371 19.2953V18.3985C94.5371 18.2276 94.5669 18.1209 94.6266 18.0782C94.6863 18.0354 94.7928 18.0141 94.9463 18.0141H96.5318C96.6767 18.0141 96.7619 17.9927 96.7875 17.95C96.8216 17.8988 96.8387 17.8048 96.8387 17.6682V8.17425C96.8387 7.96925 96.7406 7.86675 96.5446 7.86675Z" fill="var(--neutral-700)"/>
      <path d="M78.8731 7.86675H77.2493C77.1129 7.86675 77.0234 7.84113 76.9807 7.78988C76.9466 7.73009 76.9296 7.63186 76.9296 7.49519V6.62396C76.9296 6.49584 76.9509 6.40615 76.9935 6.3549C77.0447 6.30365 77.1299 6.27803 77.2493 6.27803H81.4432C81.5966 6.27803 81.7075 6.32501 81.7757 6.41896C81.8438 6.50438 81.8779 6.61542 81.8779 6.75208V8.11019C81.8779 8.43476 81.9035 8.59278 81.9547 8.58424C82.0058 8.5757 82.0783 8.49883 82.172 8.35362C82.5897 7.68738 83.1481 7.12791 83.847 6.67521C84.5546 6.21396 85.4581 5.98334 86.5578 5.98334C87.6318 5.98334 88.4757 6.14136 89.0895 6.4574C89.7032 6.77344 90.138 7.23895 90.3937 7.85394C90.6494 8.46893 90.7773 9.2334 90.7773 10.1473V17.4375C90.7773 17.6682 90.7986 17.8219 90.8412 17.8988C90.8924 17.9757 91.033 18.0141 91.2632 18.0141H92.7336C92.8785 18.0141 92.9723 18.044 93.0149 18.1038C93.0575 18.155 93.0789 18.2575 93.0789 18.4113V19.2697C93.0789 19.432 93.0448 19.5302 92.9766 19.5644C92.9169 19.59 92.8018 19.6028 92.6313 19.6028H86.1998C86.0548 19.6028 85.9653 19.5729 85.9312 19.5131C85.9057 19.4448 85.8929 19.3338 85.8929 19.18V18.4113C85.8929 18.2661 85.9099 18.1636 85.944 18.1038C85.9866 18.044 86.0804 18.0141 86.2253 18.0141H87.5295C87.7427 18.0141 87.8833 17.9885 87.9515 17.9372C88.0197 17.8774 88.0538 17.7365 88.0538 17.5144V10.442C88.0538 9.53662 87.8705 8.84903 87.504 8.37924C87.146 7.90092 86.5748 7.66176 85.7906 7.66176C85.0319 7.66176 84.3628 7.87102 83.7831 8.28956C83.2035 8.69955 82.7517 9.25902 82.4278 9.96797C82.1124 10.6769 81.9547 11.4713 81.9547 12.3511V17.4888C81.9547 17.6852 81.993 17.8219 82.0697 17.8988C82.1465 17.9757 82.2828 18.0141 82.4789 18.0141H83.6553C83.8343 18.0141 83.9536 18.0397 84.0133 18.091C84.0815 18.1422 84.1156 18.2618 84.1156 18.4497V19.2056C84.1156 19.3679 84.0857 19.4747 84.0261 19.5259C83.9749 19.5772 83.8726 19.6028 83.7192 19.6028H77.2876C77.1256 19.6028 77.0234 19.5729 76.9807 19.5131C76.9466 19.4533 76.9296 19.3423 76.9296 19.18V18.4369C76.9296 18.2575 76.9637 18.1422 77.0319 18.091C77.1001 18.0397 77.2194 18.0141 77.3899 18.0141H78.7581C78.9456 18.0141 79.0692 17.997 79.1289 17.9628C79.1971 17.9201 79.2311 17.8091 79.2311 17.6297V8.13581C79.2311 8.01623 79.2013 7.94363 79.1416 7.918C79.0905 7.88384 79.001 7.86675 78.8731 7.86675Z" fill="var(--neutral-700)"/>
      <path d="M63.1089 13.1967C63.1089 11.83 63.3433 10.6043 63.8121 9.51954C64.2895 8.43476 64.997 7.57634 65.9347 6.94427C66.8809 6.30365 68.0657 5.98334 69.4893 5.98334C70.3758 5.98334 71.143 6.11574 71.7908 6.38052C72.4387 6.64531 72.98 7.00833 73.4147 7.46957C73.858 7.92227 74.2117 8.43904 74.476 9.01986C74.7402 9.59214 74.9278 10.19 75.0386 10.8136C75.1579 11.4371 75.2176 12.0521 75.2176 12.6586C75.2176 12.8294 75.1878 12.9362 75.1281 12.9789C75.0684 13.0216 74.9448 13.0429 74.7573 13.0429H66.5356C66.3907 13.0429 66.2842 13.0685 66.216 13.1198C66.1563 13.171 66.1265 13.2693 66.1265 13.4145C66.135 14.3028 66.2543 15.1313 66.4845 15.9001C66.7232 16.6688 67.0982 17.2881 67.6097 17.7578C68.1297 18.2191 68.8073 18.4497 69.6427 18.4497C70.606 18.4497 71.403 18.1807 72.0338 17.6425C72.6646 17.1044 73.1505 16.3827 73.4914 15.4773C73.5255 15.3833 73.5596 15.3107 73.5937 15.2594C73.6364 15.1997 73.7216 15.1698 73.8495 15.1698H74.8724C75.0002 15.1698 75.0812 15.1911 75.1153 15.2338C75.1579 15.2765 75.1665 15.3491 75.1409 15.4516C74.8937 16.3485 74.5186 17.13 74.0157 17.7963C73.5213 18.4625 72.882 18.9793 72.0977 19.3466C71.322 19.7139 70.3929 19.8975 69.3103 19.8975C67.9634 19.8975 66.8297 19.59 65.9091 18.975C64.9885 18.3515 64.2895 17.5315 63.8121 16.5151C63.3433 15.4986 63.1089 14.3925 63.1089 13.1967ZM66.5356 11.7233H71.9187C72.0892 11.7233 72.1915 11.7104 72.2256 11.6848C72.2682 11.6592 72.2853 11.5951 72.2767 11.4926C72.2767 11.0826 72.2171 10.6385 72.0977 10.1602C71.9869 9.67329 71.8164 9.21631 71.5863 8.78924C71.3561 8.35362 71.0663 7.99915 70.7168 7.72582C70.3673 7.45249 69.9496 7.31582 69.4637 7.31582C68.7306 7.31582 68.1211 7.52082 67.6353 7.93081C67.1579 8.34081 66.7999 8.85757 66.5612 9.4811C66.3225 10.1046 66.1989 10.7367 66.1904 11.3773C66.1819 11.514 66.1946 11.6079 66.2287 11.6592C66.2714 11.7019 66.3737 11.7233 66.5356 11.7233Z" fill="var(--neutral-700)"/>
      <path d="M55.5451 15.4773L58.2558 8.28956C58.324 8.11873 58.3325 8.00769 58.2814 7.95644C58.2388 7.89665 58.1109 7.86675 57.8978 7.86675H56.5552C56.3336 7.86675 56.2228 7.7429 56.2228 7.49519V6.62396C56.2228 6.51292 56.2441 6.4275 56.2867 6.36771C56.3293 6.30792 56.4103 6.27803 56.5296 6.27803H61.6186C61.7891 6.27803 61.9042 6.30365 61.9639 6.3549C62.0235 6.39761 62.0534 6.51292 62.0534 6.70083V7.55926C62.0534 7.69592 62.0278 7.78134 61.9767 7.8155C61.9255 7.84967 61.8275 7.86675 61.6826 7.86675H60.3911C60.2036 7.86675 60.0928 7.89665 60.0587 7.95644C60.0246 8.00769 59.982 8.09737 59.9308 8.2255L55.5067 19.6156C55.4726 19.7267 55.4172 19.795 55.3405 19.8206C55.2638 19.8548 55.1444 19.8719 54.9825 19.8719H54.2536C54.1002 19.8719 53.9851 19.8548 53.9084 19.8206C53.8402 19.795 53.7848 19.7309 53.7422 19.6284L49.1263 8.13581C49.0751 8.00769 49.0069 7.93081 48.9217 7.90519C48.845 7.87956 48.7171 7.86675 48.5381 7.86675H47.1828C47.0634 7.86675 46.9782 7.84113 46.927 7.78988C46.8844 7.73863 46.8631 7.66176 46.8631 7.55926V6.71365C46.8631 6.52573 46.9057 6.40615 46.991 6.3549C47.0762 6.30365 47.2041 6.27803 47.3745 6.27803H53.8701C54.0064 6.27803 54.0959 6.30365 54.1386 6.3549C54.1897 6.39761 54.2153 6.49157 54.2153 6.63677V7.46957C54.2153 7.66603 54.1769 7.78134 54.1002 7.8155C54.032 7.84967 53.8999 7.86675 53.7038 7.86675H52.4891C52.2931 7.86675 52.178 7.89665 52.1439 7.95644C52.1183 8.01623 52.1311 8.11446 52.1822 8.25112L54.7267 15.4388C54.8205 15.6951 54.893 15.9086 54.9441 16.0794C55.0038 16.2417 55.0635 16.3229 55.1231 16.3229C55.1828 16.3229 55.2425 16.246 55.3021 16.0922C55.3703 15.9385 55.4513 15.7335 55.5451 15.4773Z" fill="var(--neutral-700)"/>
      <path d="M33.2186 15.7335V8.30237C33.2186 8.13154 33.1972 8.01623 33.1546 7.95644C33.112 7.89665 33.014 7.86675 32.8605 7.86675H31.3773C31.2068 7.86675 31.0875 7.84967 31.0193 7.8155C30.9511 7.7728 30.917 7.66603 30.917 7.49519V6.75208C30.917 6.55563 30.9426 6.4275 30.9937 6.36771C31.0534 6.30792 31.1813 6.27803 31.3773 6.27803H35.4562C35.6522 6.27803 35.7801 6.29938 35.8398 6.34209C35.908 6.3848 35.9421 6.50011 35.9421 6.68802V15.4388C35.9421 16.3442 36.1211 17.0703 36.4791 17.6169C36.8456 18.1636 37.4168 18.4369 38.1925 18.4369C38.9597 18.4369 39.6288 18.2148 40.2 17.7707C40.7796 17.318 41.2314 16.7201 41.5553 15.9769C41.8792 15.2253 42.0412 14.4096 42.0412 13.5298V8.31518C42.0412 8.11019 41.9986 7.98633 41.9133 7.94363C41.8366 7.89238 41.7045 7.86675 41.517 7.86675H40.1872C40.0593 7.86675 39.9613 7.85394 39.8931 7.82832C39.8334 7.79415 39.8036 7.71728 39.8036 7.59769V6.6624C39.8036 6.51719 39.8206 6.41896 39.8547 6.36771C39.8973 6.30792 39.9911 6.27803 40.136 6.27803H44.4451C44.59 6.27803 44.6795 6.30792 44.7136 6.36771C44.7477 6.41896 44.7647 6.52146 44.7647 6.67521V17.5657C44.7647 17.7621 44.7903 17.886 44.8414 17.9372C44.8926 17.9885 45.0204 18.0141 45.225 18.0141H46.6443C46.7722 18.0141 46.8745 18.0354 46.9512 18.0782C47.0279 18.1123 47.0663 18.1977 47.0663 18.3344V19.1672C47.0663 19.338 47.0492 19.4533 47.0151 19.5131C46.981 19.5729 46.8787 19.6028 46.7083 19.6028H42.5527C42.3566 19.6028 42.233 19.5729 42.1819 19.5131C42.1307 19.4448 42.1051 19.3081 42.1051 19.1031V17.6553C42.1051 17.5529 42.0753 17.4802 42.0156 17.4375C41.956 17.3863 41.875 17.4418 41.7727 17.6041C41.372 18.2789 40.8265 18.8298 40.136 19.2569C39.4456 19.684 38.542 19.8975 37.4253 19.8975C36.3598 19.8975 35.5201 19.7395 34.9064 19.4234C34.2926 19.1074 33.8579 18.6419 33.6022 18.0269C33.3464 17.4119 33.2186 16.6474 33.2186 15.7335Z" fill="var(--neutral-700)"/>
      <path d="M20.0527 12.6842C20.0527 13.7177 20.138 14.6786 20.3085 15.5669C20.4789 16.4553 20.7943 17.1728 21.2547 17.7194C21.7235 18.2661 22.3926 18.5394 23.2621 18.5394C23.9185 18.5394 24.4555 18.3856 24.8732 18.0782C25.2909 17.7707 25.6148 17.3607 25.845 16.8482C26.0837 16.3271 26.2456 15.7506 26.3309 15.1185C26.4246 14.4864 26.4715 13.8458 26.4715 13.1967C26.4715 12.1631 26.3863 11.2022 26.2158 10.3139C26.0453 9.42558 25.7256 8.70809 25.2568 8.16143C24.7965 7.61478 24.1316 7.34145 23.2621 7.34145C22.6143 7.34145 22.0772 7.4952 21.651 7.80269C21.2333 8.11019 20.9094 8.52445 20.6793 9.04548C20.4491 9.55798 20.2871 10.1303 20.1934 10.7623C20.0996 11.3944 20.0527 12.035 20.0527 12.6842ZM16.9328 13.2095C16.9328 11.8428 17.1673 10.6171 17.6361 9.53235C18.1049 8.43903 18.8082 7.57634 19.7459 6.94427C20.6835 6.30365 21.8556 5.98334 23.2621 5.98334C24.6686 5.98334 25.8407 6.29511 26.7784 6.91864C27.7161 7.53363 28.4193 8.34935 28.8882 9.36579C29.357 10.3822 29.5914 11.4884 29.5914 12.6842C29.5914 14.0508 29.357 15.2765 28.8882 16.3613C28.4193 17.4461 27.7161 18.3088 26.7784 18.9494C25.8407 19.5815 24.6686 19.8975 23.2621 19.8975C21.8556 19.8975 20.6835 19.59 19.7459 18.975C18.8082 18.36 18.1049 17.5443 17.6361 16.5279C17.1673 15.5114 16.9328 14.4053 16.9328 13.2095Z" fill="var(--neutral-700)"/>
      <path d="M12.3389 6.23959C12.2622 5.32565 11.9937 4.53128 11.5334 3.8565C11.0816 3.17318 10.4934 2.64361 9.76884 2.26778C9.0528 1.89195 8.25578 1.70404 7.37777 1.70404C5.97979 1.70404 4.97819 1.98591 4.37296 2.54965C3.77626 3.11339 3.47791 3.80952 3.47791 4.63805C3.47791 5.36408 3.67823 5.94491 4.07887 6.38052C4.48804 6.8076 5.02507 7.14926 5.68996 7.40551C6.36338 7.66176 7.10073 7.89238 7.90202 8.09737C8.7033 8.30237 9.50458 8.53299 10.3059 8.78924C11.1071 9.04548 11.8402 9.38287 12.5051 9.80141C13.1786 10.2199 13.7156 10.7751 14.1162 11.467C14.5254 12.1589 14.73 13.0515 14.73 14.1448C14.73 15.4004 14.4487 16.4681 13.8861 17.3479C13.3235 18.2191 12.5137 18.8811 11.4566 19.3338C10.3996 19.7779 9.13804 20 7.67186 20C6.68304 20 5.77521 19.8334 4.94835 19.5003C4.12149 19.1672 3.4225 18.7487 2.85138 18.2447C2.65532 18.0653 2.51467 17.9927 2.42942 18.0269C2.3527 18.0525 2.25894 18.1977 2.14812 18.4625L1.76453 19.3722C1.69633 19.543 1.62388 19.6455 1.54716 19.6797C1.47896 19.7139 1.32127 19.7309 1.07406 19.7309H0.511457C0.306875 19.7309 0.170486 19.701 0.102292 19.6413C0.0340973 19.59 0 19.4662 0 19.2697V13.3248C0 13.1369 0.0340973 13.0258 0.102292 12.9917C0.170486 12.949 0.302612 12.9276 0.498671 12.9276H1.21471C1.40225 12.9276 1.51732 12.966 1.55995 13.0429C1.61109 13.1113 1.64093 13.2266 1.64945 13.3889C1.72617 14.1918 1.99468 14.9776 2.455 15.7463C2.92383 16.5151 3.56315 17.1514 4.37296 17.6553C5.19129 18.1593 6.16732 18.4113 7.30105 18.4113C8.40069 18.4113 9.29148 18.2362 9.97342 17.886C10.6554 17.5272 11.154 17.0745 11.4694 16.5279C11.7848 15.9812 11.9425 15.426 11.9425 14.8623C11.9425 14.0594 11.7422 13.423 11.3416 12.9532C10.9409 12.4834 10.4039 12.1076 9.73048 11.8258C9.06558 11.5353 8.33249 11.2919 7.53121 11.0955C6.72993 10.8905 5.92864 10.6726 5.12736 10.442C4.32608 10.2114 3.59299 9.90391 2.92809 9.51954C2.2632 9.13517 1.72617 8.62268 1.317 7.98206C0.916361 7.34145 0.71604 6.50438 0.71604 5.47085C0.71604 4.54837 0.882264 3.754 1.21471 3.08777C1.54716 2.41298 2.00321 1.85351 2.58286 1.40935C3.17104 0.965193 3.84019 0.640615 4.59033 0.435618C5.34899 0.22208 6.14601 0.115311 6.98139 0.115311C7.80825 0.115311 8.58396 0.247705 9.30852 0.512491C10.0331 0.768738 10.6554 1.11894 11.1753 1.5631C11.3288 1.69976 11.4566 1.77237 11.5589 1.78091C11.6698 1.78091 11.7806 1.66133 11.8914 1.42217L12.275 0.563742C12.3176 0.486867 12.3517 0.439889 12.3773 0.422806C12.4114 0.397181 12.4881 0.384369 12.6074 0.384369H13.592C13.7625 0.384369 13.869 0.414265 13.9116 0.474056C13.9628 0.533847 13.9884 0.653428 13.9884 0.8328V6.38052C13.9884 6.56844 13.9543 6.67948 13.8861 6.71365C13.8179 6.74781 13.69 6.76489 13.5025 6.76489H12.8248C12.5691 6.76489 12.4284 6.735 12.4028 6.67521C12.3858 6.61542 12.3645 6.47021 12.3389 6.23959Z" fill="var(--neutral-700)"/>
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

/**
 * Default Organisation/admin nav — three groups, editable via `adminGroups`.
 * Source: Figma 3913:1460 (Organization nav) + Dust Company Data IA.
 * NOTE: row icons are provisional picks from @strange-huge/icons — the per-row
 * admin design isn't specced yet. Icons NOT in the library (flagged for addition):
 * group/people (Teams), globe (Websites), lightning (Triggers).
 */
export const DEFAULT_ADMIN_GROUPS: SidebarAdminGroup[] = [
  {
    id: 'organization',
    label: 'Organization',
    items: [
      { id: 'general',      label: 'General' },
      { id: 'members',      label: 'Members' },
      { id: 'teams',        label: 'Teams' },
      { id: 'plans-usage',  label: 'Plans & Usage' },
      { id: 'analytics',    label: 'Analytics' },
      { id: 'connectors',     label: 'Connectors' },
      { id: 'souvenir-slack', label: 'Souvenir in Slack' },
      { id: 'security',       label: 'Security' },
      { id: 'activity-log',   label: 'Activity Log' },
    ],
  },
  {
    id: 'company-data',
    label: 'Company Data',
    items: [
      { id: 'connected-data', label: 'Connected Data' },
      { id: 'folders',        label: 'Folders' },
      { id: 'websites',       label: 'Websites' },
      { id: 'tools',          label: 'Tools', children: [] }, // expandable; sub-items TBD
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

// Provisional icon map (see note on DEFAULT_ADMIN_GROUPS). Keyed by item id.
const ADMIN_ITEM_ICONS: Record<string, React.ReactElement<{ triggered?: boolean }>> = {
  'general':        <SettingsOneIcon size={20} />,
  'members':        <UserAddOneIcon size={20} />,
  'teams':          <DashboardSquareOneIcon size={20} />,   // provisional — no group icon
  'plans-usage':    <TokenCircleIcon size={20} />,
  'analytics':      <AnalyticsOneIcon size={20} />,
  'connectors':     <LinkSixIcon size={20} />,
  'security':       <ViewIcon size={20} />,
  'souvenir-slack': <SlackIcon size={20} />,
  'activity-log':   <PlayListIcon size={20} />,
  'connected-data': <ExchangeOneIcon size={20} />,
  'folders':        <FolderOneIcon size={20} />,
  'websites':       <GlobalSearchIcon size={20} />,         // provisional — no plain globe
  'tools':          <ShapesOneIcon size={20} />,
  'triggers':       <RadarThreeIcon size={20} />,           // provisional — no lightning
  'model-providers':   <BrainTwoIcon size={20} />,
  // Team settings sections (editor /teams/[id] nav)
  'team-projects':    <DashboardSquareOneIcon size={20} animated />,
  'team-connectors':  <LinkSixIcon size={20} animated />,
  'team-requests':    <PlusSignIcon size={20} animated />,
  'team-activity':    <AuditTwoIcon size={20} animated />,
}

const DEFAULT_AGENTS: SidebarAgent[] = [
  { id: 'agent-1', label: 'Folder name', chatItems: [{ id: 'agent-1-chat-0', label: 'Label' }, { id: 'agent-1-chat-1', label: 'Label' }] },
  { id: 'agent-2', label: 'Folder name', chatItems: [{ id: 'agent-2-chat-0', label: 'Label' }, { id: 'agent-2-chat-1', label: 'Label' }] },
]

const PROJECT_LIMIT = 2

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
  /** Called when the settings icon on the account item is clicked */
  onSettingsClick?: React.MouseEventHandler<HTMLButtonElement>
  /** Called when New chat is clicked */
  onNewChat?: () => void
  /** Called when Search is clicked */
  onSearch?: () => void
  /** Called when the sidebar collapse/toggle button is clicked */
  onCollapse?: () => void
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
  /** Fully custom Projects section content — replaces the entire projects area including header */
  projectItems?: React.ReactNode
  /**
   * Recent chats rendered in the Recents section. Each item is editable in
   * place (double-click → rename). Defaults to five "Label" placeholders.
   * The "Recents" header and show/hide toggle are always rendered by the
   * Sidebar — this prop only controls the row data.
   */
  recents?: SidebarRecentItem[]
  /**
   * Fully custom Recents section items — replaces the default chat rows.
   * **Removes the "Recents" header and show/hide toggle**, so prefer the
   * `recents` data prop unless you need a structurally different section.
   */
  recentItems?: React.ReactNode
  /**
   * Start in collapsed (icon-only) state.
   * The sidebar toggles internally; use `onCollapse` for external notification.
   * @default false
   */
  defaultCollapsed?: boolean
  /** Active tab. @default 'chats' */
  defaultSection?: 'chats' | 'agents' | 'brain' | 'admin'
  /** Back-compat active body section name used by app integrations. */
  defaultBodySection?: 'chats' | 'agents' | 'brain' | 'admin' | 'new-chat' | 'projects'
  /** Back-compat initial selected row id. */
  defaultSelectedItem?: string
  /** Back-compat selected state for the search row. */
  searchActive?: boolean
  /** Back-compat primary action label override. */
  newChatLabel?: string
  /** Back-compat selected state override for the primary action. */
  newChatButtonSelected?: boolean
  /** Back-compat hooks for app-level navigation side effects. */
  onChatTabClick?: () => void
  onChatsClick?: () => void
  onProjectsClick?: () => void
  onPersonasClick?: () => void
  onBrainClick?: () => void
  onAllBrainThreadsClick?: () => void
  /** Back-compat switches for callers that own these sections. */
  hideProjects?: boolean
  scheduledTasksItems?: React.ReactNode
  /**
   * Organisation name shown in the badge to the right of the wordmark.
   * When omitted, no badge renders. e.g. 'Flowting'.
   */
  orgName?: string
  /**
   * Organisation logo URL (any web image format — SVG/PNG/JPG/WebP), shown in the
   * badge avatar at 16×16. When omitted, the badge falls back to a monogram of the
   * org's first initial. The "add a logo" prompt lives on the org page, not here.
   */
  orgLogoSrc?: string
  /**
   * Stable org identifier used to deterministically assign the badge colour from
   * the KDS tag palette. Keyed on id (not name) so renames never change the colour.
   * Falls back to hashing `orgName` when omitted.
   */
  orgId?: string
  /**
   * Explicit badge colour override (one of the KDS tag colours). When omitted, the
   * colour is derived deterministically from `orgId` (or `orgName`).
   */
  orgColor?: ChipColor
  /** Back-compat secondary label shown in the interactive org badge. */
  orgBadgeSublabel?: string
  /** Back-compat org badge colour override alias. */
  orgBadgeChipColor?: ChipColor
  /**
   * When true, the org badge is an interactive entry into the org/admin space and
   * the org-entry icon appears in the collapsed rail. Hidden/static for non-admins
   * — only Owner/Admin roles should pass this. @default false
   */
  showAdmin?: boolean
  /**
   * Grouped Organisation/admin nav shown in the org section body. Each row routes
   * the main pane to its page via `onAdminSectionClick`. Defaults to the standard
   * three groups (Organization / Company Data / Models).
   */
  adminGroups?: SidebarAdminGroup[]
  /** Fires when an org/admin row is clicked — route the main pane to that page. */
  onAdminSectionClick?: (id: string) => void
  /** Fully custom org section content — replaces the default admin nav. */
  adminItems?: React.ReactNode
  /**
   * When true, shows a 6px filled red dot (top-right of the Brain icon) signalling
   * that a Brain run is paused and waiting for user action (HITL approval gate).
   * D-1 Level 1 — outermost signal: "something in Brain needs you."
   */
  brainNeedsInput?: boolean
  /**
   * Brain section schedules. Section renders only when at least one schedule exists.
   * Works like `projects` — the Sidebar renders the header, show/hide toggle, and items.
   */
  schedules?: SidebarSchedule[]
  /** Fires when a schedule row is clicked. Falls back to internal selection when omitted. */
  onScheduleClick?: (id: string) => void
  /** Called when "New thread" is clicked (Brain tab primary action). */
  onNewBrainThread?: () => void
  /** Agent folders shown in the Agents tab. Defaults to two demo folders. */
  agents?: SidebarAgent[]
  /** Fully custom Agents section content — replaces the entire agents area including header. */
  agentItems?: React.ReactNode
  /** Called when "New agent chat" is clicked (Agents tab primary action). */
  onNewAgentChat?: () => void
  /** Called when "New Agents" (create new agent) is clicked inside the agents list. */
  onNewAgent?: () => void
  /** Fires when an agent folder row is clicked. */
  onAgentClick?: (id: string) => void
  /** Back-compat hook: fires when the org section is entered (via the org badge or the collapsed-rail Organisation icon). */
  onOrganisationClick?: () => void
  /** Called when the Schedules quick-access item in the fixed menu is clicked (Brain tab). */
  onSchedulesClick?: () => void
  /** Called when "Chatboard" is clicked in the Chats nav strip (individual only). Only rendered when provided. */
  onChatboardClick?: () => void
  /** Called when "All Agents" is clicked in the Agents nav strip (individual only). When provided, replaces "New agent chat". */
  onAllAgentsClick?: () => void
  /** Called when "Manage All Threads" is clicked in the Brain nav strip (individual only). Only rendered when provided. */
  onManageAllThreadsClick?: () => void
  /** Called when "See all" is clicked in the Schedules section (Brain tab). */
  onShowAllSchedules?: () => void
  /** Custom Brain section thread items — replaces default recents when Brain is active */
  brainRecentItems?: React.ReactNode
  /**
   * Override: replaces the entire Schedules section including header.
   * Prefer the `schedules` data prop for standard usage.
   */
  brainScheduleItems?: React.ReactNode
  /**
   * Controlled "current chat" id — driven by the app router. When set, the
   * Sidebar highlights the matching chat row (in Recents or inside a project)
   * and auto-expands the parent project. The Sidebar itself never sets this
   * value; consumers update it after handling `onSelectChat`.
   */
  activeChatId?: string | null
  /**
   * Fires when the user clicks a chat row. Pair with `activeChatId` for
   * controlled selection: handle navigation in the consumer (e.g. router.push)
   * and then pass the new id back as `activeChatId`. If omitted, the Sidebar
   * falls back to its internal selection state so it still works standalone.
   */
  onSelectChat?: (id: string) => void
  /**
   * Render function for the footer account slot. Receives `collapsed` so the
   * consumer can pass it to AccountMenu and get icon-only mode for free.
   * Falls back to a bare SidebarMenuItem from userName/userEmail when omitted.
   */
  accountMenu?: (collapsed: boolean) => React.ReactNode
  // ── Teams / Enterprise ───────────────────────────────────────────────────────
  /** undefined = individual plan (no teams section). Teams = organisation member. */
  teams?: Array<{ id: string; name: string; projectCount: number; userRole: WorkspaceRole }>
  /** Id of the currently active team */
  activeTeamId?: string
  /** Defines this user's role within the org. undefined = individual (no role chip, no teams section). */
  currentUserRole?: WorkspaceRole
  /** Icon mode for all RoleBadge instances in this sidebar instance. @default 'solar' */
  roleMode?: RoleBadgeMode
  /** Called when the Manage Organisation item is clicked (owner/admin only). */
  onManageOrg?: () => void
  /** Pending org-update count shown as a trailing "N updated" Badge on the Manage Organisation row. Omit/0 → no badge. Figma 6459:101321. */
  orgUpdateCount?: number
  /** Individual billing tier. `'starter'` shows an "Update plan" pill next to the wordmark (Figma 6408:11921 Individual Starter); `'pro'` shows nothing (5525:29901 Individual Pro). Only applies to individuals (no org). */
  plan?: 'starter' | 'pro'
  /** Click handler for the "Update plan" pill (Starter only). */
  onUpgradeClick?: () => void
  /** Credits remaining — shown in the account drop-up (identity badge), all roles. */
  credits?: number
  /** Called when the user selects a different team via TeamSwitcherRow/Dropdown. */
  onTeamSwitch?: (teamId: string) => void
}

// ── Section show/hide animation ───────────────────────────────────────────────
// Same three-layer pattern as SidebarProjectsSection expand/collapse.

// Layer 1 — height clip
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

// Layer 2 — stagger orchestrator
// Open:  delay items until AFTER height animation completes (0.28s) so items never appear while clipped
// Close: no stagger — all items fade at once (0.12s), height shrinks after delay (0.14s)
const sectionStaggerVariants = {
  open: {
    transition: { staggerChildren: 0.04, delayChildren: 0.24 },
  },
  closed: {
    transition: {},
  },
}

// Layer 3 — per-item: fade + drift
const sectionItemVariants = {
  open:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' as const } },
  closed: { opacity: 0, y: 5, transition: { duration: 0.12, ease: 'easeIn'  as const } },
}

// ── Default content ────────────────────────────────────────────────────────────

// Persists across mounts — false on first sidebar load, true on every return to that section.
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
  currentUserRole?: WorkspaceRole
  roleMode?: RoleBadgeMode
  teams?: Array<{ id: string; name: string; projectCount: number; userRole: WorkspaceRole }>
  activeTeamId?: string
  onTeamSwitch?: (teamId: string) => void
  onTeamSwitcherClick?: () => void
}

function DefaultProjectItems({ projects, activeFolder, expandedFolders, selectedItem, activeChatId, onSelect, onChatClick, onFolderOpen, onFolderExpand, onShowAllProjects, currentUserRole, roleMode = 'solar', teams = [], activeTeamId, onTeamSwitch, onTeamSwitcherClick }: DefaultProjectItemsProps) {
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

  const activeTeam = teams.find(t => t.id === activeTeamId) ?? teams[0]
  const [teamSwitcherOpen, setTeamSwitcherOpen] = useState(false)

  return (
    <>
      {currentUserRole && activeTeam ? (
        // Team row opens the TeamSwitcherDropdown in place (floating popover,
        // click-outside/Esc to close) — the dropdown's wiring lives here in the
        // Sidebar per "Dropdowns Live at the Component Level". The flex-column
        // width:100% wrapper lets the fluid TeamSwitcherRow fill the width
        // (Dropdown.Float wraps the trigger in an inline-flex span otherwise).
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <Dropdown.Float
            open={teamSwitcherOpen}
            onOpenChange={setTeamSwitcherOpen}
            placement="bottom-start"
            trigger={
              <TeamSwitcherRow
                teamName={activeTeam.name}
                teamId={activeTeam.id}
                projectCount={activeTeam.projectCount}
                currentUserRole={currentUserRole}
                roleMode={roleMode}
                isOpen={teamSwitcherOpen}
                onClick={() => { setTeamSwitcherOpen(o => !o); onTeamSwitcherClick?.() }}
              />
            }
          >
            <TeamSwitcherDropdown
              teams={teams}
              activeTeamId={activeTeamId}
              currentUserRole={currentUserRole}
              roleMode={roleMode}
              onSelectTeam={(id) => { onTeamSwitch?.(id); setTeamSwitcherOpen(false) }}
              onSelectPersonal={() => setTeamSwitcherOpen(false)}
              onManageTeams={() => setTeamSwitcherOpen(false)}
            />
          </Dropdown.Float>
        </div>
      ) : (
        <SidebarMenuItem
          fluid
          variant="header"
          label="Personal projects"
          shown={shown}
          onShowClick={() => setShown(s => !s)}
          onViewAllClick={onShowAllProjects ? () => onShowAllProjects() : undefined}
        />
      )}
      {/* Persistent wrapper — never unmounts so items are always interactive.
          initial={false} ensures items start at their animate state on first render. */}
      <motion.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        <motion.div
          animate={shown ? 'open' : 'closed'}
          initial={shouldAnimate ? 'closed' : false}
          variants={sectionStaggerVariants}
          style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          {currentUserRole !== 'member' && (
            <motion.div variants={sectionItemVariants}>
              <SidebarMenuItem fluid variant="default" label="New project" icon={<FolderAddIcon size={20} />}
                selected={selectedItem === 'new-project'}
                onClick={() => onSelect('new-project')}
              />
            </motion.div>
          )}

          {visibleProjects.map((project) => (
            <motion.div key={project.id} variants={sectionItemVariants}>
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
                    // Controlled when activeChatId is provided; falls back to
                    // internal selectedItem otherwise so the Sidebar still
                    // works standalone (Storybook etc.).
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
            </motion.div>
          ))}

          {hasMore && (
            <motion.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                icon={<MoreHorizontalIcon size={20} />}
                label="See all"
                onClick={onShowAllProjects}
              />
            </motion.div>
          )}
        </motion.div>
      </motion.div>
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
      <motion.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        <motion.div
          animate={shown ? 'open' : 'closed'}
          initial={shouldAnimate ? 'closed' : false}
          variants={sectionStaggerVariants}
          style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          <motion.div variants={sectionItemVariants}>
            <SidebarMenuItem fluid variant="default" label="New agent" icon={<FolderAddIcon size={20} />}
              selected={selectedItem === 'new-agent'}
              onClick={() => { onSelect('new-agent'); onNewAgent?.() }}
            />
          </motion.div>

          {visibleAgents.map((agent) => (
            <motion.div key={agent.id} variants={sectionItemVariants}>
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
            </motion.div>
          ))}

          {hasMore && (
            <motion.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                icon={<MoreHorizontalIcon size={20} />}
                label="See all"
                onClick={() => onSelect('agents-see-all')}
              />
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </>
  )
}

// ── DefaultBrainScheduleItems ─────────────────────────────────────────────────
// Same three-layer stagger pattern as DefaultProjectItems.
// Renders only when schedules.length > 0 — the parent gates on this condition.

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
      <SidebarMenuItem
        fluid
        variant="header"
        label="Recent schedules"
        shown={shown}
        onShowClick={() => setShown(s => !s)}
        onViewAllClick={onShowAllSchedules ? () => onShowAllSchedules() : undefined}
      />
      <motion.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        <motion.div
          animate={shown ? 'open' : 'closed'}
          initial={shouldAnimate ? 'closed' : false}
          variants={sectionStaggerVariants}
          style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          {visibleSchedules.map((schedule) => (
            <motion.div key={schedule.id} variants={sectionItemVariants}>
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
            </motion.div>
          ))}

          {hasMore && (
            <motion.div variants={sectionItemVariants}>
              <SidebarMenuItem
                fluid
                variant="default"
                icon={<MoreHorizontalIcon size={20} />}
                label="See all"
                onClick={onShowAllSchedules}
              />
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </>
  )
}

// ── DefaultAdminItems ─────────────────────────────────────────────────────────
// Organisation/admin body — a grouped launcher nav. Each row routes the main pane
// via onAdminSectionClick. Each GROUP (Organization / Company Data / Models) is an
// independently collapsible block (Show/Hide header toggle, height animation); nested
// items (Tools) expand via SidebarProjectsSection. Icons are provisional (see DEFAULT_ADMIN_GROUPS).

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
      <motion.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        <motion.div
          animate={shown ? 'open' : 'closed'}
          initial={false}
          variants={sectionStaggerVariants}
          style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}
        >
          {group.items.map((item) => {
            const icon = ADMIN_ITEM_ICONS[item.id] ?? <SettingsOneIcon size={20} />
            // Nested (expandable) item — e.g. Tools. children=[] still shows the
            // expand affordance; sub-items are filled in once defined.
            if (item.children) {
              return (
                <motion.div key={item.id} variants={sectionItemVariants}>
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
                </motion.div>
              )
            }
            return (
              <motion.div key={item.id} variants={sectionItemVariants}>
                <SidebarMenuItem
                  fluid
                  variant="default"
                  label={item.label}
                  icon={icon}
                  selected={selectedItem === item.id}
                  onClick={() => onItemClick(item.id)}
                />
              </motion.div>
            )
          })}
        </motion.div>
      </motion.div>
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
  /** Changes when the active section changes — triggers item stagger re-animation */
  sectionKey: string
  /** Recent chat rows; defaults to five "Label" placeholders. */
  recents: SidebarRecentItem[]
  /** Section header label. Defaults to "Recents". Pass "Threads" for Brain mode. */
  sectionLabel?: string
}

function DefaultRecentItems({ selectedItem, activeChatId, onSelect: _onSelect, onChatClick, onShowAll, sectionKey, recents, sectionLabel = 'Recents' }: DefaultRecentItemsProps) {
  const [shown,        setShown]        = useState(true)
  const [overflow,     setOverflow]     = useState<'visible' | 'hidden'>('visible')
  // Skip stagger on first sidebar load; replay it on section switches (key remount).
  const hasAnimatedRef = useRef(false)
  useEffect(() => { hasAnimatedRef.current = true }, [])
  // Reset shown state whenever the active section changes so Recents always
  // starts expanded when switching between Chat Board, Persona, and Workflow.
  useEffect(() => { setShown(true) }, [sectionKey])
  const [editingItem,  setEditingItem]  = useState<string | null>(null)
  // Local mirror of the `recents` data so in-place rename can mutate labels
  // without round-tripping through the consumer. Re-syncs whenever the
  // incoming `recents` reference changes (e.g. consumer adds/removes rows).
  const [itemLabels,   setItemLabels]   = useState<Record<string, string>>(() =>
    Object.fromEntries(recents.map(r => [r.id, r.label]))
  )
  useEffect(() => {
    setItemLabels(Object.fromEntries(recents.map(r => [r.id, r.label])))
  }, [recents])

  return (
    <>
      <SidebarMenuItem
        fluid
        variant="header"
        label={sectionLabel}
        shown={shown}
        onShowClick={() => setShown(s => !s)}
        onViewAllClick={onShowAll}
        viewAllAlwaysVisible
      />
      {/* Layer 1 — height: controls shown/hidden toggle */}
      <motion.div
        animate={shown ? 'open' : 'closed'}
        initial={false}
        variants={sectionHeightVariants}
        style={{ overflow }}
        onAnimationStart={(def) => { if (def === 'closed') setOverflow('hidden') }}
        onAnimationComplete={(def) => { if (def === 'open') setOverflow('visible') }}
      >
        {/* Layer 2+3 — stagger: key={sectionKey} remounts on section switch to replay stagger;
            animate responds to shown so items fade+drift on show/hide toggle */}
          <motion.div
            key={sectionKey}
            animate={shown ? 'open' : 'closed'}
            initial={hasAnimatedRef.current ? 'closed' : false}
            variants={sectionStaggerVariants}
            style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px' }}
          >
            {recents.length === 0 ? (
              <div style={{ padding: '8px 6px', fontFamily: 'var(--font-body)', fontSize: 'var(--font-size-caption)', color: 'var(--neutral-400)' }}>
                {sectionKey === 'brain' ? 'No brain threads yet' : sectionKey === 'agents' ? 'No agent chats yet' : 'No recent chats'}
              </div>
            ) : recents.map(({ id }) => {
              const isSelected = activeChatId != null
                ? activeChatId === id
                : selectedItem === id
              return (
              <motion.div key={id} variants={sectionItemVariants}>
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
              </motion.div>
              )
            })}
          </motion.div>
      </motion.div>
    </>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  function Sidebar(
    {
      userName       = 'Label',
      userEmail      = 'Label',
      avatarSrc,
      onSettingsClick,
      onNewChat,
      onSearch,
      onCollapse,
      projects       = DEFAULT_PROJECTS,
      onShowAllProjects,
      projectItems,
      recents        = DEFAULT_RECENTS,
      recentItems,
      onShowAllRecents,
      defaultCollapsed  = false,
      defaultSection    = 'chats' as const,
      defaultBodySection,
      defaultSelectedItem,
      searchActive,
      newChatLabel,
      newChatButtonSelected,
      onChatTabClick,
      onChatsClick,
      onProjectsClick,
      onPersonasClick,
      onBrainClick,
      onAllBrainThreadsClick,
      hideProjects = false,
      scheduledTasksItems,
      brainNeedsInput   = false,
      schedules        = [],
      onScheduleClick,
      onNewBrainThread,
      agents           = DEFAULT_AGENTS,
      agentItems,
      onNewAgentChat,
      onNewAgent,
      onAgentClick,
      onOrganisationClick,
      orgName,
      orgLogoSrc,
      orgId,
      orgColor,
      orgBadgeSublabel,
      orgBadgeChipColor,
      showAdmin: showAdminProp = false,
      adminGroups         = DEFAULT_ADMIN_GROUPS,
      onAdminSectionClick,
      adminItems,
      onSchedulesClick,
      onChatboardClick,
      onAllAgentsClick,
      onManageAllThreadsClick,
      onShowAllSchedules,
      brainRecentItems,
      brainScheduleItems,
      activeChatId,
      onSelectChat,
      accountMenu,
      teams         = [],
      activeTeamId,
      currentUserRole,
      roleMode      = 'solar',
      onManageOrg,
      orgUpdateCount,
      plan,
      onUpgradeClick,
      credits,
      onTeamSwitch,
      className,
      ...props
    },
    ref,
  ) {
    const showAdmin = currentUserRole !== undefined
      ? (currentUserRole === 'owner' || currentUserRole === 'admin')
      : showAdminProp

    const [isCollapsed,      setIsCollapsed]      = useState(defaultCollapsed)
    const [collapseHovered,  setCollapseHovered]  = useState(false)
    const [atScrollTop,      setAtScrollTop]      = useState(true)
    const [atScrollBottom,   setAtScrollBottom]   = useState(false)

    // Measured header height — the absolute top zone (logo + tab strip + nav strip)
    // varies by section (nav-row count) and mode (collapsed). Measuring it with a
    // ResizeObserver keeps the scroll body and top scroll-fade anchored to the real
    // header bottom, so there are no hand-tuned per-section pixel offsets to drift.
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

    // Scroll-position memory across collapse ↔ expand. When collapsing, the
    // body's overflow flips to `hidden`; if we leave scrollTop where it was,
    // the user's existing offset clips the top section (Chat board / Persona /
    // Workflow) out of view. So we stash scrollTop, jump to 0 on collapse, and
    // restore it on expand. Per-frame restore via rAF — the layout has to
    // settle (overflow flipping back to `auto`) before scrollTop will stick.
    const bodyScrollRef       = useRef<HTMLDivElement>(null)
    const savedScrollTopRef   = useRef(0)
    useEffect(() => {
      const el = bodyScrollRef.current
      if (!el) return
      if (isCollapsed) {
        savedScrollTopRef.current = el.scrollTop
        el.scrollTop = 0
      } else {
        // Wait for the next frame so `overflow: auto` has reapplied before
        // assigning scrollTop, otherwise the assignment is silently ignored.
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
    const [selectedItem,    setSelectedItem]    = useState<string | null>(defaultSelectedItem ?? null)
    // bodySection mirrors the active tab: 'chats' | 'agents' | 'brain' | 'admin'.
    const initialBodySection =
      defaultBodySection === 'projects' ? 'chats'
      : defaultBodySection === 'new-chat' ? 'chats'
      : defaultBodySection ?? defaultSection
    const [bodySection, setBodySection] = useState<'chats' | 'agents' | 'brain' | 'admin'>(initialBodySection)

    // Switch tab — clears folder/item selection so body starts fresh.
    // Entering Admin also fires onOrganisationClick (back-compat "opened org space" hook).
    const onSelectSection = (section: 'chats' | 'agents' | 'brain' | 'admin') => {
      setBodySection(section)
      setActiveFolder(null)
      if (section === 'chats') onChatTabClick?.()
      if (section === 'agents') onPersonasClick?.()
      if (section === 'brain') onBrainClick?.()
      if (section === 'admin') onOrganisationClick?.()
    }
    // Select any non-section item (chat items, new-project, etc.) — preserves bodySection
    const onSelect = (id: string) => { setSelectedItem(id); setActiveFolder(null) }
    // Chat-row click — controlled flow when consumer provides onSelectChat: fire
    // the callback and let the consumer drive `activeChatId` back; otherwise
    // fall back to internal selection so standalone use still highlights.
    const handleChatClick = (id: string) => {
      if (onSelectChat) onSelectChat(id)
      else onSelect(id)
    }
    // Row click — only sets active folder; never affects expansion (icon-only)
    const handleFolderOpen = (id: string) => {
      setActiveFolder(id)
      setSelectedItem(null)
    }
    // Icon click — toggle expansion only; never touches active folder selection
    const handleFolderExpand = (id: string, expanded: boolean) => {
      setExpandedFolders(prev => {
        const next = new Set(prev)
        expanded ? next.add(id) : next.delete(id)
        return next
      })
    }

    // Auto-expand the project that contains `activeChatId` so the user's
    // current chat is always visible in context. Only adds — never collapses
    // other folders (per the Multiple-folders-can-be-expanded rule).
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

    // ⌘B / Ctrl+B — collapse/expand sidebar (skip when focus is inside a text input)
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
          isolation:       'isolate',
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
          {/* ── Logo row — single persistent toggle button so variant swap animates ── */}
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            paddingTop:     '24px',
            paddingBottom:  '8px',
            paddingLeft:    isCollapsed ? '8px' : '20px',
            paddingRight:   '8px',
          }}>
            {/* Wordmark + org badge — only in expanded. flex:1 + minWidth:0 +
                overflow:hidden so a long org name truncates instead of
                overlapping the collapse button (which stays flexShrink:0). */}
            {!isCollapsed && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 auto', minWidth: 0, marginRight: '4px' }}>
                <span style={{ display: 'inline-flex', flexShrink: 0 }}><SouvenirWordmark /></span>
                {orgName && (currentUserRole === undefined || currentUserRole === 'owner' || currentUserRole === 'admin' || currentUserRole === 'editor') && (
                  <OrgBadge
                    orgName={orgName}
                    orgLogoSrc={orgLogoSrc}
                    orgId={orgId}
                    color={orgBadgeChipColor ?? orgColor}
                    sublabel={orgBadgeSublabel}
                    interactive={showAdmin}
                    active={bodySection === 'admin'}
                    onClick={showAdmin ? () => onSelectSection('admin') : undefined}
                    maxNameWidth={96}
                  />
                )}
                {/* Individual Starter — "Update plan" upgrade pill in the wordmark
                    slot (Figma 6408:11921). Individual only (no org); Pro shows none. */}
                {!orgName && plan === 'starter' && (
                  <button
                    type="button"
                    onClick={onUpgradeClick}
                    aria-label="Update plan"
                    className="kds-org-badge"
                    style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', display: 'inline-flex', flexShrink: 0, borderRadius: '6px' }}
                  >
                    <Badge color="Neutral" label="Update plan" />
                  </button>
                )}
              </div>
            )}

            {/* Single stable toggle button — variant flips, no unmount/remount */}
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
          </div>

          {/* ── Tab strip — 3 fluid tabs (Chats / Agents / Brain), all labels shown.
                Org/admin is NOT a tab — it's entered via the badge (see logo row).
                When in org mode (bodySection 'admin') no tab is active, so the pill
                retracts. Hidden when collapsed (replaced by the vertical icon rail). ── */}
          {!isCollapsed && (
            <div style={{ paddingLeft: '12px', paddingRight: '12px' }}>
              {/* Tab-background card — Figma 6459:101321 / 6460:102861. For owner/
                  admin it groups the tabs + the "Manage Organisation" row (with its
                  "N updated" badge) on the rgba(247,242,237,0.5) surface; for other
                  roles it's an unstyled wrapper around just the tabs. */}
              <div style={{
                display:       'flex',
                flexDirection: 'column',
                gap:           '4px',
                ...(showAdmin && bodySection !== 'admin' ? {
                  padding:         '4px',
                  borderRadius:    '12px',
                  backgroundColor: 'rgba(247,242,237,0.5)',
                  boxShadow:       'inset 0px -1px 0px 0px rgba(255,255,255,0.9), inset 0px 1px 0px 0px var(--neutral-100), inset 0px 0px 4px 0px rgba(209,198,189,0.5)',
                } : {}),
              }}>
                <Tabs
                  value={bodySection === 'admin' ? '' : bodySection}
                  onValueChange={(v) => onSelectSection(v as 'chats' | 'agents' | 'brain')}
                >
                  <TabsList fluid>
                    <TabsTrigger value="chats"  icon={<BubbleChatIcon    size={16} />}>Chats</TabsTrigger>
                    <TabsTrigger value="agents" icon={<UserAiIcon        size={16} />}>Agents</TabsTrigger>
                    <TabsTrigger value="brain"  icon={<NeuralNetworkIcon size={16} />}>Brain</TabsTrigger>
                  </TabsList>
                </Tabs>
                {showAdmin && bodySection !== 'admin' && (
                  <SidebarMenuItem
                    fluid
                    variant="default"
                    icon={<CourtHouseIcon size={16} />}
                    label={orgName ? `Manage ${orgName}` : 'Manage Organisation'}
                    trailing={orgUpdateCount ? <Badge color="Neutral" label={`${orgUpdateCount} updated`} /> : undefined}
                    onClick={onManageOrg}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Nav strip — Primary action + Search ── */}
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
            {/* Manage Organisation — collapsed rail only (the expanded row lives
                in the tab-background card above). Owner/admin, non-admin section. */}
            {showAdmin && bodySection !== 'admin' && isCollapsed && (
              <SidebarMenuItem
                collapsed
                variant="default"
                icon={<CourtHouseIcon size={16} />}
                label={orgName ? `Manage ${orgName}` : 'Manage Organisation'}
                onClick={onManageOrg}
              />
            )}

            {/* New chat / New agent chat / New thread — primary action.
                Admin has no primary action: its body IS the org nav list.
                Individual agents tab: "All Agents" replaces this button when onAllAgentsClick is provided. */}
            {bodySection !== 'admin' && !(bodySection === 'agents' && onAllAgentsClick) && (
              <SidebarMenuItem
                {...(isCollapsed ? { collapsed: true } : { fluid: true })}
                variant="new-chat"
                label={newChatLabel ?? (
                  bodySection === 'agents' ? 'New agent chat'
                  : bodySection === 'brain' ? 'New thread'
                  : 'New chat'
                )}
                selected={newChatButtonSelected ?? selectedItem === 'new-item'}
                onClick={() => {
                  setSelectedItem('new-item')
                  setActiveFolder(null)
                  if (bodySection === 'agents') onNewAgentChat?.()
                  else if (bodySection === 'brain') onNewBrainThread?.()
                  else onNewChat?.()
                }}
              />
            )}
            {/* All Agents — individual Agents tab only (replaces "New agent chat"). */}
            {bodySection === 'agents' && onAllAgentsClick && (
              <SidebarMenuItem
                {...(isCollapsed ? { collapsed: true } : { fluid: true })}
                variant="default"
                icon={<UserAiIcon size={20} />}
                label="All Agents"
                onClick={onAllAgentsClick}
              />
            )}
            {/* Search — menu row (⌘K) when expanded, icon when collapsed.
                Single global entry point; no per-section search. */}
            <SidebarMenuItem
              {...(isCollapsed ? { collapsed: true } : { fluid: true })}
              variant="default"
              icon={<SearchOneIcon size={20} />}
              label="Search"
              shortcut={isCollapsed ? undefined : '⌘ K'}
              selected={searchActive}
              onClick={(e) => { (e.currentTarget as HTMLElement).blur(); onSearch?.() }}
            />
            {/* Chatboard — individual Chats tab only. */}
            {bodySection === 'chats' && onChatboardClick && (
              <SidebarMenuItem
                {...(isCollapsed ? { collapsed: true } : { fluid: true })}
                variant="default"
                icon={<BubbleChatIcon size={20} />}
                label="Chatboard"
                onClick={onChatboardClick}
              />
            )}
            {/* All Brain Threads — Brain tab, both individual and teams. */}
            {bodySection === 'brain' && onManageAllThreadsClick && (
              <SidebarMenuItem
                {...(isCollapsed ? { collapsed: true } : { fluid: true })}
                variant="default"
                icon={<BubbleChatIcon size={20} />}
                label="All Brain Threads"
                onClick={onManageAllThreadsClick}
              />
            )}
            {/* Schedules quick-access — Brain only. Visible collapsed too (icon-only). */}
            {bodySection === 'brain' && (
              <SidebarMenuItem
                {...(isCollapsed ? { collapsed: true } : { fluid: true })}
                variant="default"
                icon={<CalendarFoldIcon size={20} />}
                label="Schedules"
                onClick={onSchedulesClick}
              />
            )}
            {/* Collapsed-only: section-switch icons (Chats / Agents / Brain) + an
                Organisation entry (the badge isn't available collapsed). Tabs are
                hidden in collapsed mode; these icons replace them. Org gated on showAdmin. */}
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
        {/* top: measured header height (logo + tab strip + nav strip) */}
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

          {/* Projects/Agents/Brain + Recents — always mounted so shown/scroll state survives collapse/expand.
              motion.div animates opacity+blur in/out on collapse/expand; pointerEvents:none when invisible. */}
          <motion.div
            animate={{ opacity: isCollapsed ? 0 : 1, filter: isCollapsed ? 'blur(4px)' : 'blur(0px)' }}
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{ display: 'flex', flexDirection: 'column', pointerEvents: isCollapsed ? 'none' : 'auto' }}
          >
            {/* Projects (chats) / Agents / Brain Projects + Schedules (brain) — mutually exclusive */}
            <AnimatePresence initial={false}>
              {bodySection === 'chats' && !hideProjects && (
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
                        currentUserRole={currentUserRole}
                        roleMode={roleMode}
                        teams={teams}
                        activeTeamId={activeTeamId}
                        onTeamSwitch={onTeamSwitch}
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
              {bodySection === 'brain' && (
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
                    {scheduledTasksItems}
                    {/* Schedules — only when at least one exists */}
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

            {/* Recents — not shown in Admin (its body is the org nav list only) */}
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
                  {recentItems ?? (
                    bodySection === 'brain' && brainRecentItems != null
                      ? brainRecentItems
                      : <DefaultRecentItems selectedItem={selectedItem} activeChatId={activeChatId} onSelect={onSelect} onChatClick={handleChatClick} onShowAll={onShowAllRecents} sectionKey={bodySection} recents={recents} sectionLabel={bodySection === 'brain' ? 'Recent brain threads' : bodySection === 'agents' ? 'Recent agent chats' : 'Recent chats'} />
                  )}
                </div>
              </div>
            )}
          </motion.div>

        </div>

        {/* ── Top scroll fade — blur (behind) + gradient (on top) ── */}
        {[
          { height: 40, blur: 2 },
          { height: 28, blur: 3 },
          { height: 18, blur: 5 },
          { height: 10, blur: 6 },
        ].map(({ height, blur }) => (
          <div key={blur} aria-hidden style={{
            position:            'absolute',
            top:                 headerH,
            left:                0, right: 0,
            height:              `${height}px`,
            backdropFilter:      `blur(${blur}px)`,
            WebkitBackdropFilter:`blur(${blur}px)`,
            maskImage:           'linear-gradient(to bottom, black 0%, transparent 100%)',
            WebkitMaskImage:     'linear-gradient(to bottom, black 0%, transparent 100%)',
            pointerEvents:       'none',
            zIndex:              5,
            opacity:             atScrollTop ? 0 : 1,
            transition:          'opacity 150ms ease',
          }} />
        ))}
        <div aria-hidden style={{
          position:      'absolute',
          top:           headerH,
          left:          0, right: 0,
          height:        '40px',
          background:    'linear-gradient(to bottom, var(--neutral-50) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex:        6,
          opacity:       atScrollTop ? 0 : 1,
          transition:    'opacity 150ms ease',
        }} />

        {/* ── Bottom scroll fade — blur (behind) + gradient (on top) ── */}
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

        {/* ── Absolute bottom: account item ── */}
        <div style={{
          position:        'absolute',
          bottom:          0,
          left:            isCollapsed ? '50%' : 0,
          right:           isCollapsed ? 'auto' : 0,
          transform:       isCollapsed ? 'translateX(-50%)' : undefined,
          width:           isCollapsed ? '52px' : undefined,
          zIndex:          10,
          backgroundColor: 'var(--neutral-50)',
          paddingLeft:     isCollapsed ? '4px' : '10px',
          paddingRight:    isCollapsed ? '4px' : '10px',
          paddingTop:      '12px',
          paddingBottom:   '12px',
          overflow:        'hidden',
        }}>
          {accountMenu ? accountMenu(isCollapsed) : (
            /* Default footer = the AccountMenu drop-up (its own trigger row +
               menu), per "Dropdowns Live at the Component Level". Role-gated:
               Organization = owner/admin; Upgrade Plan = individuals; credits =
               all. Consumers needing custom handlers use the `accountMenu` prop. */
            <AccountMenu
              name={userName}
              plan={orgName ? `Teams | ${orgName}` : plan === 'pro' ? 'Pro' : plan === 'starter' ? 'Starter' : userEmail}
              credits={credits}
              avatarSrc={avatarSrc}
              collapsed={isCollapsed}
              panelWidth={274}
              roleBadge={currentUserRole ? (
                <RoleBadge role={currentUserRole} showLabel={false} mode={roleMode} />
              ) : undefined}
              showOrganization={currentUserRole === 'owner' || currentUserRole === 'admin'}
              showUpgradePlan={currentUserRole === undefined}
              onSettings={onSettingsClick ? () => onSettingsClick({} as React.MouseEvent<HTMLButtonElement>) : undefined}
              onOrganization={(currentUserRole === 'owner' || currentUserRole === 'admin') ? onManageOrg : undefined}
              onUpgradePlan={currentUserRole === undefined ? onUpgradeClick : undefined}
            />
          )}
        </div>

      </div>
    )
  },
)

Sidebar.displayName = 'Sidebar'

export default Sidebar

// ── Re-exports ────────────────────────────────────────────────────────────────
export { SidebarProvider, useSidebar } from './context'
export type { SidebarContextValue, SidebarProviderProps } from './context'
