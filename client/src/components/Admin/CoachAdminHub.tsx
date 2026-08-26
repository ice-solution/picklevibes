import React, { useCallback, useState } from 'react';
import CoachListManagement from './CoachListManagement';
import CoachClassManagement from './CoachClassManagement';

type PrefillCoach = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  coachHourlyRate?: number;
};

/** 教練列表 + 派課 */
const CoachAdminHub: React.FC = () => {
  const [prefill, setPrefill] = useState<PrefillCoach | null>(null);
  const [autoOpen, setAutoOpen] = useState(false);

  const handleAssign = useCallback((coach: PrefillCoach) => {
    setPrefill(coach);
    setAutoOpen(true);
    window.setTimeout(() => {
      document.getElementById('coach-class-assign')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  const clearPrefill = useCallback(() => {
    setPrefill(null);
    setAutoOpen(false);
  }, []);

  return (
    <div className="space-y-10">
      <CoachListManagement onAssignCoach={handleAssign} />
      <div id="coach-class-assign" className="border-t border-gray-200 pt-8">
        <CoachClassManagement
          preselectedCoach={prefill}
          autoOpenForm={autoOpen}
          onConsumedPrefill={clearPrefill}
        />
      </div>
    </div>
  );
};

export default CoachAdminHub;
