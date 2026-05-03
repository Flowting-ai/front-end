'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
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
} from '@strange-huge/icons'
import { useAuth } from '@/context/auth-context'
import { SidebarMenuItem } from '@/components/SidebarMenuItem'
import { SidebarProjectsSection } from '@/components/SidebarProjectsSection'
import { IconButton } from '@/components/IconButton'

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

// ── Account Dropdown Component ────────────────────────────────────────────────

interface AccountDropdownProps {
  userName?: string
  userEmail?: string
  avatarSrc?: string
  avatarInitials?: string
  onSettingsClick?: () => void
  isCollapsed?: boolean
}

function AccountDropdown({ userName = 'Label', userEmail = 'Label', avatarSrc, avatarInitials, onSettingsClick, isCollapsed }: AccountDropdownProps) {
  const router = useRouter()
  const { logout } = useAuth()

  const menuItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 12px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 'var(--font-weight-medium)',
    fontSize: 'var(--font-size-body)',
    lineHeight: 'var(--line-height-body)',
    color: 'var(--neutral-700)',
    outline: 'none',
    userSelect: 'none',
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <SidebarMenuItem
          {...(isCollapsed ? { collapsed: true } : { fluid: true })}
          variant="account-item"
          label={userName}
          sublabel={userEmail}
          avatarSrc={avatarSrc}
          avatarInitials={avatarInitials}
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align={isCollapsed ? 'center' : 'start'}
          sideOffset={8}
          style={{
            backgroundColor: 'var(--neutral-white)',
            borderRadius: '12px',
            padding: '4px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
            zIndex: 200,
            minWidth: '200px',
            outline: 'none',
          }}
        >
          {/* Account info header */}
          <div
            style={{
              padding: '10px 12px 8px',
              borderBottom: '1px solid var(--neutral-100)',
              marginBottom: '4px',
            }}
          >
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-body)',
                fontWeight: 'var(--font-weight-semibold)',
                fontSize: 'var(--font-size-body)',
                color: 'var(--neutral-800)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {userName || 'Account'}
            </p>
            {userEmail && (
              <p
                style={{
                  margin: '2px 0 0',
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--font-size-caption)',
                  color: 'var(--neutral-500)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {userEmail}
              </p>
            )}
          </div>

          {/* Account */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => router.push('/account')}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--neutral-50)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
            }
          >
            Account
          </DropdownMenu.Item>

          {/* Settings */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => onSettingsClick ? onSettingsClick() : router.push('/settings')}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--neutral-50)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
            }
          >
            Settings
          </DropdownMenu.Item>

          {/* Help */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => window.open('https://help.example.com', '_blank')}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--neutral-50)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
            }
          >
            Help
          </DropdownMenu.Item>

          <DropdownMenu.Separator
            style={{
              height: '1px',
              backgroundColor: 'var(--neutral-100)',
              margin: '4px 0',
            }}
          />

          {/* Sign out */}
          <DropdownMenu.Item
            style={menuItemStyle}
            onSelect={() => logout()}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--neutral-50)')
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')
            }
          >
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SidebarProject {
  id: string
  label: string
  chatItems?: Array<{ id: string; label: string }>
}

const PROJECT_LIMIT = 5

const DEFAULT_PROJECTS: SidebarProject[] = [
  { id: 'folder-1', label: 'Folder name', chatItems: [{ id: 'folder-1-chat-0', label: 'Label' }, { id: 'folder-1-chat-1', label: 'Label' }] },
  { id: 'folder-2', label: 'Folder name', chatItems: [{ id: 'folder-2-chat-0', label: 'Label' }, { id: 'folder-2-chat-1', label: 'Label' }] },
  { id: 'folder-3', label: 'Folder name', chatItems: [{ id: 'folder-3-chat-0', label: 'Label' }, { id: 'folder-3-chat-1', label: 'Label' }] },
]

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  userName?: string
  userEmail?: string
  avatarSrc?: string
  avatarInitials?: string
  onSettingsClick?: () => void
  onNewChat?: () => void
  onSearch?: () => void
  onCollapse?: () => void
  onShowAllRecents?: React.MouseEventHandler<HTMLButtonElement>
  projects?: SidebarProject[]
  onShowAllProjects?: () => void
  projectItems?: React.ReactNode
  recentItems?: React.ReactNode
  defaultCollapsed?: boolean
}

