/**
 * CSS `linear()` easing that makes a conic-gradient sweep travel round a
 * `width` × `height` box's border at a constant speed.
 *
 * A conic gradient rotates at a constant *angle* per second, so on a wide box its
 * leading edge crawls on the short sides and races along the long ones. Mapping
 * time to the angle of the point reached after covering that fraction of the
 * perimeter cancels that out. The path starts at top-centre and runs clockwise,
 * matching `conic-gradient(from 0deg …)`. Corner rounding is ignored: it only
 * shaves a few percent off the lap.
 */
export function orbitEasing(width: number, height: number, steps = 72): string {
  const halfW = width / 2
  const halfH = height / 2
  const perimeter = 2 * (width + height)
  const points: string[] = []

  for (let i = 0; i <= steps; i++) {
    if (i === steps) {
      points.push("1")
      continue
    }
    const s = (i / steps) * perimeter
    let x: number
    let y: number
    if (s < halfW) {
      x = s; y = -halfH
    } else if (s < halfW + height) {
      x = halfW; y = -halfH + (s - halfW)
    } else if (s < halfW + height + width) {
      x = halfW - (s - halfW - height); y = halfH
    } else if (s < halfW + 2 * height + width) {
      x = -halfW; y = halfH - (s - halfW - height - width)
    } else {
      x = -halfW + (s - halfW - 2 * height - width); y = -halfH
    }
    let angle = Math.atan2(x, -y)
    if (angle < 0) angle += 2 * Math.PI
    points.push((angle / (2 * Math.PI)).toFixed(4))
  }

  return `linear(${points.join(", ")})`
}
