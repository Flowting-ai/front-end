import type { BestSeller } from '@/lib/home/mock-data'
import { formatCurrencyCompact } from '@/lib/home/format'
import { CHANNEL_LABELS, ChannelIcon } from './ChannelIcon'
import styles from './Home.module.css'

export interface BestSellerCardProps {
  product: BestSeller
}

/**
 * The period's top product. With a photo the text sits on it over a dark gradient; without one
 * (for now) the card is a plain panel in the page's own colours.
 */
export function BestSellerCard({ product }: BestSellerCardProps) {
  const photo = !!product.imageSrc
  return (
    <section className={styles.bestSeller} data-photo={photo || undefined} aria-labelledby="home-best-seller">
      {photo && (
        <>
          {/* A plain img: the source may be any product photo URL, and the card is one fixed-size slot. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.bestSellerImage} src={product.imageSrc} alt={product.imageAlt ?? ''} />
        </>
      )}
      <div className={styles.bestSellerInner}>
        <div className={styles.bestSellerTop}>
          <h2 id="home-best-seller" className={styles.bestSellerEyebrow}>Best seller</h2>
          <ChannelIcon channel={product.channel} size={18} title={`Sold on ${CHANNEL_LABELS[product.channel]}`} />
        </div>
        <div>
          <p className={styles.bestSellerName}>{product.name}</p>
          <p className={styles.bestSellerSubtitle}>{product.subtitle}</p>
          <p className={styles.bestSellerRevenue}>
            <strong>{formatCurrencyCompact(product.revenue)}</strong> revenue
          </p>
        </div>
      </div>
    </section>
  )
}
