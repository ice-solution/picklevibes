import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  formatCoachEventDateLabel,
  formatCoachEventTimeRange24,
  coachEventStatusLabel,
  coachEventStatusBadgeClass,
} from '../utils/coachEventFormat';

interface AssignmentItem {
  kind: 'coach_class';
  id: string;
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
}

const CoachCourses: React.FC = () => {
  const [items, setItems] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      console.error('獲取教練課堂失敗:', err);
      setError('獲取課堂失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const upcomingCount = items.filter((i) => new Date(i.end) >= new Date()).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
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
            type="button"
            onClick={fetchAssignments}
            className="bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700"
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">我的課堂</h1>
            <p className="text-gray-600">管理員指派給您的課堂（地點與時間）</p>
          </div>
          <Link
            to="/coach-calendar"
            className="text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            日曆檢視 →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">課堂總數</p>
            <p className="text-2xl font-semibold text-gray-900">{items.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">尚未結束</p>
            <p className="text-2xl font-semibold text-gray-900">{upcomingCount}</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg mb-4">目前沒有指派課堂</div>
            <p className="text-gray-400">管理員派課後會顯示在這裡</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const isHighlighted = highlightClassId === item.id;
              return (
                <div
                  key={item.id}
                  id={`coach-class-${item.id}`}
                  className={`bg-white rounded-lg shadow-sm border p-5 hover:shadow-md transition-shadow ${
                    isHighlighted
                      ? 'border-violet-500 ring-2 ring-violet-400 ring-offset-2'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-800">
                      教練課堂
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${coachEventStatusBadgeClass(item.status, 'coach_class')}`}
                    >
                      {coachEventStatusLabel(item.status, 'coach_class')}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <div className="text-sm text-gray-600 space-y-0.5">
                    <p>
                      <span className="text-gray-500">日期：</span>
                      {formatCoachEventDateLabel(item.start, item.end)}
                    </p>
                    <p>
                      <span className="text-gray-500">時間：</span>
                      {formatCoachEventTimeRange24(item.start, item.end)}
                    </p>
                    {item.storeName && (
                      <p>
                        <span className="text-gray-500">店鋪：</span>
                        {item.storeName}
                      </p>
                    )}
                    {item.location && (
                      <p>
                        <span className="text-gray-500">地點：</span>
                        {item.location}
                      </p>
                    )}
                    {item.coachNames && item.coachNames.length > 0 && (
                      <p>
                        <span className="text-gray-500">教練：</span>
                        {item.coachNames.join('、')}
                      </p>
                    )}
                    {(item.activityTitle || item.regularActivityTitle) && (
                      <p>
                        <span className="text-gray-500">連結：</span>
                        {[item.activityTitle, item.regularActivityTitle].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  {item.notes && (
                    <p className="text-sm text-gray-500 border-t pt-2 mt-3">{item.notes}</p>
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
