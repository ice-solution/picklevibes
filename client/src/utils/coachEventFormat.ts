export type CoachEventType = 'activity' | 'coach_class' | 'schedule_request';

export function formatCoachEventDateLabel(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  };
  const startLabel = start.toLocaleDateString('zh-HK', opts);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) return startLabel;
  return `${startLabel} — ${end.toLocaleDateString('zh-HK', opts)}`;
}

export function formatCoachEventTimeRange24(startIso: string, endIso: string): string {
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  const start = new Date(startIso).toLocaleTimeString('zh-HK', timeOpts);
  const end = new Date(endIso).toLocaleTimeString('zh-HK', timeOpts);
  return `${start} - ${end}`;
}

export function coachEventStatusLabel(status: string, type: CoachEventType): string {
  if (type === 'coach_class') return '已排程';
  if (type === 'schedule_request') return '已批核';
  switch (status) {
    case 'upcoming':
      return '即將開始';
    case 'ongoing':
      return '進行中';
    case 'completed':
      return '已完結';
    case 'cancelled':
      return '已取消';
    case 'scheduled':
      return '已排程';
    case 'approved':
      return '已批核';
    default:
      return status;
  }
}

/** Tailwind classes for status badge */
export function coachEventStatusBadgeClass(status: string, type: CoachEventType): string {
  if (type === 'coach_class') {
    return 'bg-violet-100 text-violet-800 ring-violet-200';
  }
  if (type === 'schedule_request') {
    return 'bg-amber-100 text-amber-900 ring-amber-200';
  }
  switch (status) {
    case 'upcoming':
      return 'bg-blue-100 text-blue-800 ring-blue-200';
    case 'ongoing':
      return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
    case 'completed':
      return 'bg-gray-100 text-gray-600 ring-gray-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 ring-red-200';
    default:
      return 'bg-gray-100 text-gray-700 ring-gray-200';
  }
}

export function coachClassAdminStatusBadgeClass(status: 'scheduled' | 'cancelled'): string {
  if (status === 'scheduled') {
    return 'bg-emerald-100 text-emerald-800 ring-emerald-200';
  }
  return 'bg-gray-100 text-gray-500 ring-gray-200';
}

export function coachClassAdminStatusLabel(status: 'scheduled' | 'cancelled'): string {
  return status === 'scheduled' ? '已排程' : '已取消';
}
