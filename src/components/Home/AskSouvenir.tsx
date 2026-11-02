import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SouvenirLogo } from '@/components/SouvenirLogo'
import { buildChatPromptUrl } from '@/lib/home/chat-link'
import styles from './Home.module.css'

export interface AskSouvenirProps {
  suggestions: string[]
}

/** Suggested questions; each opens a new chat with the question waiting in the composer. */
export function AskSouvenir({ suggestions }: AskSouvenirProps) {
  if (suggestions.length === 0) return null
  return (
    <section className={styles.ask} aria-labelledby="home-ask">
      <h2 id="home-ask" className={styles.askTitle}>
        <SouvenirLogo size={20} variant="gray" />
        Ask Souvenir
      </h2>
      <ul className={styles.suggestions}>
        {suggestions.map(q => (
          <li key={q}>
            <Link href={buildChatPromptUrl(q)} className={styles.suggestion}>
              {q}
              <ArrowRight size={16} strokeWidth={1.75} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
