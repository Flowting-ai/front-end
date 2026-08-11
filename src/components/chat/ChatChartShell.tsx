"use client"

import type { CSSProperties, ReactNode } from "react"
import { m, type HTMLMotionProps } from "framer-motion"

const BASE_STYLE: CSSProperties = {
  minWidth: 0,
  margin: "16px 0",
  padding: "16px 18px 14px",
  border: "1px solid var(--neutral-100)",
  borderRadius: 12,
  background: "var(--neutral-white)",
}

interface ChatChartShellProps extends Omit<HTMLMotionProps<"div">, "children"> {
  title?: string
  children: ReactNode
}

/** Shared surface and title treatment for charts rendered inside chat. */
export function ChatChartShell({ title, children, style, ...props }: ChatChartShellProps) {
  return (
    <m.div style={{ ...BASE_STYLE, ...style }} {...props}>
      {title && (
        <div
          style={{
            marginBottom: 14,
            color: "var(--neutral-900)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {title}
        </div>
      )}
      {children}
    </m.div>
  )
}
