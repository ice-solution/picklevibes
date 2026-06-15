import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  formatCoachEventDateLabel,
  formatCoachEventTimeRange24,
  coachEventStatusLabel,
  coachEventStatusBadgeClass,
} from '../utils/coachEventFormat';

type ItemKind = 'activity' | 'coach_class' | 'schedule_request';

interface AssignmentItem {
  kind: ItemKind;
  id: string;
  title: string;
  start: string;
  end: string;
  location: string;
  status: string;
  poster?: string | null;
  notes?: string;
  raw?: {
    totalRegistered?: number;
    maxParticipants?: number;
    availableSpots?: number;
    price?: number;
    description?: string;
  };
}

const kindLabel: Record<ItemKind, string> = {
  activity: '活動課程',
  coach_class: '教練課堂',
  schedule_request: '學校要請',
};

const kindColor: Record<ItemKind, string> = {
  activity: 'bg-blue-100 text-blue-800',
  coach_class: 'bg-violet-100 text-violet-800',
  schedule_request: 'bg-amber-100 text-amber-800',
};

const CoachCourses: React.FC = () => {
  const [items, setItems] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightClassId = searchParams.get('class');
  const scrolledRef = useRef(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

  useEffect(() => {
    if (!highlightClassId || items.length === 0 || scrolledRef.current) return;
    const el = document.getElementById(`coach-class-${highlightClassId}`);
    if (el) {
      scrolledRef.current = true;
      window.setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  }, [items, highlightClassId]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/coach-classes/assignments');
      setItems(response.data?.items || []);
    } catch (err: unknown) {
      console.error('獲取教練指派失敗:', err);
      setError('獲取課程失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (start: string, end: string) => ({
    date: formatCoachEventDateLabel(start, end),
    time: formatCoachEventTimeRange24(start, end),
  });

  const upcomingCount = items.filter((i) => new Date(i.end) >= new Date()).length;
  const activityCount = items.filter((i) => i.kind === 'activity').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-red-600 text-lg mb-4">{error}</div>
          <button
            onClick={fetchAssignments}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            重新載入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">我的課程預約</h1>
            <p className="text-gray-600">活動課程、教練課堂及已批核學校要請</p>
          </div>
          <Link
            to="/coach-calendar"
            className="text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            日曆檢視 →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">總指派項目</p>
            <p className="text-2xl font-semibold text-gray-900">{items.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">尚未結束</p>
            <p className="text-2xl font-semibold text-gray-900">{upcomingCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">活動課程</p>
            <p className="text-2xl font-semibold text-gray-900">{activityCount}</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-4">目前沒有指派給您的課程</div>
            <p className="text-gray-400">管理員指派活動或教練課堂後會顯示在這裡</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const isHighlighted =
                item.kind === 'coach_class' && highlightClassId === item.id;
              return (
              <div
                key={`${item.kind}-${item.id}`}
                id={item.kind === 'coach_class' ? `coach-class-${item.id}` : undefined}
                className={`bg-white rounded-lg shadow-sm border p-5 hover:shadow-md transition-shadow ${
                  isHighlighted
                    ? 'border-violet-500 ring-2 ring-violet-400 ring-offset-2'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${kindColor[item.kind]}`}>
                        {kindLabel[item.kind]}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${coachEventStatusBadgeClass(item.status, item.kind)}`}
                      >
                        {coachEventStatusLabel(item.status, item.kind)}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                  </div>
                  {item.kind === 'activity' && item.raw?.totalRegistered != null && (
                    <span className="text-sm text-gray-500">
                      報名 {item.raw.totalRegistered}
                      {item.raw.maxParticipants != null ? ` / ${item.raw.maxParticipants}` : ''}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mb-1 space-y-0.5">
                  <p>
                    <span className="text-gray-500">日期：</span>
                    {formatDateTime(item.start, item.end).date}
                  </p>
                  <p>
                    <span className="text-gray-500">時間：</span>
                    {formatDateTime(item.start, item.end).time}
                  </p>
                </div>
                {item.location && (
                  <p className="text-sm text-gray-500 mb-2">{item.location}</p>
                )}
                {item.notes && (
                  <p className="text-sm text-gray-500 border-t pt-2 mt-2">{item.notes}</p>
                )}
                {item.kind === 'activity' && (
                  <button
                    type="button"
                    onClick={() => navigate(`/activities/${item.id}`)}
                    className="mt-3 text-sm text-primary-600 hover:text-primary-800 font-medium"
                  >
                    查看活動詳情 →
                  </button>
                )}
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CoachCourses;
