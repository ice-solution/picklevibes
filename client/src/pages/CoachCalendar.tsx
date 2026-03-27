import React, { useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DatesSetArg, EventClickArg } from '@fullcalendar/core';
import { motion } from 'framer-motion';
import { CalendarDaysIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';

interface CalendarActivity {
  _id: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  status: string;
  poster?: string | null;
}

function statusColor(status: string): { bg: string; border: string } {
  switch (status) {
    case 'ongoing':
      return { bg: '#10B981', border: '#059669' };
    case 'completed':
      return { bg: '#9CA3AF', border: '#6B7280' };
    case 'cancelled':
      return { bg: '#EF4444', border: '#DC2626' };
    case 'upcoming':
    default:
      return { bg: '#3B82F6', border: '#2563EB' };
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'upcoming':
      return '即將開始';
    case 'ongoing':
      return '進行中';
    case 'completed':
      return '已完結';
    case 'cancelled':
      return '已取消';
    default:
      return status;
  }
}

const CoachCalendar: React.FC = () => {
  const calendarRef = useRef<FullCalendar>(null);
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarActivity | null>(null);

  const loadRange = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/activities/coach-calendar', {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });
      const list: CalendarActivity[] = res.data?.activities || [];
      const mapped: EventInput[] = list.map((a) => {
        const { bg, border } = statusColor(a.status);
        return {
          id: a._id,
          title: a.title,
          start: a.startDate,
          end: a.endDate,
          backgroundColor: bg,
          borderColor: border,
          extendedProps: {
            location: a.location,
            status: a.status,
            poster: a.poster,
            raw: a,
          },
        };
      });
      setEvents(mapped);
    } catch (e: unknown) {
      console.error(e);
      setError('無法載入課表，請確認已以教練身分登入');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDatesSet = useCallback(
    (info: DatesSetArg) => {
      loadRange(info.start, info.end);
    },
    [loadRange]
  );

  const handleEventClick = useCallback((info: EventClickArg) => {
    const raw = info.event.extendedProps.raw as CalendarActivity;
    if (raw) setSelected(raw);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <CalendarDaysIcon className="w-9 h-9 text-primary-600" />
                教練課表
              </h1>
              <p className="text-gray-600 mt-1">
                顯示活動中心已指派您為教練的課程（與「我的課程」相同資料來源，以日曆檢視）
              </p>
            </div>
            <Link
              to="/coach-courses"
              className="text-sm text-primary-600 hover:text-primary-800 font-medium shrink-0"
            >
              改為列表檢視 →
            </Link>
          </div>
        </motion.div>

        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          {(['upcoming', 'ongoing', 'completed', 'cancelled'] as const).map((s) => {
            const c = statusColor(s);
            return (
              <div key={s} className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 rounded"
                  style={{ backgroundColor: c.bg }}
                />
                <span className="text-gray-600">{statusLabel(s)}</span>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 relative">
          {loading && (
            <div className="absolute inset-0 z-10 bg-white/60 flex items-center justify-center rounded-xl">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
            </div>
          )}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            events={events}
            datesSet={handleDatesSet}
            eventClick={handleEventClick}
            height="auto"
            locale="zh-tw"
            buttonText={{
              today: '今天',
              month: '月',
              week: '週',
              day: '日',
            }}
            eventDisplay="block"
            dayMaxEvents={4}
            moreLinkClick="popover"
            slotMinTime="07:00:00"
            slotMaxTime="23:00:00"
            slotDuration="00:30:00"
            slotLabelInterval="01:00:00"
            allDaySlot={false}
            nowIndicator
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }}
          />
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900 pr-4">{selected.title}</h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="關閉"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-2">
              {statusLabel(selected.status)}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              {new Date(selected.startDate).toLocaleString('zh-TW')} —{' '}
              {new Date(selected.endDate).toLocaleString('zh-TW')}
            </p>
            <div className="flex items-start gap-2 text-sm text-gray-600 mb-6">
              <MapPinIcon className="w-5 h-5 shrink-0 text-gray-400" />
              <span>{selected.location}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  navigate(`/activities/${selected._id}`);
                }}
                className="flex-1 min-w-[8rem] px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium"
              >
                活動詳情
              </button>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachCalendar;
