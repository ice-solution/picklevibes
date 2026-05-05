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
    setStartMessage('通知遊戲端開始中...');
    try {
      await axios.post(`/games/sessions/${sessionId}/start`);
      setStartStatus('started');
      setStartMessage('已通知遊戲端開始遊戲。');
    } catch (e: any) {
      setStartStatus('error');
      setStartMessage(e?.response?.data?.message || '通知失敗');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 max-w-xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">加入遊戲廳</h1>
          <p className="text-gray-600 mt-2">
            掃描 QR 後會把你綁定到遊戲廳 session，之後可於手機按「開始遊戲」。
          </p>

          <div className="mt-6">
            <div className="text-sm text-gray-700">
              狀態：
              <span className="ml-2 font-semibold">
                {status === 'idle' && '準備中'}
                {status === 'joining' && '加入中'}
                {status === 'joined' && '已加入'}
                {status === 'error' && '失敗'}
              </span>
            </div>
            <div className="mt-2 text-sm text-gray-600">{message}</div>
          </div>

          {status === 'joined' ? (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900 mb-2">開始遊戲</div>
              <div className="text-sm text-gray-600">
                按下開始後，系統會通知遊戲端（大屏幕/遊戲機）開局。
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void startGame()}
                  disabled={startStatus === 'starting' || startStatus === 'started'}
                >
                  {startStatus === 'starting' ? '通知中...' : startStatus === 'started' ? '已通知' : '開始遊戲'}
                </button>
                <div className="text-sm text-gray-600">{startMessage}</div>
              </div>
            </div>
          ) : null}

          {lastResult ? (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900 mb-2">最新遊戲結果</div>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words">
                {JSON.stringify(lastResult, null, 2)}
              </pre>
            </div>
          ) : null}

          <div className="mt-6 flex gap-3">
            <button type="button" className="btn-outline" onClick={() => navigate('/profile')}>
              返回個人資料
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameJoin;

