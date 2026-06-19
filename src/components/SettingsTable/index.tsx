'use client'

import React from 'react'

interface SettingsTableProps {
  children: React.ReactNode
  columns?: string
  columnGap?: string | number
}

interface SettingsTableGridProps {
  children: React.ReactNode
  columns?: string
  columnGap?: string | number
  divider?: boolean
  minHeight?: number
  style?: React.CSSProperties
}

const SettingsTableLayoutContext = React.createContext<{
  columns?: string
  columnGap?: string | number
}>({})

export function SettingsTable({ children, columns, columnGap }: SettingsTableProps) {
  return (
    <SettingsTableLayoutContext.Provider value={{ columns, columnGap }}>
      <section
        style={{
          border:        '1px solid var(--neutral-200)',
          borderRadius:  16,
          boxShadow:     '0px 2px 2.8px 0px rgba(82,75,71,0.12)',
          background:    'var(--neutral-50)',
          overflow:      'hidden',
          display:       'flex',
          flexDirection: 'column',
          gap:           12,
          padding:       '12px 0',
        }}
      >
        {children}
      </section>
    </SettingsTableLayoutContext.Provider>
  )
}

export function SettingsTableToolbar({
  title,
  children,
  style,
}: {
  title: string
  children?: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        padding:      '12px 24px 24px',
        borderBottom: '1px solid var(--neutral-100)',
        ...style,
      }}
    >
      <h2
        style={{
          flex:       '1 0 0',
          minWidth:   0,
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          fontSize:   16,
          lineHeight: '22px',
          color:      'var(--neutral-900)',
          margin:     0,
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  )
}

export function SettingsTableHeader({
  children,
  columns,
  columnGap,
  style,
}: SettingsTableGridProps) {
  const layout = React.useContext(SettingsTableLayoutContext)
  return (
    <div
      role="row"
      style={{
        display:              'grid',
        gridTemplateColumns:  columns ?? layout.columns,
        columnGap:            columnGap ?? layout.columnGap ?? 64,
        alignItems:           'center',
        padding:              '12px 24px',
        borderBottom:         '1px solid var(--neutral-100)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function SettingsTableHeaderCell({
  children,
  align = 'start',
}: {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <p
      role="columnheader"
      style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
        fontSize:   14,
        lineHeight: '22px',
        color:      'var(--neutral-900)',
        margin:     0,
        textAlign:  align,
        width:      '100%',
      }}
    >
      {children}
    </p>
  )
}

export function SettingsTableRow({
  children,
  columns,
  columnGap,
  divider = true,
  minHeight = 58,
  style,
}: SettingsTableGridProps) {
  const layout = React.useContext(SettingsTableLayoutContext)
  return (
    <div
      role="row"
      style={{
        display:             'grid',
        gridTemplateColumns: columns ?? layout.columns,
        columnGap:           columnGap ?? layout.columnGap ?? 64,
        alignItems:          'center',
        minHeight,
        padding:             '0 24px',
        borderBottom:        divider ? '1px solid var(--neutral-100)' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function SettingsTableCell({
  children,
  align = 'start',
}: {
  children: React.ReactNode
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <div
      role="cell"
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center',
        minWidth:       0,
      }}
    >
      {children}
    </div>
  )
}

export function SettingsTableFooter({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        padding: '12px 24px',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
