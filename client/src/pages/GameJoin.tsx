import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { io, Socket } from 'socket.io-client';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

const GameJoin: React.FC = () => {
  const { sessionId } = useParams();
  const query = useQuery();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [status, setStatus] = useState<'idle' | 'joining' | 'joined' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [lastResult, setLastResult] = useState<any>(null);
  const [startStatus, setStartStatus] = useState<'idle' | 'starting' | 'started' | 'error'>('idle');
  const [startMessage, setStartMessage] = useState<string>('');

  const sig = query.get('sig') || '';
  const code = query.get('code') || '';

  useEffect(() => {
    // 若未登入，ProtectedRoute 會擋；這裡保險處理
    if (!user) return;
    if (!sessionId) {
      setStatus('error');
      setMessage('缺少 sessionId');
      return;
    }
    if (!sig || !code) {
      setStatus('error');
      setMessage('QR 參數不完整');
      return;
    }

    const run = async () => {
      setStatus('joining');
      setMessage('加入遊戲廳中...');
      try {
        await axios.post(`/games/sessions/${sessionId}/join`, { sig, code });
        setStatus('joined');
        setMessage('已加入遊戲廳。你可以在手機按「開始遊戲」通知遊戲端開局。');
      } catch (e: any) {
        setStatus('error');
        setMessage(e?.response?.data?.message || '加入失敗');
      }
    };
    void run();
  }, [user, sessionId, sig, code]);

  useEffect(() => {
    if (!user) return;
    let socket: Socket | null = null;
    try {
      socket = io('/', { transports: ['websocket'] });
      socket.on('connect', () => {
        socket?.emit('user:watch', { userId: user.id });
      });
      socket.on('game:result', (payload) => {
        setLastResult(payload);
      });
    } catch {
      // ignore
    }
    return () => {
      try {
        socket?.disconnect();
      } catch {
        // ignore
      }
    };
  }, [user]);

  const startGame = async () => {
    if (!sessionId) return;
    setStartStatus('starting');
    setStartMessage('通知中...');
    try {
      await axios.post(`/games/sessions/${sessionId}/start`);
      setStartStatus('started');
      setStartMessage('已通知');
    } catch (e: any) {
      setStartStatus('error');
      setStartMessage(e?.response?.data?.message || '通知失敗');
    }
  };

  const resultScores = useMemo(() => {
    const v = lastResult?.scores;
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }, [lastResult]);

  const resultHitRate = useMemo(() => {
    const v = lastResult?.hitRate;
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }, [lastResult]);

  const resultMaxCombo = useMemo(() => {
    const v = lastResult?.maxCombo;
    if (v === undefined || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }, [lastResult]);

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 max-w-xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">開始遊戲</h1>

          {status === 'joined' ? (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mt-1">
                <button
                  type="button"
                  className="btn-primary w-full"
                  onClick={() => void startGame()}
                  disabled={startStatus === 'starting' || startStatus === 'started'}
                >
                  {startStatus === 'starting' ? '通知中...' : startStatus === 'started' ? '已通知' : '開始遊戲'}
                </button>
                {startMessage ? <div className="mt-2 text-sm text-gray-600">{startMessage}</div> : null}
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm text-gray-600">{message || '處理中...'}</div>
              {status === 'error' ? (
                <div className="mt-3">
                  <button type="button" className="btn-outline w-full" onClick={() => navigate('/profile')}>
                    返回
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {lastResult ? (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-left">
                  <div className="text-xs font-semibold text-primary-600">分數</div>
                  <div className="mt-1 text-2xl font-extrabold text-primary-600 tabular-nums">
                    {resultScores ?? '--'}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-primary-600">Hit Rate</div>
                  <div className="mt-1 text-2xl font-extrabold text-primary-600 tabular-nums">
                    {resultHitRate === null ? '--' : resultHitRate}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-primary-600">Max Combo</div>
                  <div className="mt-1 text-2xl font-extrabold text-primary-600 tabular-nums">
                    {resultMaxCombo ?? '--'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <button type="button" className="btn-outline w-full" onClick={() => navigate('/profile')}>
              返回
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameJoin;

