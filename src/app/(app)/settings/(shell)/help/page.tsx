'use client'

import React, { useEffect } from 'react'
import { ArrowUpRightOneIcon, BookmarkTwoIcon, CustomerServiceOneIcon, FileTwoIcon } from '@strange-huge/icons'
import { Badge } from '@/components/Badge'
import { useGuardedRouter } from '@/context/nav-guard-context'
import { SETTINGS_FEATURE_REQUEST_ROUTE, SETTINGS_REPORT_BUG_ROUTE } from '@/lib/routes'
import { trackFeature } from '@/lib/analytics/events'
import styles from './help.module.css'

// Settings → Help & Legal. Two jobs: get help (tiles that do something — open Slack, report a bug,
// request a feature) and read the legal documents (a plain list of links). Help Center and Contact
// Support are shown as "Coming soon" so people know they are planned, not missing.

const SLACK_INVITE = 'https://join.slack.com/t/souvenircommunity/shared_invite/zt-41rhgppbm-G7Z_dv1VJXdSL087irwKJg'

const LEGAL = [
  { title: 'Terms of Service', hint: 'Your agreement with Souvenir AI for using the platform', href: 'https://www.getsouvenir.com/legal/terms' },
  { title: 'Privacy Policy', hint: 'How we collect, use and protect your personal data', href: 'https://www.getsouvenir.com/legal/privacy' },
  { title: 'Cookie Policy', hint: 'How we use cookies and similar technologies', href: 'https://www.getsouvenir.com/legal/cookies' },
] as const

function AssetIcon({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- static local icon
  return <img src={src} width={20} height={20} alt="" aria-hidden style={{ display: 'block' }} />
}

function Tile({ icon, title, hint, onClick, external, comingSoon }: {
  icon: React.ReactNode
  title: string
  hint: string
  onClick?: () => void
  external?: boolean
  comingSoon?: boolean
}) {
  return (
    <button type="button" className={styles.tile} onClick={onClick} disabled={comingSoon}>
      <span className={styles.tileIcon} aria-hidden="true">{icon}</span>
      <span className={styles.tileText}>
        <span className={styles.tileTitle}>
          {title}
          {comingSoon && <Badge label="Coming soon" color="Neutral" />}
        </span>
        <span className={styles.tileHint}>{hint}</span>
      </span>
      {!comingSoon && external && <ArrowUpRightOneIcon size={16} className={styles.tileArrow} aria-label="Opens in a new tab" />}
    </button>
  )
}

export default function HelpPage() {
  const { push } = useGuardedRouter()

  useEffect(() => { trackFeature('settings_help_opened') }, [])

  return (
    <>
      <div
        className="kaya-scrollbar"
        style={{ flex: '1 0 0', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '64px 24px 48px' }}
      >
        <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ paddingLeft: 4, marginBottom: 4 }}>
            <h1 style={{ fontFamily: 'var(--font-title)', fontWeight: 400, fontSize: 24, lineHeight: '32px', color: 'var(--neutral-900)', margin: 0 }}>
              Help &amp; Legal
            </h1>
            <p style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 14, lineHeight: '22px', color: 'var(--neutral-600)', margin: 0 }}>
              Get support, tell us what to build next, and read the documents that govern your use of Souvenir.
            </p>
          </div>

          <section className={styles.card} aria-labelledby="help-title">
            <div className={styles.cardHead}>
              <h2 id="help-title" className={styles.cardTitle}>Get help</h2>
              <p className={styles.cardHint}>Ask the community, report a problem, or request a feature.</p>
            </div>
            <div className={styles.tiles} style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', paddingBottom: 12 }}>
              <Tile
                icon={<AssetIcon src="/icons/slack.svg" />}
                title="Community Slack"
                hint="Meet other Souvenir users, share workflows and get tips"
                external
                onClick={() => window.open(SLACK_INVITE, '_blank', 'noopener,noreferrer')}
              />
              <Tile
                icon={<AssetIcon src="/icons/settings-sidebar/report-bug.svg" />}
                title="Report a bug"
                hint="Something not working? Tell us what happened"
                onClick={() => push(SETTINGS_REPORT_BUG_ROUTE)}
              />
              <Tile
                icon={<AssetIcon src="/icons/settings-sidebar/feature-request.svg" />}
                title="Request a feature"
                hint="Suggest something Souvenir should do next"
                onClick={() => push(SETTINGS_FEATURE_REQUEST_ROUTE)}
              />
            </div>
            <div className={styles.tiles} style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', paddingTop: 0 }}>
              <Tile
                icon={<BookmarkTwoIcon size={20} />}
                title="Help Center"
                hint="Guides, tutorials and answers to common questions"
                comingSoon
              />
              <Tile
                icon={<CustomerServiceOneIcon size={20} />}
                title="Contact Support"
                hint="Talk to the Souvenir team directly"
                comingSoon
              />
            </div>
          </section>

          <section className={styles.card} aria-labelledby="legal-title">
            <div className={styles.cardHead}>
              <h2 id="legal-title" className={styles.cardTitle}>Legal</h2>
              <p className={styles.cardHint}>The agreements and policies that cover your use of Souvenir.</p>
            </div>
            <ul className={styles.list}>
              {LEGAL.map((doc) => (
                <li key={doc.href}>
                  <a className={styles.row} href={doc.href} target="_blank" rel="noopener noreferrer">
                    <FileTwoIcon size={18} className={styles.rowIcon} />
                    <span className={styles.rowText}>
                      <span className={styles.rowTitle}>{doc.title}</span>
                      <span className={styles.rowHint}>{doc.hint}</span>
                    </span>
                    <ArrowUpRightOneIcon size={16} className={styles.rowIcon} aria-label="Opens in a new tab" />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <div className={styles.footer}>
            <span>Souvenir v1.5</span>
            <span>© 2026 Souvenir AI</span>
          </div>
        </div>
      </div>
    </>
  )
}
