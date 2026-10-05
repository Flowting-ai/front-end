import { redirect } from 'next/navigation'
import { ORG_CHANGE_PLAN_ROUTE } from '@/lib/routes'

export default function ChangePlanPage() {
  redirect(ORG_CHANGE_PLAN_ROUTE)
}
