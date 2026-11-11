import { RouteState } from '@/components/RouteState'

/** Full-height message for a template that can't be shown. */
export function TemplateNotice({
  heading,
  body,
  tone = 'status',
}: {
  heading: string
  body: string
  /** `alert` for failures the viewer didn't expect, `status` for normal outcomes. */
  tone?: 'status' | 'alert'
}) {
  return <RouteState heading={heading} body={body} tone={tone} fill />
}
