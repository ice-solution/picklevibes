import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DatesSetArg, EventClickArg } from '@fullcalendar/core';
import { motion } from 'framer-motion';
import { CalendarDaysIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import api from '../services/api';
import {
  formatCoachEventDateLabel,
  formatCoachEventTimeRange24,
  coachEventStatusLabel,
  coachEventStatusBadgeClass,
} from '../utils/coachEventFormat';

interface CalendarEvent {
  id: string;
  sourceId: string;
  type: 'coach_class';
  title: string;
  start: string;
  end: string;
  location: string;
  status: string;
  notes?: string;
  storeName?: string;
  activityTitle?: string;
  regularActivityTitle?: string;
  coachNames?: string[];
  court?: { id: string; name: string; number?: number } | null;
}

const CoachCalendar: React.FC = () => {
  const calendarRef = useRef<FullCalendar>(null);
  const [searchParams] = useSearchParams();
  const deepLinkClassId = searchParams.get('class');
  const [events, setEvents] = useState<EventInput[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const deepLinkHandledRef = useRef(false);

  const loadRange = useCallback(async (start: Date, end: Date) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/coach-classes/calendar', {
        params: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });
      const list: CalendarEvent[] = res.data?.events || [];
      setCalendarEvents(list);
      setEvents(
        list.map((ev) => ({
          id: ev.id,
          title: ev.title,
          start: ev.start,
          end: ev.end,
          backgroundColor: '#7C3AED',
          borderColor: '#6D28D9',
          extendedProps: { raw: ev },
        }))
      );
    } catch (e: unknown) {
      console.error(e);
      setError('無法載入課表，請確認已以教練身分登入');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!deepLinkClassId || deepLinkHandledRef.current || calendarEvents.length === 0) return;
    const match = calendarEvents.find((ev) => ev.sourceId === deepLinkClassId);
    if (match) {
      deepLinkHandledRef.current = true;
      setSelected(match);
      calendarRef.current?.getApi()?.gotoDate(new Date(match.start));
    }
  }, [calendarEvents, deepLinkClassId]);

  const handleDatesSet = useCallback(
    (info: DatesSetArg) => {
      loadRange(info.start, info.end);
    },
    [loadRange]
  );

  const handleEventClick = useCallback((info: EventClickArg) => {
    const raw = info.event.extendedProps.raw as CalendarEvent;
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
              <p className="text-gray-600 mt-1">管理員指派給您的課堂</p>
            </div>
            <Link
              to="/coach-courses"
              className="text-sm text-primary-600 hover:text-primary-800 font-medium shrink-0"
            >
              改為列表檢視 →
            </Link>
          </div>
        </motion.div>

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
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">教練課堂</p>
                <h3 className="text-lg font-semibold text-gray-900 pr-4">{selected.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="關閉"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset mb-3 ${coachEventStatusBadgeClass(selected.status, 'coach_class')}`}
            >
              {coachEventStatusLabel(selected.status, 'coach_class')}
            </span>
            <div className="space-y-1 text-sm text-gray-700 mb-3">
              <p>
                <span className="text-gray-500">日期：</span>
                {formatCoachEventDateLabel(selected.start, selected.end)}
              </p>
              <p>
                <span className="text-gray-500">時間：</span>
                {formatCoachEventTimeRange24(selected.start, selected.end)}
              </p>
              {selected.storeName && (
                <p>
                  <span className="text-gray-500">店鋪：</span>
                  {selected.storeName}
                </p>
              )}
              {selected.coachNames && selected.coachNames.length > 0 && (
                <p>
                  <span className="text-gray-500">教練：</span>
                  {selected.coachNames.join('、')}
                </p>
              )}
              {(selected.activityTitle || selected.regularActivityTitle) && (
                <p>
                  <span className="text-gray-500">連結：</span>
                  {[selected.activityTitle, selected.regularActivityTitle]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
            {selected.location && (
              <div className="flex items-start gap-2 text-sm text-gray-600 mb-4">
                <MapPinIcon className="w-5 h-5 shrink-0 text-gray-400" />
                <span>{selected.location}</span>
              </div>
            )}
            {selected.notes && (
              <p className="text-sm text-gray-600 mb-4 border-t pt-3">{selected.notes}</p>
            )}
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachCalendar;
