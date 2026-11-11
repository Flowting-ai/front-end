import { Skeleton } from '@/components/Skeleton'

/** Header placeholder while the template metadata loads. */
export default function TemplateLoading() {
  return (
    <div role="status" aria-label="Loading template" className="flex h-full flex-col">
      <div className="flex gap-2.5 border-b border-[var(--neutral-100)] px-5 py-3.5">
        <Skeleton width="30%" height={26} />
        <Skeleton width={160} height={20} />
      </div>
    </div>
  )
}
