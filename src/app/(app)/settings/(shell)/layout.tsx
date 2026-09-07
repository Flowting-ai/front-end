import type { ReactNode } from 'react'
import { SettingsSidebar } from '@/components/layout/SettingsSidebar'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      <SettingsSidebar />

      {/* Content area - neutral-50 bg, padding matches main app layout */}
      <div
        style={{
          flex:            '1 0 0',
          minWidth:        0,
          height:          '100%',
          backgroundColor: 'var(--neutral-50)',
          display:         'flex',
          padding:         '10px 10px 10px 0',
        }}
      >
        {/* Inner rounded card - mirrors the main app's center container */}
        <div
          style={{
            flex:            '1 0 0',
            minHeight:       0,
            display:         'flex',
            flexDirection:   'column',
            borderRadius:    22,
            border:          '1px solid var(--neutral-200)',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            overflow:        'hidden',
          }}
        >
          {/* Scoped to just the active page — keeps SettingsSidebar outside
              the pathname-keyed remount boundary so it stays mounted (no
              entrance-animation replay) while switching between settings
              pages, instead of being torn down along with the app-wide
              ErrorBoundary this used to sit inside (AppLayout.tsx). */}
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </div>
    </div>
  )
}