// ── Section show/hide animation ───────────────────────────────────────────────

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

const sectionStaggerVariants = {
  open: {
    transition: { staggerChildren: 0.04, delayChildren: 0.24 },
  },
  closed: {
    transition: {},
  },
}

const sectionItemVariants = {
  open:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' as const } },
  closed: { opacity: 0, y: 5, transition: { duration: 0.12, ease: 'easeIn'  as const } },
}

// ── Default content ────────────────────────────────────────────────────────────

let projectsAnimatedOnce = false
let recentItemsAnimatedOnce = false

interface DefaultProjectItemsProps {
  projects: SidebarProject[]
  activeFolder: string | null
  expandedFolders: Set<string>
  selectedItem: string | null
  onSelect: (id: string) => void
  onFolderOpen: (id: string) => void
  onFolderExpand: (id: string, expanded: boolean) => void
  onShowAllProjects?: () => void
}

function DefaultProjectItems({ projects, activeFolder, expandedFolders, selectedItem, onSelect, onFolderOpen, onFolderExpand, onShowAllProjects }: DefaultProjectItemsProps) {
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
            <SidebarMenuItem fluid variant="default" label="New project" icon={<FolderAddIcon size={20} />}
              selected={selectedItem === 'new-project'}
              onClick={() => onSelect('new-project')}
            />
          </motion.div>

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
                  ...project.chatItems.map((chat) => (
                    <SidebarMenuItem
                      key={chat.id}
                      fluid
                      variant={editingItem === chat.id ? 'chat-item-edit' : 'chat-item'}
                      label={chatLabels[chat.id] ?? chat.label}
                      selected={selectedItem === chat.id}
                      onClick={() => onSelect(chat.id)}
                      onDoubleClick={() => { if (selectedItem === chat.id) setEditingItem(chat.id) }}
                      onRename={() => setEditingItem(chat.id)}
                      onCommit={(val) => { setChatLabels(prev => ({ ...prev, [chat.id]: val || prev[chat.id] })); setEditingItem(null) }}
                      onCancel={() => setEditingItem(null)}
                    />
                  )),
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
                label="Show all"
                onClick={onShowAllProjects}
              />
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </>
  )
}

interface DefaultRecentItemsProps {
  selectedItem: string | null
  onSelect: (id: string) => void
  onShowAll?: React.MouseEventHandler<HTMLButtonElement>
  sectionKey: string
}

function DefaultRecentItems({ selectedItem, onSelect, onShowAll }: Omit<DefaultRecentItemsProps, 'sectionKey'>) {
  const [shown,        setShown]        = useState(true)
  const [overflow,     setOverflow]     = useState<'visible' | 'hidden'>('visible')
  const shouldAnimate = recentItemsAnimatedOnce
  useEffect(() => { recentItemsAnimatedOnce = true }, [])
  const [editingItem,  setEditingItem]  = useState<string | null>(null)
  const [itemLabels,   setItemLabels]   = useState<Record<string, string>>(() =>
    Object.fromEntries((['recent-0','recent-1','recent-2','recent-3','recent-4'] as const).map(id => [id, 'Label']))
  )

  const handleToggle: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    setShown(s => !s)
    onShowAll?.(e)
  }

  return (
    <>
      <SidebarMenuItem fluid variant="header" label="Recents" shown={shown} onShowClick={handleToggle} />
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
            {(['recent-0', 'recent-1', 'recent-2', 'recent-3', 'recent-4'] as const).map((id) => (
              <motion.div key={id} variants={sectionItemVariants}>
                <SidebarMenuItem
                  fluid
                  variant={editingItem === id ? 'chat-item-edit' : 'chat-item'}
                  label={itemLabels[id]}
                  selected={selectedItem === id}
                  onClick={() => onSelect(id)}
                  onDoubleClick={() => { if (selectedItem === id) setEditingItem(id) }}
                  onRename={() => setEditingItem(id)}
                  onCommit={(val) => { setItemLabels(prev => ({ ...prev, [id]: val || prev[id] })); setEditingItem(null) }}
                  onCancel={() => setEditingItem(null)}
                />
              </motion.div>
            ))}
          </motion.div>
      </motion.div>
    </>
  )
}

