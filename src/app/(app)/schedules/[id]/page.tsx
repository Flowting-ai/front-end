import { SchedulesScreen } from '../SchedulesScreen'

export default async function ScheduleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SchedulesScreen scheduleId={id} />
}
