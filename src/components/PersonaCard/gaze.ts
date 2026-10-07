// Where an agent's eyes look. The hero scene reports its lead element (the cloud drifting
// past, the plane on its loop) every frame; the card reports the viewer's pointer while it's
// over the card. The avatar reads both from its own animation loop, so none of this goes
// through React state — one channel per card, created once and passed down.

export interface Point { x: number; y: number }

export class GazeChannel {
  /** The scene's lead element, in the avatar's 64-unit viewBox. */
  ambient: Point | null = null
  /** The viewer's pointer in client px, while it's over the card. Wins over `ambient`. */
  pointer: Point | null = null
  /** What the viewer is engaging with, in client px: the card's primary button (hovered or
   *  keyboard-focused) — the eyes look at it with a happy squint. */
  attention: Point | null = null

  setAmbient(point: Point | null) { this.ambient = point }
  setPointer(point: Point | null) { this.pointer = point }
  setAttention(point: Point | null) { this.attention = point }
}

/** How the agent is: awake; asleep (paused); drowsy (a draft); unavailable (its model is gone). */
export type AvatarMood = 'awake' | 'asleep' | 'drowsy' | 'unavailable'
