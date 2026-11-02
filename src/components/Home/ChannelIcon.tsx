import type { Channel } from '@/lib/home/mock-data'

export const CHANNEL_LABELS: Record<Channel, string> = {
  shopify: 'Shopify',
  tiktok: 'TikTok',
  instagram: 'Instagram',
}

export interface ChannelIconProps {
  channel: Channel
  size?: number
  /** Accessible name; omit to hide the mark from assistive tech (the caller names the channels in text). */
  title?: string
  className?: string
}

/** Simplified inline brand marks for sales channels — no remote images (CSP). */
export function ChannelIcon({ channel, size = 20, title, className }: ChannelIconProps) {
  const a11y = title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} {...a11y}>
      {channel === 'shopify' && (
        <>
          <path d="M15.6 3.4c-.1 0-1.5-.1-1.5-.1s-1-1-1.1-1.1c-.4-.4-1.3-.3-1.6-.2l-.6.2C10.4 1.1 9.8.6 8.9.6 6.8.6 5.7 3.2 5.4 4.6l-1.6.5c-.5.2-.5.2-.6.6L2 19.8l11.6 2.2L20 20.6 16 3.7c0-.2-.2-.3-.4-.3Z" fill="#95BF47" />
          <path d="M15.6 3.4c-.1 0-1.5-.1-1.5-.1s-1-1-1.1-1.1l-.4-.2L13.6 22 20 20.6 16 3.7c0-.2-.2-.3-.4-.3Z" fill="#5E8E3E" />
          <path d="M10.8 8.1 10 10.4s-.7-.4-1.6-.4c-1.3 0-1.3.8-1.3 1 0 1.1 2.9 1.5 2.9 4.1 0 2-1.3 3.3-3 3.3-2.1 0-3.1-1.3-3.1-1.3l.6-1.9s1.1.9 2 .9c.6 0 .9-.5.9-.8 0-1.4-2.4-1.5-2.4-3.9 0-2 1.4-3.9 4.3-3.9 1.1 0 1.5.3 1.5.3Z" fill="#fff" />
        </>
      )}
      {channel === 'tiktok' && (
        <>
          <path d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.1-2.8V9a6.3 6.3 0 1 0 5.4 6.2V8.6a7.8 7.8 0 0 0 4.4 1.4V6.7a4.6 4.6 0 0 1-4.4-4.7Z" fill="#25F4EE" transform="translate(-.8 -.6)" />
          <path d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.1-2.8V9a6.3 6.3 0 1 0 5.4 6.2V8.6a7.8 7.8 0 0 0 4.4 1.4V6.7a4.6 4.6 0 0 1-4.4-4.7Z" fill="#FE2C55" transform="translate(.8 .6)" />
          <path d="M16.6 2h-3.3v13.2a2.9 2.9 0 1 1-2.1-2.8V9a6.3 6.3 0 1 0 5.4 6.2V8.6a7.8 7.8 0 0 0 4.4 1.4V6.7a4.6 4.6 0 0 1-4.4-4.7Z" fill="currentColor" />
        </>
      )}
      {channel === 'instagram' && (
        <>
          <defs>
            <linearGradient id="channel-ig" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#FEDA75" />
              <stop offset=".35" stopColor="#FA7E1E" />
              <stop offset=".6" stopColor="#D62976" />
              <stop offset="1" stopColor="#4F5BD5" />
            </linearGradient>
          </defs>
          <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="url(#channel-ig)" strokeWidth="2.2" />
          <circle cx="12" cy="12" r="4.3" fill="none" stroke="url(#channel-ig)" strokeWidth="2.2" />
          <circle cx="17.3" cy="6.7" r="1.3" fill="#D62976" />
        </>
      )}
    </svg>
  )
}
