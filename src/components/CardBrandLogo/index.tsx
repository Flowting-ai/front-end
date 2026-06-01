'use client'

import React from 'react'

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'jcb' | 'unionpay' | 'unknown'

interface CardBrandLogoProps {
  brand: CardBrand
  width?: number
  height?: number
}

/** Renders a card-shaped chip with the brand logo inside. */
export function CardBrandLogo({ brand, width = 63, height = 44 }: CardBrandLogoProps) {
  const config = BRAND_CONFIGS[brand] ?? BRAND_CONFIGS.unknown
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        backgroundColor: config.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0px 1px 3px 0px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}
    >
      {config.svg}
    </div>
  )
}

// ── Brand configs ─────────────────────────────────────────────────────────────

const BRAND_CONFIGS: Record<CardBrand, { bg: string; svg: React.ReactNode }> = {
  visa: {
    bg: '#1a1f71',
    svg: <VisaSvg />,
  },
  mastercard: {
    bg: '#252525',
    svg: <MastercardSvg />,
  },
  amex: {
    bg: '#006FCF',
    svg: <AmexSvg />,
  },
  discover: {
    bg: '#ffffff',
    svg: <DiscoverSvg />,
  },
  diners: {
    bg: '#ffffff',
    svg: <DinersSvg />,
  },
  jcb: {
    bg: '#ffffff',
    svg: <JcbSvg />,
  },
  unionpay: {
    bg: '#E21836',
    svg: <UnionPaySvg />,
  },
  unknown: {
    bg: '#e5e5e5',
    svg: <UnknownCardSvg />,
  },
}

// ── Visa ──────────────────────────────────────────────────────────────────────

function VisaSvg() {
  return (
    <svg width="50" height="16" viewBox="0 0 256 83" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M132.21 2.09L115.09 80.63H95.08L112.2 2.09H132.21ZM212.37 52.47L222.93 23.1L229.04 52.47H212.37ZM234.68 80.63H253.3L237.1 2.09H220.18C216.5 2.09 213.39 4.16 211.95 7.38L182.72 80.63H203.4L207.5 68.89H232.89L234.68 80.63ZM183.43 54.23C183.53 33.46 155.05 32.32 155.25 23.1C155.31 20.27 158.04 17.26 164 16.47C166.96 16.08 174.83 15.77 183.79 19.9L187.2 4.31C182.4 2.57 176.23 0.89 168.55 0.89C149.07 0.89 135.16 11.66 135.04 27.19C134.91 38.74 145.3 45.2 153.11 49.05C161.17 52.99 163.88 55.52 163.84 59.07C163.79 64.49 157.38 66.86 151.38 66.95C141.36 67.1 135.55 64.22 130.95 62.03L127.43 78.14C132.06 80.31 140.49 82.2 149.23 82.3C169.87 82.3 183.36 71.65 183.43 54.23ZM97.09 2.09L66.77 80.63H45.93L31.1 16.43C30.2 12.86 29.41 11.51 26.63 9.98C22.1 7.53 14.89 5.24 8.52 3.8L9.03 2.09H42.36C46.59 2.09 50.39 4.89 51.33 9.73L59.58 53.19L80.07 2.09H97.09Z"
        fill="white"
      />
    </svg>
  )
}

// ── Mastercard ────────────────────────────────────────────────────────────────

function MastercardSvg() {
  return (
    <svg width="42" height="26" viewBox="0 0 42 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="15" cy="13" r="12" fill="#EB001B" />
      <circle cx="27" cy="13" r="12" fill="#F79E1B" />
      <path
        d="M21 3.47A11.96 11.96 0 0 1 27 1C33.63 1 39 6.37 39 13C39 19.63 33.63 25 27 25A11.96 11.96 0 0 1 21 22.53A11.96 11.96 0 0 1 15 25C8.37 25 3 19.63 3 13C3 6.37 8.37 1 15 1A11.96 11.96 0 0 1 21 3.47Z"
        fill="#FF5F00"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  )
}

// ── Amex ──────────────────────────────────────────────────────────────────────

function AmexSvg() {
  return (
    <svg width="46" height="14" viewBox="0 0 46 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text
        x="0"
        y="11"
        fill="white"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="11"
        fontWeight="bold"
        letterSpacing="0.5"
      >
        AMEX
      </text>
    </svg>
  )
}

// ── Discover ──────────────────────────────────────────────────────────────────

function DiscoverSvg() {
  return (
    <svg width="50" height="12" viewBox="0 0 50 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text
        x="0"
        y="10"
        fill="#FF6600"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="10"
        fontWeight="bold"
      >
        DISCOVER
      </text>
    </svg>
  )
}

// ── Diners Club ───────────────────────────────────────────────────────────────

function DinersSvg() {
  return (
    <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="12" fill="none" stroke="#004A97" strokeWidth="2" />
      <circle cx="22" cy="14" r="12" fill="none" stroke="#004A97" strokeWidth="2" />
      <path d="M8 7V21M14 4V24" stroke="#004A97" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ── JCB ───────────────────────────────────────────────────────────────────────

function JcbSvg() {
  return (
    <svg width="36" height="26" viewBox="0 0 36 26" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="10" height="24" rx="4" fill="#0E4C96" />
      <rect x="13" y="1" width="10" height="24" rx="4" fill="#E21836" />
      <rect x="25" y="1" width="10" height="24" rx="4" fill="#007B40" />
      <text x="3" y="16" fill="white" fontFamily="Arial" fontSize="7" fontWeight="bold">J</text>
      <text x="15" y="16" fill="white" fontFamily="Arial" fontSize="7" fontWeight="bold">C</text>
      <text x="27" y="16" fill="white" fontFamily="Arial" fontSize="7" fontWeight="bold">B</text>
    </svg>
  )
}

// ── UnionPay ──────────────────────────────────────────────────────────────────

function UnionPaySvg() {
  return (
    <svg width="46" height="14" viewBox="0 0 46 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text
        x="0"
        y="11"
        fill="white"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="9"
        fontWeight="bold"
        letterSpacing="0.3"
      >
        UnionPay
      </text>
    </svg>
  )
}

// ── Unknown / Generic card ────────────────────────────────────────────────────

function UnknownCardSvg() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="24" height="16" rx="2" stroke="#999" strokeWidth="1.5" fill="none" />
      <rect x="2" y="5" width="24" height="3" fill="#999" />
      <rect x="5" y="12" width="8" height="2" rx="1" fill="#bbb" />
    </svg>
  )
}
