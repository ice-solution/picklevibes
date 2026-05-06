import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

type GameHall = {
  _id: string;
  name: string;
  seasonKey?: string;
  isActive: boolean;
};

type MatchRow = {
  matchId: string;
  userId: string;
  name: string;
  scores: number;
  hitRate: number | null;
  hitAccuracy: number | null;
  maxCombo: number | null;
  createdAt: string;
};

const GameLeaderboardManagement: React.FC = () => {
  const [loadingHalls, setLoadingHalls] = useState(true);
  const [halls, setHalls] = useState<GameHall[]>([]);
  const [selectedHallId, setSelectedHallId] = useState<string>('');

  const [loadingBoard, setLoadingBoard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<MatchRow[]>([]);
  const [seasonKey, setSeasonKey] = useState<string>('season-1');
  const [error, setError] = useState<string>('');

  const selectedHall = useMemo(() => halls.find((h) => h._id === selectedHallId) || null, [halls, selectedHallId]);

  const fetchHalls = async () => {
    setLoadingHalls(true);
    setError('');
    try {
      const res = await axios.get('/game-halls?limit=100');
      const items: GameHall[] = res.data?.data?.items || [];
      setHalls(items);
      if (!selectedHallId && items[0]?._id) setSelectedHallId(items[0]._id);
    } catch (e: any) {
      setHalls([]);
      setError(e?.response?.data?.message || '載入 GameHall 失敗');
    } finally {
      setLoadingHalls(false);
    }
  };

  const fetchLeaderboard = async (hallId: string) => {
    if (!hallId) return;
    setLoadingBoard(true);
    setError('');
    try {
      const res = await axios.get(`/games/${hallId}/matches-leaderboard?limit=50`);
      const data = res.data?.data;
      setSeasonKey(data?.gameHall?.seasonKey || 'season-1');
      setLeaderboard(data?.leaderboard || []);
    } catch (e: any) {
      setLeaderboard([]);
      setError(e?.response?.data?.message || '載入排行榜失敗');
    } finally {
      setLoadingBoard(false);
    }
  };

  useEffect(() => {
    void fetchHalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedHallId) return;
    void fetchLeaderboard(selectedHallId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHallId]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">排行榜</h2>
            <p className="text-gray-600 mt-1">選擇遊戲廳後查看該 season 的排行榜記錄。</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" className="btn-outline" onClick={() => void fetchHalls()} disabled={loadingHalls}>
              {loadingHalls ? '更新中...' : '刷新 GameHall'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => void fetchLeaderboard(selectedHallId)}
              disabled={!selectedHallId || loadingBoard}
            >
              {loadingBoard ? '載入中...' : '刷新排行榜'}
            </button>
          </div>
        </div>
      </motion.div>

      <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-sm text-red-800">{error}</div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">GameHall</label>
            <select
              className="input-field"
              value={selectedHallId}
              onChange={(e) => setSelectedHallId(e.target.value)}
              disabled={loadingHalls}
            >
              {halls.map((h) => (
                <option key={h._id} value={h._id}>
                  {h.name} ({h.isActive ? '啟用' : '停用'})
                </option>
              ))}
            </select>
            {selectedHall ? <div className="text-xs text-gray-500 mt-1">season: {selectedHall.seasonKey || 'season-1'}</div> : null}
          </div>

          <div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs text-gray-600">目前 Season</div>
              <div className="font-mono text-sm text-gray-900 mt-1">{seasonKey}</div>
            </div>
          </div>
        </div>

        {loadingBoard ? (
          <div className="text-gray-600">載入排行榜中...</div>
        ) : leaderboard.length === 0 ? (
          <div className="text-gray-600">暫時未有排行榜資料。</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2 pr-4">排名</th>
                  <th className="py-2 pr-4">用戶</th>
                  <th className="py-2 pr-4">分數</th>
                  <th className="py-2 pr-4">Hit Rate</th>
                  <th className="py-2 pr-4">Hit Accuracy</th>
                  <th className="py-2 pr-4">Max Combo</th>
                  <th className="py-2 pr-4">時間</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, idx) => (
                  <tr key={`${row.matchId}-${idx}`} className="border-b last:border-b-0">
                    <td className="py-2 pr-4 font-semibold text-gray-900 tabular-nums">{idx + 1}</td>
                    <td className="py-2 pr-4">
                      <div className="font-semibold text-gray-900">{row.name || '—'}</div>
                      <div className="text-xs text-gray-500 font-mono break-all">{row.userId}</div>
                    </td>
                    <td className="py-2 pr-4 font-bold text-primary-600 tabular-nums">{(row.scores || 0).toLocaleString()}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.hitRate === null ? '—' : `${(row.hitRate * 100).toFixed(2)}%`}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.hitAccuracy === null ? '—' : `${(row.hitAccuracy * 100).toFixed(2)}%`}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.maxCombo ?? '—'}</td>
                    <td className="py-2 pr-4 text-gray-700">{row.createdAt ? new Date(row.createdAt).toLocaleString('zh-TW') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameLeaderboardManagement;

