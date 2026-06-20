// Pool of persona avatar images used as default avatars for template-created personas.
// Images live in public/persona-avatars/ and are served as static assets.
// Sourced from the Figma persona card designs.

const TEMPLATE_AVATARS = [
  '/persona-avatars/0656f3b794e38cb70243c01880ae7e8c.jpg',
  '/persona-avatars/0d76e6ce216e9a37aabb374a0b5ff373.jpg',
  '/persona-avatars/1a28810d426619782dd1d5a595389cc1.jpg',
  '/persona-avatars/2d566c8909b00dd3a384be6fff13dde6.jpg',
  '/persona-avatars/3df055256e83c4e96b7d12375b0350c7.jpg',
  '/persona-avatars/545edd8b11f485a6af182827235fe77b.jpg',
  '/persona-avatars/610d02a62c92aabef208323fb3eb963b.jpg',
  '/persona-avatars/61a217559aa4835edef3077e097d8bff.jpg',
  '/persona-avatars/654341558b7022e87d7c11ad97c043f2.jpg',
  '/persona-avatars/67426067d03211790d002ab8dfd355b1.jpg',
  '/persona-avatars/7f4fa28c942a9c408d96c4b5f3adcfbe.jpg',
  '/persona-avatars/81fd248d2aea38920976f7d6420f90ca.jpg',
  '/persona-avatars/88dfe7bf97d198e8e9abb38db9d3f6a9.jpg',
  '/persona-avatars/b651f98459d8d64940c19220dc05e83c.jpg',
  '/persona-avatars/b75eeab04cced8e1a3d2edb69f2e134d.jpg',
  '/persona-avatars/c70a7e37d62d3983cc8561af76e98f40.jpg',
  '/persona-avatars/eed3b5053d44561ee17a1411b3c399dd.jpg',
  '/persona-avatars/eeef0281aa011612dac0bfc085d7798c.jpg',
] as const

/** Deterministically assigns the same fallback avatar to the same persona seed. */
export function getPersonaFallbackAvatar(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return TEMPLATE_AVATARS[hash % TEMPLATE_AVATARS.length]
}

/** Returns a random avatar path from the pool. Call once per persona creation. */
export function pickTemplateAvatar(): string {
  return TEMPLATE_AVATARS[Math.floor(Math.random() * TEMPLATE_AVATARS.length)]
}
