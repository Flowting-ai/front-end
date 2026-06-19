'use client'

import React from 'react'

export interface ViewIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number
  color?: string
  variant?: 'visible' | 'hidden'
  animated?: boolean
  triggered?: boolean
}

const EYE_OUTLINE = 'M21.544 11.045C21.848 11.4713 22 11.6845 22 12C22 12.3155 21.848 12.5287 21.544 12.955C20.1779 14.8706 16.6892 19 12 19C7.31078 19 3.8221 14.8706 2.45604 12.955C2.15201 12.5287 2 12.3155 2 12C2 11.6845 2.15201 11.4713 2.45604 11.045C3.8221 9.12944 7.31078 5 12 5C16.6892 5 20.1779 9.12944 21.544 11.045Z'
const EYE_PUPIL = 'M15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15C13.6569 15 15 13.6569 15 12Z'
const EYE_OFF_OUTLINE = 'M19.439 15.439C20.3636 14.5212 21.0775 13.6091 21.544 12.955C21.848 12.5287 22 12.3155 22 12C22 11.6845 21.848 11.4713 21.544 11.045C20.1779 9.12944 16.6892 5 12 5C11.0922 5 10.2294 5.15476 9.41827 5.41827M6.74742 6.74742C4.73118 8.1072 3.24215 9.94266 2.45604 11.045C2.15201 11.4713 2 11.6845 2 12C2 12.3155 2.15201 12.5287 2.45604 12.955C3.8221 14.8706 7.31078 19 12 19C13.9908 19 15.7651 18.2557 17.2526 17.2526'
const EYE_OFF_PUPIL = 'M9.85786 10C9.32783 10.53 9 11.2623 9 12.0711C9 13.6887 10.3113 15 11.9289 15C12.7377 15 13.47 14.6722 14 14.1421'
const SLASH = 'M3 3L21 21'

export function ViewIcon({
  size = 24,
  color = 'currentColor',
  variant = 'visible',
  style,
  onClick,
  animated: _animated,
  triggered: _triggered,
  ...props
}: ViewIconProps) {
  const hidden = variant === 'hidden'
  const pathProps = {
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      onClick={onClick}
      style={{ display: 'block', flexShrink: 0, cursor: onClick ? 'pointer' : undefined, ...style }}
      {...props}
    >
      {hidden ? (
        <>
          <path d={EYE_OFF_OUTLINE} {...pathProps} />
          <path d={EYE_OFF_PUPIL} {...pathProps} />
          <path d={SLASH} {...pathProps} />
        </>
      ) : (
        <>
          <path d={EYE_OUTLINE} {...pathProps} strokeLinecap={undefined} />
          <path d={EYE_PUPIL} {...pathProps} strokeLinecap={undefined} />
        </>
      )}
    </svg>
  )
}
