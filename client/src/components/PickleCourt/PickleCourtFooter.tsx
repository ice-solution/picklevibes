import React from 'react';

const PickleCourtFooter: React.FC = () => (
  <footer className="bg-pickcourt-navy-dark text-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
        <div className="flex items-center gap-4">
          <img
            src="/pickcourt_logo.jpg"
            alt="PickCourt"
            className="h-14 w-auto object-contain bg-white rounded-lg p-1"
          />
          <div>
            <p className="text-pickcourt-gold font-semibold text-lg">Pick Friends.</p>
            <p className="text-white/60 text-sm mt-1">聯盟式匹克球場地與球友平台</p>
          </div>
        </div>
        <div className="text-sm text-white/50 space-y-1">
          <p>© {new Date().getFullYear()} PickCourt. All rights reserved.</p>
          <p className="text-white/40">pickcourt.hk · PickCourt SaaS</p>
        </div>
      </div>
    </div>
  </footer>
);

export default PickleCourtFooter;
