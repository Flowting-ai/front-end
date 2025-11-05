
import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="28"
      viewBox="0 0 24 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M12.001 1.5L22.25 7.625V19.875L12.001 26L1.75 19.875V7.625L12.001 1.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M12 5.5L16.5 8V12L12 14.5L7.5 12V8L12 5.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M1.75 7.625L12 14.5L22.25 7.625" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
      <path d="M7.5 16.5L12 19L16.5 16.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 19.5L12 22L16.5 19.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 13.5L12 16L16.5 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
