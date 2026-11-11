// Email checks for typed-in invite addresses: a stricter format test, and a "did you mean" for
// common domain typos (gmial.com → gmail.com, .con → .com). Neither proves an address exists —
// only sending the invite does.

// local@domain.tld: no spaces or extra @, no dot at either end or doubled, a 2+ letter ending.
const EMAIL_RE = /^[^\s@.]+(?:\.[^\s@.]+)*@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email)
}

const COMMON_DOMAINS = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'zoho.com', 'gmx.com', 'yandex.com',
]

const TLD_TYPOS: Record<string, string> = {
  con: 'com', cmo: 'com', ocm: 'com', vom: 'com', xom: 'com', comm: 'com', cm: 'com', om: 'com',
  nte: 'net', ent: 'net', nett: 'net', ogr: 'org', orgg: 'org',
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = temp
    }
  }
  return row[b.length]
}

/** The address with its domain corrected, when the domain looks like a typo of a common one; else null. */
export function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at < 1) return null
  const local = email.slice(0, at)
  const domain = email.slice(at + 1).toLowerCase()
  if (COMMON_DOMAINS.includes(domain)) return null

  // A near miss of a well-known provider: two letters off for long names, one for short ones
  // (so acme.com isn't read as me.com).
  let best: string | null = null
  let bestDistance = Infinity
  for (const known of COMMON_DOMAINS) {
    const d = distance(domain, known)
    if (d > 0 && d <= (known.length >= 9 ? 2 : 1) && d < bestDistance) { best = known; bestDistance = d }
  }
  if (best) return `${local}@${best}`

  // Otherwise a mistyped ending on any domain: acme.con → acme.com.
  const dot = domain.lastIndexOf('.')
  if (dot > 0) {
    const fixed = TLD_TYPOS[domain.slice(dot + 1)]
    if (fixed && fixed !== domain.slice(dot + 1)) return `${local}@${domain.slice(0, dot)}.${fixed}`
  }
  return null
}
