import React from 'react';
import { CoachStint } from '../types';

interface Props {
  stints: CoachStint[];
}

const Timeline: React.FC<Props> = ({ stints }) => {
  // Sort stints by start year descending
  const sortedStints = [...stints].sort((a, b) => b.start_year - a.start_year);

  return (
    <div className="relative border-l-2 border-brand-500 ml-3 space-y-6">
      {sortedStints.map((stint, index) => (
        <div key={index} className="relative pl-6">
          {/* Dot */}
          <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-brand-500 border-2 border-white shadow-sm" />
          
          <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-1">
              <h3 className="text-lg font-bold text-slate-800">{stint.college_clean}</h3>
              <span className="text-sm font-medium text-brand-600 bg-brand-50 px-2 py-0.5 rounded">
                {stint.start_year} - {stint.end_year || 'Present'}
              </span>
            </div>
            <div className="text-md font-semibold text-slate-700">{stint.title}</div>
            <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-2">
              {stint.conference && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                  {stint.conference}
                </span>
              )}
              {stint.division && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                  Div {stint.division}
                </span>
              )}
              {stint.position_title_standardized && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                  {stint.position_title_standardized}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Timeline;