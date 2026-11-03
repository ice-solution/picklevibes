import React, { useCallback, useState } from 'react';
import CoachListManagement from './CoachListManagement';
import CoachClassManagement from './CoachClassManagement';
import CoachPayrollManagement from './CoachPayrollManagement';

type PrefillCoach = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  coachHourlyRate?: number;
};

type HubTab = 'coaches' | 'classes' | 'payroll';

/** 教練列表 + 派課 + 薪資結算 */
const CoachAdminHub: React.FC = () => {
  const [tab, setTab] = useState<HubTab>('classes');
  const [prefill, setPrefill] = useState<PrefillCoach | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);

  const handleAssign = useCallback((coach: PrefillCoach) => {
    setPrefill(coach);
    setAutoOpen(true);
    setTab('classes');
    window.setTimeout(() => {
      document.getElementById('coach-class-assign')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  const clearPrefill = useCallback(() => {
    setPrefill(null);
    setAutoOpen(false);
  }, []);

  const tabs: { id: HubTab; label: string }[] = [
    { id: 'coaches', label: '教練列表' },
    { id: 'classes', label: '課堂派課' },
    { id: 'payroll', label: '薪資結算' },
  ];

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? 'bg-violet-600 text-white shadow'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'coaches' && <CoachListManagement onAssignCoach={handleAssign} />}

      {tab === 'classes' && (
        <div id="coach-class-assign">
          <CoachClassManagement
            preselectedCoach={prefill}
            autoOpenForm={autoOpen}
            onConsumedPrefill={clearPrefill}
          />
        </div>
      )}

      {tab === 'payroll' && <CoachPayrollManagement />}
    </div>
  );
};

export default CoachAdminHub;
