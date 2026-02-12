import { useMemo } from 'react'
import { useProjects } from '../hooks/useProjects'
import { checkInMinutes, formatCheckInTime } from '../utils/checkInTime'
import { projectColorValue } from '../utils/projects'

function startOfWeek(date: Date): Date {
  const value = new Date(date)
  const day = value.getDay()
  const diff = day === 0 ? -6 : 1 - day
  value.setDate(value.getDate() + diff)
  value.setHours(0, 0, 0, 0)
  return value
}

function calcDayStreak(activeDays: string[]): number {
  if (activeDays.length === 0) return 0
  const uniqueDays = Array.from(new Set(activeDays)).sort().reverse()
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  for (const day of uniqueDays) {
    const current = cursor.toISOString().slice(0, 10)
    if (day === current) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
      continue
    }
    if (streak === 0) {
      cursor.setDate(cursor.getDate() - 1)
      if (day === cursor.toISOString().slice(0, 10)) {
        streak += 1
        cursor.setDate(cursor.getDate() - 1)
        continue
      }
    }
    break
  }

  return streak
}

export default function InlineStatsView() {
  const { projects, quickTasks, focusCheckIns } = useProjects()

  const activeProjects = useMemo(
    () => projects.filter((project) => !project.archivedAt && !project.suspendedAt).sort((a, b) => a.order - b.order),
    [projects]
  )

  const stats = useMemo(() => {
    const weekStart = startOfWeek(new Date())
    const tasksDone =
      quickTasks.filter((task) => task.completed).length +
      activeProjects.reduce((count, project) => count + project.tasks.filter((task) => task.completed).length, 0)

    const focusedMinutes = focusCheckIns.reduce((sum, checkIn) => sum + checkInMinutes(checkIn), 0)
    const streak = calcDayStreak(focusCheckIns.map((checkIn) => checkIn.timestamp.slice(0, 10)))

    const weeklyByProject = activeProjects.map((project) => {
      const doneThisWeek = project.tasks.filter((task) => {
        if (!task.completedAt) return false
        return new Date(task.completedAt).getTime() >= weekStart.getTime()
      }).length

      return {
        id: project.id,
        name: project.name,
        color: project.color,
        doneThisWeek
      }
    })

    return {
      tasksDone,
      focusedMinutes,
      streak,
      weeklyByProject
    }
  }, [activeProjects, focusCheckIns, quickTasks])

  return (
    <div>
      <div className="section-label" style={{ marginBottom: 16 }}>
        <span style={{ opacity: 0.5 }}>📊</span>
        <span>Statistics</span>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="number">{stats.tasksDone}</div>
          <div className="label">Tasks Done</div>
        </div>
        <div className="stat-card">
          <div className="number">{formatCheckInTime(stats.focusedMinutes)}</div>
          <div className="label">Focused Time</div>
        </div>
        <div className="stat-card">
          <div className="number">{stats.streak}</div>
          <div className="label">Day Streak</div>
        </div>
      </div>

      <div className="section-label">This Week</div>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 24 }}>
        {stats.weeklyByProject.slice(0, 5).map((project) => (
          <div key={project.id} className="stat-card">
            <div className="number" style={{ fontSize: 20, color: projectColorValue(project.color) }}>{project.doneThisWeek}</div>
            <div className="label">{project.name || 'Untitled'}</div>
          </div>
        ))}
      </div>

      <div className="section-label">Activity</div>
      <div className="heatmap-placeholder">Heatmap / activity chart placeholder</div>
    </div>
  )
}
