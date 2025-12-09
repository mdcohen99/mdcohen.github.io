
import React, { useState, useMemo, useEffect } from 'react';
import { CSV_DATA } from './constants';
import { parseCSV } from './utils/csvParser';
import { CoachStint, NetworkData, NetworkNode, NetworkLink } from './types';
import Timeline from './components/Timeline';
import NetworkGraph from './components/NetworkGraph';

const App: React.FC = () => {
  const [data, setData] = useState<CoachStint[]>([]);
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterConference, setFilterConference] = useState('All');
  
  // Load and Filter Data
  useEffect(() => {
    const fullData = parseCSV(CSV_DATA);
    
    // Identify "Big Ten Coaches": Anyone who has at least one stint in Big Ten
    const bigTenCoaches = new Set(
      fullData
        .filter(stint => stint.conference === 'Big Ten')
        .map(stint => stint.coach)
    );

    // Keep ALL rows for those coaches
    const filtered = fullData.filter(stint => bigTenCoaches.has(stint.coach));
    
    setData(filtered);
  }, []);

  // Unique lists for dropdowns
  const uniqueConferences = useMemo(() => {
    const confs = new Set(data.map(d => d.conference).filter(Boolean));
    return Array.from(confs).sort();
  }, [data]);

  // Sidebar List Filter
  const filteredCoachList = useMemo(() => {
    const coachMap = new Set<string>();
    data.forEach(stint => {
      let match = true;
      if (searchTerm && !stint.coach.toLowerCase().includes(searchTerm.toLowerCase()) && !stint.college_clean.toLowerCase().includes(searchTerm.toLowerCase())) match = false;
      if (filterConference !== 'All' && stint.conference !== filterConference) match = false;
      
      if (match) coachMap.add(stint.coach);
    });
    return Array.from(coachMap).sort();
  }, [data, searchTerm, filterConference]);

  // Selected Coach Timeline Data
  const selectedCoachStints = useMemo(() => {
    if (!selectedCoach) return [];
    return data.filter(d => d.coach === selectedCoach);
  }, [data, selectedCoach]);

  // Network / Coaching Tree Logic (Individual)
  const individualNetworkData: NetworkData = useMemo(() => {
    if (!selectedCoach || selectedCoachStints.length === 0) return { nodes: [], links: [] };

    const nodesMap = new Map<string, NetworkNode>();
    const links: NetworkLink[] = [];
    
    // Central node (Focus)
    nodesMap.set(selectedCoach, { id: selectedCoach, group: 0, radius: 30, role: 'Focus' });

    selectedCoachStints.forEach(myStint => {
      const school = myStint.college_clean;
      const myRole = myStint.position_title_standardized;
      const isMyHead = myRole === 'Head Coach';
      const myStart = myStint.start_year;
      const myEnd = myStint.end_year || new Date().getFullYear();

      const potentialConnections = data.filter(other => 
        other.college_clean === school &&
        other.coach !== selectedCoach
      );

      potentialConnections.forEach(otherStint => {
        const otherStart = otherStint.start_year;
        const otherEnd = otherStint.end_year || new Date().getFullYear();

        // Check Year Overlap
        if (Math.max(myStart, otherStart) <= Math.min(myEnd, otherEnd)) {
           const otherRole = otherStint.position_title_standardized;
           const isOtherHead = otherRole === 'Head Coach';

           let relationType = 'Colleague';
           let group = 3; 

           if (isMyHead && !isOtherHead) {
             relationType = 'Protege';
             group = 2; 
           } else if (!isMyHead && isOtherHead) {
             relationType = 'Mentor';
             group = 1;
           }

           if (!nodesMap.has(otherStint.coach)) {
             nodesMap.set(otherStint.coach, { 
                id: otherStint.coach, 
                group, 
                radius: group === 3 ? 12 : 18, 
                role: relationType 
             });
           } else {
             const existing = nodesMap.get(otherStint.coach)!;
             if (group < existing.group) {
                existing.group = group;
                existing.role = relationType;
                existing.radius = 18;
             }
           }

           links.push({
             source: selectedCoach,
             target: otherStint.coach,
             value: 1,
             school: school,
             type: relationType
           });
        }
      });
    });

    const uniqueLinks: NetworkLink[] = [];
    const linkSet = new Set();
    links.forEach(l => {
      const key = `${l.target}-${l.school}`;
      if(!linkSet.has(key)) {
        linkSet.add(key);
        uniqueLinks.push(l);
      }
    });

    return {
      nodes: Array.from(nodesMap.values()),
      links: uniqueLinks
    };
  }, [data, selectedCoach, selectedCoachStints]);


  // Global Network Logic
  const globalNetworkData: NetworkData = useMemo(() => {
    if (data.length === 0) return { nodes: [], links: [] };

    const nodesMap = new Map<string, NetworkNode>();
    const linksMap = new Map<string, any>();

    // Determine latest role for coloring (Head Coach vs Assistant in general)
    const latestRoleMap = new Map<string, CoachStint>();
    data.forEach(d => {
        if (!latestRoleMap.has(d.coach)) {
            latestRoleMap.set(d.coach, d);
        } else {
            const current = latestRoleMap.get(d.coach)!;
            const currEnd = current.end_year || 9999;
            const newEnd = d.end_year || 9999;
            if (newEnd > currEnd) {
                latestRoleMap.set(d.coach, d);
            }
        }
    });

    // Create Nodes
    data.forEach(stint => {
        if (!nodesMap.has(stint.coach)) {
            const latest = latestRoleMap.get(stint.coach)!;
            const isHead = latest.position_title_standardized === 'Head Coach';
            nodesMap.set(stint.coach, {
                id: stint.coach,
                group: isHead ? 0 : 3, // 0 = Head Coach, 3 = Assistant/Staff
                radius: isHead ? 8 : 4,
                role: latest.college_clean
            });
        }
    });

    // Create Links based on School + Year Overlap
    const schoolYearMap = new Map<string, Map<number, string[]>>();

    data.forEach(stint => {
      const school = stint.college_clean;
      const start = stint.start_year;
      const end = stint.end_year || new Date().getFullYear();

      if (!schoolYearMap.has(school)) {
        schoolYearMap.set(school, new Map());
      }
      const yearMap = schoolYearMap.get(school)!;

      for (let year = start; year <= end; year++) {
        if (!yearMap.has(year)) {
          yearMap.set(year, []);
        }
        yearMap.get(year)!.push(stint.coach);
      }
    });

    // Generate links from clusters
    schoolYearMap.forEach((yearMap) => {
      yearMap.forEach((coaches) => {
        if (coaches.length > 1) {
          // Create connections between all coaches in this school-year bucket
          // Sort to ensure A-B is same as B-A
          const sortedCoaches = [...coaches].sort();
          for (let i = 0; i < sortedCoaches.length; i++) {
            for (let j = i + 1; j < sortedCoaches.length; j++) {
              const c1 = sortedCoaches[i];
              const c2 = sortedCoaches[j];
              const linkId = `${c1}|${c2}`;

              if (!linksMap.has(linkId)) {
                linksMap.set(linkId, {
                  source: c1,
                  target: c2,
                  value: 0,
                  type: 'Colleague',
                  school: '' // simplified
                });
              }
              linksMap.get(linkId).value += 1;
            }
          }
        }
      });
    });

    return {
      nodes: Array.from(nodesMap.values()),
      links: Array.from(linksMap.values())
    };
  }, [data]);


  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-xl z-20">
        <div className="p-6 border-b border-slate-100 bg-brand-900 text-white flex justify-between items-center">
          <div>
            <h1 className="text-xl font-extrabold mb-1 tracking-tight cursor-pointer" onClick={() => setSelectedCoach(null)}>HoopsConnect</h1>
            <p className="text-xs text-brand-100 font-medium opacity-80">Big Ten Coaching Network</p>
          </div>
          {selectedCoach && (
            <button 
              onClick={() => setSelectedCoach(null)}
              className="p-2 bg-brand-800 hover:bg-brand-700 rounded-full text-white transition-colors"
              title="Return to Home"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
            </button>
          )}
        </div>
        
        <div className="p-4 space-y-4 bg-slate-50">
          <input
            type="text"
            placeholder="Search Coach..."
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <div className="grid grid-cols-1 gap-2">
            <select 
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs bg-white focus:ring-1 focus:ring-brand-500 shadow-sm"
              value={filterConference}
              onChange={(e) => setFilterConference(e.target.value)}
            >
              <option value="All">All Conferences (History)</option>
              {uniqueConferences.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          
          <div className="text-xs text-slate-500 px-1">
            Showing {filteredCoachList.length} Big Ten affiliated coaches
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-slate-100">
            {filteredCoachList.map(coach => (
              <button
                key={coach}
                onClick={() => setSelectedCoach(coach)}
                className={`w-full text-left px-5 py-3 text-sm font-medium transition-all duration-200 ${
                  selectedCoach === coach 
                    ? 'bg-brand-50 text-brand-700 border-l-4 border-brand-500' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent'
                }`}
              >
                {coach}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col relative bg-slate-50">
        {!selectedCoach ? (
          <div className="h-full flex flex-col relative">
             <div className="absolute top-6 left-6 z-10 bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg border border-slate-100 max-w-sm">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Network Overview</h2>
                <p className="text-sm text-slate-600">
                  Visualizing the entire coaching ecosystem. 
                  <br/>
                  <span className="font-semibold text-brand-600">Blue Nodes:</span> Head Coaches
                  <br/>
                  <span className="font-semibold text-slate-500">Grey Nodes:</span> Assistant/Staff
                  <br/>
                  Click any node to explore their specific career and connections.
                </p>
             </div>
             <div className="w-full h-full">
                <NetworkGraph 
                  data={globalNetworkData} 
                  onNodeClick={setSelectedCoach} 
                  mode="cluster"
                  width={window.innerWidth - 320} // approx width
                  height={window.innerHeight} 
                />
             </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="p-8 max-w-7xl mx-auto">
              {/* Header */}
              <header className="mb-8 flex justify-between items-end border-b border-slate-200 pb-6">
                <div>
                  <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{selectedCoach}</h1>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {Array.from(new Set(selectedCoachStints.map(s => s.college_clean))).slice(0, 4).map(school => (
                      <span key={school} className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        {school}
                      </span>
                    ))}
                    {selectedCoachStints.length > 4 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        +{selectedCoachStints.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Coaching Tree Network */}
                <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[600px]">
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center mb-2">
                      <span className="bg-brand-100 p-1.5 rounded-md mr-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </span>
                      Coaching Network
                    </h2>
                    <p className="text-sm text-slate-500">
                      Visualizing mentors, proteges, and colleagues based on overlapping employment years.
                    </p>
                  </div>
                  
                  <div className="flex-1 relative rounded-lg bg-slate-50 border border-slate-100 overflow-hidden">
                    {individualNetworkData.nodes.length > 1 ? (
                       <NetworkGraph 
                         data={individualNetworkData} 
                         onNodeClick={setSelectedCoach} 
                         width={800} 
                         height={500} 
                         mode="tree"
                       />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                        No connections found in this dataset.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 justify-center text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-orange-400"></span> Mentor
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span> Protege
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-slate-400"></span> Colleague
                    </div>
                  </div>
                </section>

                {/* Career Timeline */}
                <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-[600px] overflow-y-auto">
                  <div className="mb-6 sticky top-0 bg-white z-10 pb-2 border-b border-slate-100">
                     <h2 className="text-xl font-bold text-slate-800 flex items-center mb-2">
                      <span className="bg-brand-100 p-1.5 rounded-md mr-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      Career Path
                    </h2>
                  </div>
                  <Timeline stints={selectedCoachStints} />
                </section>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
