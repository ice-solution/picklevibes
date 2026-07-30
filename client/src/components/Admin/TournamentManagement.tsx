import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import {
  PlusIcon,
  ArrowLeftIcon,
  TrashIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import { useLockedStoreId } from '../../contexts/StoreAdminContext';

type EventDoc = {
  _id: string;
  name: string;
  slug: string;
  dateStart?: string;
  dateEnd?: string;
  venues?: string[];
  description?: string;
  isActive?: boolean;
};

type TournamentDoc = {
  _id: string;
  name: string;
  phase: 'group' | 'knockout';
  advancePerGroup?: number;
  competitionDate?: string;
  sourceGroupTournamentId?: string | null;
  groupWinPoints?: number;
  groupLossPoints?: number;
};

type GroupDoc = { _id: string; name: string; order?: number };
type TeamDoc = {
  _id: string;
  name: string;
  code?: string;
  groupId?: string;
  isPlaceholder?: boolean;
};
type MatchDoc = {
  _id: string;
  round?: string;
  court?: string;
  scheduledTime?: string;
  status: string;
  matchFormat: string;
  groupId?: string;
  teamA: TeamDoc | string;
  teamB: TeamDoc | string;
  winnerId?: TeamDoc | string;
  completedGames?: { a: number; b: number }[];
};

type StandingBlock = {
  group: GroupDoc;
  rows: Array<{
    teamId: string;
    name: string;
    code: string;
    played: number;
    wins: number;
    losses: number;
    points: number;
    pointDiff: number;
  }>;
};

function teamLabel(t: TeamDoc | string | undefined): string {
  if (!t) return '—';
  if (typeof t === 'string') return t;
  return t.code ? `${t.code} ${t.name}` : t.name;
}

function errMsg(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
    '操作失敗'
  );
}