// ── Recents section wrapper (used when real recentItems are provided) ──────────

interface RecentsSectionWrapperProps {
  children: React.ReactNode
  onShowAll?: React.MouseEventHandler<HTMLButtonElement>
}

function RecentsSectionWrapper({ children, onShowAll }: RecentsSectionWrapperProps) {
  const [shown,    setShown]    = useState(true)
  const [overflow, setOverflow] = useState<'visible' | 'hidden'>('visible')
  const shouldAnimate = recentItemsAnimatedOnce
  useEffect(() => { recentItemsAnimatedOnce = true }, [])

  const handleToggle: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    setShown(s => !s)
    onShowAll?.(e)
  }

  return (
    <>
      <SidebarMenuItem fluid variant="header" label="Recents" shown={shown} onShowClick={handleToggle} />
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
          {children}
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
      avatarInitials,
      onSettingsClick: _onSettingsClick,
      onNewChat,
      onSearch,
      onCollapse,
      projects       = DEFAULT_PROJECTS,
      onShowAllProjects,
      projectItems,
      recentItems,
      onShowAllRecents,
      defaultCollapsed = false,
      className,
      ...props
    },
    ref,
  ) {
    const [isCollapsed,      setIsCollapsed]      = useState(defaultCollapsed)
    const [collapseHovered,  setCollapseHovered]  = useState(false)
    const [atScrollTop,      setAtScrollTop]      = useState(true)
    const [atScrollBottom,   setAtScrollBottom]   = useState(false)

    const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget
      setAtScrollTop(el.scrollTop < 34)
      setAtScrollBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
    }
    const [activeFolder,    setActiveFolder]    = useState<string | null>(null)
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
    const [selectedItem,    setSelectedItem]    = useState<string | null>(null)
    const [bodySection, setBodySection] = useState<'chat-board' | 'persona' | 'workflow'>('chat-board')

    const onSelectSection = (section: 'chat-board' | 'persona' | 'workflow') => {
      setBodySection(section)
      setSelectedItem(section)
      setActiveFolder(null)
    }
    const onSelect = (id: string) => { setSelectedItem(id); setActiveFolder(null) }
    const handleFolderOpen = (id: string) => {
      setActiveFolder(id)
      setSelectedItem(null)
    }
    const handleFolderExpand = (id: string, expanded: boolean) => {
      setExpandedFolders(prev => {
        const next = new Set(prev)
        expanded ? next.add(id) : next.delete(id)
        return next
      })
    }
    const handleCollapse = useCallback(() => {
      setIsCollapsed(v => !v)
      onCollapse?.()
    }, [onCollapse])

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
        className={cn(className)}
        style={{
          position:        'relative',
          display:         'flex',
          flexDirection:   'column',
          width:           isCollapsed ? '52px' : '294px',
          height:          '100%',
          backgroundColor: 'var(--neutral-50)',
          overflowX:       'hidden',
          flexShrink:      0,
          transition:      'width 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        {...props}
      >

        {/* ── Absolute top: logo + collapse + nav items ── */}
        <div style={{
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
          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            paddingTop:     '24px',
            paddingBottom:  '8px',
            paddingLeft:    isCollapsed ? '8px' : '20px',
            paddingRight:   '8px',
          }}>
            {!isCollapsed && <SouvenirWordmark />}

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
            <SidebarMenuItem
              {...(isCollapsed ? { collapsed: true } : { fluid: true })}
              variant="new-chat"
              label="New chat"
              selected={selectedItem === 'new-chat'}
              onClick={() => { setBodySection('chat-board'); setSelectedItem('new-chat'); setActiveFolder(null); onNewChat?.() }}
            />
            <SidebarMenuItem
              {...(isCollapsed ? { collapsed: true } : { fluid: true })}
              variant="default"
              icon={<SearchOneIcon size={20} />}
              label="Search"
              shortcut="⌘ K"
              onClick={(e) => { (e.currentTarget as HTMLElement).blur(); onSearch?.() }}
            />
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className={isCollapsed ? undefined : 'kaya-scrollbar'} onScroll={handleBodyScroll} style={{
          position:      'absolute',
          top:           '148px',
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

          <div style={{
            display:       'flex',
            flexDirection: 'column',
            alignItems:    isCollapsed ? 'center' : 'stretch',
            gap:           '4px',
            paddingTop:    '12px',
            paddingLeft:   '8px',
            paddingRight:  '8px',
            paddingBottom: '8px',
            flexShrink:    0,
          }}>
            <SidebarMenuItem
              {...(isCollapsed ? { collapsed: true } : { fluid: true })}
              variant="default"
              icon={<BubbleChatIcon size={20} />}
              label="Chat board"
              selected={selectedItem === 'chat-board'}
              onClick={() => onSelectSection('chat-board')}
            />
            <SidebarMenuItem
              {...(isCollapsed ? { collapsed: true } : { fluid: true })}
              variant="default"
              icon={<UserAiIcon size={20} />}
              label="Persona"
              selected={selectedItem === 'persona'}
              onClick={() => onSelectSection('persona')}
            />
            <SidebarMenuItem
              {...(isCollapsed ? { collapsed: true } : { fluid: true })}
              variant="default"
              icon={<NeuralNetworkIcon size={20} />}
              label="Workflow"
              selected={selectedItem === 'workflow'}
              onClick={() => onSelectSection('workflow')}
            />
          </div>

          <motion.div
            animate={{ opacity: isCollapsed ? 0 : 1, filter: isCollapsed ? 'blur(4px)' : 'blur(0px)' }}
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            style={{ display: 'flex', flexDirection: 'column', pointerEvents: isCollapsed ? 'none' : 'auto' }}
          >
            <AnimatePresence initial={false}>
              {bodySection === 'chat-board' && (
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
                        onSelect={onSelect}
                        onFolderOpen={handleFolderOpen}
                        onFolderExpand={handleFolderExpand}
                        onShowAllProjects={onShowAllProjects}
                      />
                    )}
                  </div>
                </div>
              )}
            </AnimatePresence>

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
                {recentItems
                  ? <RecentsSectionWrapper onShowAll={onShowAllRecents}>{recentItems}</RecentsSectionWrapper>
                  : <DefaultRecentItems key={bodySection} selectedItem={selectedItem} onSelect={onSelect} onShowAll={onShowAllRecents} />
                }
              </div>
            </div>
          </motion.div>

        </div>

        {/* ── Top scroll fade ── */}
        {[
          { height: 40, blur: 2 },
          { height: 28, blur: 3 },
          { height: 18, blur: 5 },
          { height: 10, blur: 6 },
        ].map(({ height, blur }) => (
          <div key={blur} aria-hidden style={{
            position:            'absolute',
            top:                 '148px',
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
          top:           '148px',
          left:          0, right: 0,
          height:        '40px',
          background:    'linear-gradient(to bottom, var(--neutral-50) 0%, transparent 100%)',
          pointerEvents: 'none',
          zIndex:        6,
          opacity:       atScrollTop ? 0 : 1,
          transition:    'opacity 150ms ease',
        }} />

        {/* ── Bottom scroll fade ── */}
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

        {/* ── Absolute bottom: account item with dropdown ── */}
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
          <AccountDropdown
            userName={userName}
            userEmail={userEmail}
            avatarSrc={avatarSrc}
            avatarInitials={avatarInitials}
            isCollapsed={isCollapsed}
          />
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