const TournamentManagement: React.FC = () => {
  const storeId = useLockedStoreId();
  const [view, setView] = useState<'list' | 'event' | 'tournament'>('list');
  const [events, setEvents] = useState<EventDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventId, setEventId] = useState<string | null>(null);
  const [eventDetail, setEventDetail] = useState<EventDoc | null>(null);
  const [tournaments, setTournaments] = useState<TournamentDoc[]>([]);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [tournament, setTournament] = useState<TournamentDoc | null>(null);
  const [groups, setGroups] = useState<GroupDoc[]>([]);
  const [teams, setTeams] = useState<TeamDoc[]>([]);
  const [matches, setMatches] = useState<MatchDoc[]>([]);
  const [standings, setStandings] = useState<StandingBlock[]>([]);
  const [siblings, setSiblings] = useState<TournamentDoc[]>([]);
  const [busy, setBusy] = useState(false);

  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newTourName, setNewTourName] = useState('');
  const [newTourPhase, setNewTourPhase] = useState<'group' | 'knockout'>('group');
  const [newGroupName, setNewGroupName] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamGroupId, setNewTeamGroupId] = useState('');
  const [matchForm, setMatchForm] = useState({
    teamA: '',
    teamB: '',
    groupId: '',
    round: '',
    scheduledTime: '',
    court: '',
  });
  const [scoreEditId, setScoreEditId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');

  const fetchEvents = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const res = await axios.get(`/tournaments/events?store=${storeId}`);
      setEvents(res.data.events || []);
    } catch (e) {
      console.error(e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const openEvent = async (id: string) => {
    try {
      setBusy(true);
      const res = await axios.get(`/tournaments/events/${id}`);
      setEventId(id);
      setEventDetail(res.data.event);
      setTournaments(res.data.tournaments || []);
      setView('event');
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const openTournament = async (id: string) => {
    try {
      setBusy(true);
      const res = await axios.get(`/tournaments/tournaments/${id}`);
      setTournamentId(id);
      setTournament(res.data.tournament);
      setEventDetail(res.data.event);
      setEventId(res.data.event?._id || eventId);
      setGroups(res.data.groups || []);
      setTeams(res.data.teams || []);
      setMatches(res.data.matches || []);
      setStandings(res.data.standings || []);
      setSiblings(res.data.siblingTournaments || []);
      setView('tournament');
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const refreshTournament = async () => {
    if (tournamentId) await openTournament(tournamentId);
  };

  const createEvent = async () => {
    if (!storeId || !newEventName.trim()) return;
    try {
      setBusy(true);
      await axios.post('/tournaments/events', {
        store: storeId,
        name: newEventName.trim(),
        dateStart: newEventDate || undefined,
      });
      setNewEventName('');
      setNewEventDate('');
      await fetchEvents();
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!window.confirm('刪除此賽事及其全部賽制／場次？')) return;
    try {
      await axios.delete(`/tournaments/events/${id}`);
      if (eventId === id) {
        setView('list');
        setEventId(null);
      }
      await fetchEvents();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const createTournament = async () => {
    if (!eventId || !newTourName.trim()) return;
    try {
      setBusy(true);
      await axios.post(`/tournaments/events/${eventId}/tournaments`, {
        name: newTourName.trim(),
        phase: newTourPhase,
      });
      setNewTourName('');
      await openEvent(eventId);
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const deleteTournament = async (id: string) => {
    if (!window.confirm('刪除此賽制及組別／隊伍／場次？')) return;
    try {
      await axios.delete(`/tournaments/tournaments/${id}`);
      if (eventId) await openEvent(eventId);
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const createGroup = async () => {
    if (!tournamentId || !newGroupName.trim()) return;
    try {
      await axios.post(`/tournaments/tournaments/${tournamentId}/groups`, {
        name: newGroupName.trim(),
      });
      setNewGroupName('');
      await refreshTournament();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const createTeam = async () => {
    if (!tournamentId || !newTeamName.trim()) return;
    try {
      await axios.post(`/tournaments/tournaments/${tournamentId}/teams`, {
        name: newTeamName.trim(),
        groupId: newTeamGroupId || undefined,
      });
      setNewTeamName('');
      await refreshTournament();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const createMatch = async () => {
    if (!tournamentId || !matchForm.teamA || !matchForm.teamB) return;
    try {
      await axios.post(`/tournaments/tournaments/${tournamentId}/matches`, matchForm);
      setMatchForm({ teamA: '', teamB: '', groupId: '', round: '', scheduledTime: '', court: '' });
      await refreshTournament();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const generateRR = async () => {
    if (!tournamentId) return;
    if (!window.confirm('為各組產生循環賽場次（已有對戰會略過）？')) return;
    try {
      setBusy(true);
      const res = await axios.post(`/tournaments/tournaments/${tournamentId}/generate-round-robin`);
      alert(`已新增 ${res.data.created || 0} 場`);
      await refreshTournament();
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const generateKO = async () => {
    if (!tournamentId || !tournament) return;
    const source =
      tournament.sourceGroupTournamentId ||
      siblings.find((s) => s.phase === 'group')?._id;
    if (!source) {
      alert('請先建立小組賽並綁定');
      return;
    }
    try {
      setBusy(true);
      if (!tournament.sourceGroupTournamentId) {
        await axios.post(`/tournaments/tournaments/${tournamentId}/link-group`, {
          sourceGroupTournamentId: source,
        });
      }
      const res = await axios.post(`/tournaments/tournaments/${tournamentId}/generate-knockout`, {
        sourceGroupTournamentId: source,
      });
      alert(`已建立 ${res.data.createdMatches || 0} 場淘汰賽`);
      await refreshTournament();
    } catch (e) {
      alert(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const saveScore = async (matchId: string) => {
    try {
      await axios.put(`/tournaments/matches/${matchId}`, {
        completedGameA: [scoreA],
        completedGameB: [scoreB],
        status: 'finished',
      });
      setScoreEditId(null);
      setScoreA('');
      setScoreB('');
      await refreshTournament();
    } catch (e) {
      alert(errMsg(e));
    }
  };

  const realTeams = teams.filter((t) => !t.isPlaceholder);

  if (!storeId) {
    return <div className="p-6 text-gray-500">請從店鋪後台進入比賽管理</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <TrophyIcon className="w-7 h-7 text-amber-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">比賽管理</h2>
          <p className="text-sm text-gray-500">建立賽事、賽制、組別與排賽程</p>
        </div>
      </div>

      {view === 'list' && (
        <div className="space-y-4">
          <div className="bg-white border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">建立賽事</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="border rounded-lg px-3 py-2 flex-1"
                placeholder="賽事名稱"
                value={newEventName}
                onChange={(e) => setNewEventName(e.target.value)}
              />
              <input
                type="date"
                className="border rounded-lg px-3 py-2"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !newEventName.trim()}
                onClick={() => void createEvent()}
                className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg bg-primary-600 text-white disabled:opacity-50"
              >
                <PlusIcon className="w-4 h-4" /> 建立
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-500">載入中…</div>
          ) : events.length === 0 ? (
            <div className="text-center py-10 text-gray-500">尚未有賽事</div>
          ) : (
            <ul className="space-y-2">
              {events.map((ev) => (
                <li
                  key={ev._id}
                  className="bg-white border rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                >
                  <button
                    type="button"
                    className="text-left flex-1 min-w-0"
                    onClick={() => void openEvent(ev._id)}
                  >
                    <div className="font-medium text-gray-900 truncate">{ev.name}</div>
                    <div className="text-xs text-gray-500">
                      {ev.dateStart ? new Date(ev.dateStart).toLocaleDateString('zh-HK') : '未設日期'}
                      {ev.isActive === false ? ' · 已停用' : ''}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    onClick={() => void deleteEvent(ev._id)}
                    aria-label="刪除"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view === 'event' && eventDetail && (
        <div className="space-y-4">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => {
              setView('list');
              void fetchEvents();
            }}
          >
            <ArrowLeftIcon className="w-4 h-4" /> 返回賽事列表
          </button>
          <h3 className="text-lg font-bold">{eventDetail.name}</h3>

          <div className="bg-white border rounded-xl p-4 space-y-3">
            <h4 className="font-semibold">新增賽制</h4>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="border rounded-lg px-3 py-2 flex-1"
                placeholder="例如：男子雙打小組賽"
                value={newTourName}
                onChange={(e) => setNewTourName(e.target.value)}
              />
              <select
                className="border rounded-lg px-3 py-2"
                value={newTourPhase}
                onChange={(e) => setNewTourPhase(e.target.value as 'group' | 'knockout')}
              >
                <option value="group">小組賽</option>
                <option value="knockout">淘汰賽</option>
              </select>
              <button
                type="button"
                disabled={busy || !newTourName.trim()}
                onClick={() => void createTournament()}
                className="px-4 py-2 rounded-lg bg-primary-600 text-white disabled:opacity-50"
              >
                新增
              </button>
            </div>
          </div>

          <ul className="space-y-2">
            {tournaments.map((t) => (
              <li
                key={t._id}
                className="bg-white border rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              >
                <button
                  type="button"
                  className="text-left flex-1"
                  onClick={() => void openTournament(t._id)}
                >
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-gray-500">
                    {t.phase === 'group' ? '小組賽' : '淘汰賽'}
                    {t.competitionDate ? ` · ${t.competitionDate}` : ''}
                  </div>
                </button>
                <button
                  type="button"
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  onClick={() => void deleteTournament(t._id)}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </li>
            ))}
            {tournaments.length === 0 && (
              <li className="text-center text-gray-500 py-6">尚未建立賽制</li>
            )}
          </ul>
        </div>
      )}

      {view === 'tournament' && tournament && (
        <div className="space-y-6">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => {
              if (eventId) void openEvent(eventId);
              else setView('list');
            }}
          >
            <ArrowLeftIcon className="w-4 h-4" /> 返回賽事
          </button>

          <div>
            <h3 className="text-lg font-bold">{tournament.name}</h3>
            <p className="text-sm text-gray-500">
              {tournament.phase === 'group' ? '小組賽' : '淘汰賽'}
              {eventDetail ? ` · ${eventDetail.name}` : ''}
            </p>
          </div>

          {tournament.phase === 'group' && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void generateRR()}
                className="px-3 py-2 text-sm rounded-lg border border-amber-300 bg-amber-50 text-amber-900"
              >
                一鍵產生循環賽程
              </button>
            </div>
          )}

          {tournament.phase === 'knockout' && (
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h4 className="font-semibold">淘汰賽產生</h4>
              <p className="text-sm text-gray-500">
                依小組積分取前 {tournament.advancePerGroup ?? 2} 名產生對陣（移植自計分系統）
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void generateKO()}
                className="px-3 py-2 text-sm rounded-lg bg-primary-600 text-white"
              >
                由小組賽產生淘汰賽程
              </button>
            </div>
          )}

          {/* Groups */}
          <section className="bg-white border rounded-xl p-4 space-y-3">
            <h4 className="font-semibold">組別</h4>
            <div className="flex gap-2">
              <input
                className="border rounded-lg px-3 py-2 flex-1"
                placeholder="例如：A組"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void createGroup()}
                className="px-3 py-2 rounded-lg bg-gray-800 text-white text-sm"
              >
                新增組別
              </button>
            </div>
            <ul className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <li key={g._id} className="px-3 py-1 rounded-full bg-gray-100 text-sm">
                  {g.name}
                </li>
              ))}
              {groups.length === 0 && <li className="text-sm text-gray-400">尚無組別</li>}
            </ul>
          </section>

          {/* Teams */}
          <section className="bg-white border rounded-xl p-4 space-y-3">
            <h4 className="font-semibold">隊伍</h4>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="border rounded-lg px-3 py-2 flex-1"
                placeholder="隊伍名稱"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
              <select
                className="border rounded-lg px-3 py-2"
                value={newTeamGroupId}
                onChange={(e) => setNewTeamGroupId(e.target.value)}
              >
                <option value="">未分組</option>
                {groups.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void createTeam()}
                className="px-3 py-2 rounded-lg bg-gray-800 text-white text-sm"
              >
                新增隊伍
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-3">代號</th>
                    <th className="py-2 pr-3">名稱</th>
                    <th className="py-2">組別</th>
                  </tr>
                </thead>
                <tbody>
                  {realTeams.map((t) => (
                    <tr key={t._id} className="border-b border-gray-50">
                      <td className="py-2 pr-3 font-mono">{t.code || '—'}</td>
                      <td className="py-2 pr-3">{t.name}</td>
                      <td className="py-2">
                        {groups.find((g) => g._id === t.groupId)?.name || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {realTeams.length === 0 && (
                <p className="text-sm text-gray-400 py-2">尚無隊伍</p>
              )}
            </div>
          </section>

          {/* Standings */}
          {tournament.phase === 'group' && standings.length > 0 && (
            <section className="bg-white border rounded-xl p-4 space-y-4">
              <h4 className="font-semibold">小組積分</h4>
              {standings.map((block) => (
                <div key={block.group._id}>
                  <div className="text-sm font-medium text-gray-700 mb-1">{block.group.name}</div>
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-1 pr-2">#</th>
                        <th className="py-1 pr-2">隊伍</th>
                        <th className="py-1 pr-2">賽</th>
                        <th className="py-1 pr-2">勝</th>
                        <th className="py-1 pr-2">負</th>
                        <th className="py-1 pr-2">積分</th>
                        <th className="py-1">得失</th>
                      </tr>
                    </thead>
                    <tbody>
                      {block.rows.map((r, i) => (
                        <tr key={r.teamId} className="border-b border-gray-50">
                          <td className="py-1 pr-2">{i + 1}</td>
                          <td className="py-1 pr-2">
                            {r.code ? `${r.code} ` : ''}
                            {r.name}
                          </td>
                          <td className="py-1 pr-2">{r.played}</td>
                          <td className="py-1 pr-2">{r.wins}</td>
                          <td className="py-1 pr-2">{r.losses}</td>
                          <td className="py-1 pr-2 font-medium">{r.points}</td>
                          <td className="py-1">{r.pointDiff}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </section>
          )}

          {/* Matches / schedule */}
          <section className="bg-white border rounded-xl p-4 space-y-3">
            <h4 className="font-semibold">排賽程／場次</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <select
                className="border rounded-lg px-3 py-2"
                value={matchForm.teamA}
                onChange={(e) => setMatchForm((f) => ({ ...f, teamA: e.target.value }))}
              >
                <option value="">隊伍 A</option>
                {realTeams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {teamLabel(t)}
                  </option>
                ))}
              </select>
              <select
                className="border rounded-lg px-3 py-2"
                value={matchForm.teamB}
                onChange={(e) => setMatchForm((f) => ({ ...f, teamB: e.target.value }))}
              >
                <option value="">隊伍 B</option>
                {realTeams.map((t) => (
                  <option key={t._id} value={t._id}>
                    {teamLabel(t)}
                  </option>
                ))}
              </select>
              <select
                className="border rounded-lg px-3 py-2"
                value={matchForm.groupId}
                onChange={(e) => setMatchForm((f) => ({ ...f, groupId: e.target.value }))}
              >
                <option value="">組別（可選）</option>
                {groups.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="輪次（如八強）"
                value={matchForm.round}
                onChange={(e) => setMatchForm((f) => ({ ...f, round: e.target.value }))}
              />
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="時間 HH:mm"
                value={matchForm.scheduledTime}
                onChange={(e) => setMatchForm((f) => ({ ...f, scheduledTime: e.target.value }))}
              />
              <input
                className="border rounded-lg px-3 py-2"
                placeholder="場地"
                value={matchForm.court}
                onChange={(e) => setMatchForm((f) => ({ ...f, court: e.target.value }))}
              />
            </div>
            <button
              type="button"
              onClick={() => void createMatch()}
              className="px-3 py-2 rounded-lg bg-gray-800 text-white text-sm"
            >
              手動新增場次
            </button>

            <ul className="divide-y border rounded-lg mt-2">
              {matches.map((m) => (
                <li key={m._id} className="px-3 py-3 text-sm space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-gray-500 mr-2">
                        {m.scheduledTime || '未排時'}
                        {m.court ? ` · ${m.court}` : ''}
                        {m.round ? ` · ${m.round}` : ''}
                      </span>
                      <div className="font-medium">
                        {teamLabel(m.teamA as TeamDoc)} vs {teamLabel(m.teamB as TeamDoc)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {m.status}
                        {m.completedGames?.length
                          ? ` · ${m.completedGames.map((g) => `${g.a}-${g.b}`).join(', ')}`
                          : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="text-primary-600 text-xs"
                      onClick={() => {
                        setScoreEditId(m._id);
                        setScoreA(String(m.completedGames?.[0]?.a ?? ''));
                        setScoreB(String(m.completedGames?.[0]?.b ?? ''));
                      }}
                    >
                      錄入比分
                    </button>
                  </div>
                  {scoreEditId === m._id && (
                    <div className="flex items-center gap-2">
                      <input
                        className="border rounded w-16 px-2 py-1"
                        value={scoreA}
                        onChange={(e) => setScoreA(e.target.value)}
                        placeholder="A"
                      />
                      <span>-</span>
                      <input
                        className="border rounded w-16 px-2 py-1"
                        value={scoreB}
                        onChange={(e) => setScoreB(e.target.value)}
                        placeholder="B"
                      />
                      <button
                        type="button"
                        className="px-2 py-1 bg-primary-600 text-white rounded text-xs"
                        onClick={() => void saveScore(m._id)}
                      >
                        完賽儲存
                      </button>
                      <button
                        type="button"
                        className="text-xs text-gray-500"
                        onClick={() => setScoreEditId(null)}
                      >
                        取消
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {matches.length === 0 && (
                <li className="px-3 py-6 text-center text-gray-400">尚未有場次</li>
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
};

export default TournamentManagement;
