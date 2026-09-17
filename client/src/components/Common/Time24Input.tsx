import React from 'react';

type Time24InputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  /** 分鐘間隔，預設 15 */
  minuteStep?: number;
  id?: string;
};

function parseHhMm(value: string): { hour: string; minute: string } {
  const m = String(value || '')
    .trim()
    .match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  if (!m) return { hour: '', minute: '' };
  return { hour: m[1], minute: m[2] };
}

/**
 * 強制 24 小時制（HH:mm）時段選擇，唔依賴 OS／瀏覽器 locale 嘅 type=time。
 */
const Time24Input: React.FC<Time24InputProps> = ({
  value,
  onChange,
  className = '',
  required = false,
  minuteStep = 15,
  id,
}) => {
  const { hour, minute } = parseHhMm(value);
  const step = Math.max(1, Math.min(60, minuteStep));
  const minuteOptions = Array.from({ length: Math.floor(60 / step) }, (_, i) =>
    String(i * step).padStart(2, '0')
  );

  const emit = (h: string, m: string) => {
    if (!h) {
      onChange('');
      return;
    }
    const mm = m || '00';
    onChange(`${h}:${mm}`);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`.trim()} id={id}>
      <select
        value={hour}
        required={required}
        aria-label="小時（24小時制）"
        onChange={(e) => emit(e.target.value, minute || '00')}
        className="border border-gray-300 rounded-lg px-2 py-2 bg-white min-w-[4.5rem]"
      >
        <option value="">時</option>
        {Array.from({ length: 24 }, (_, i) => {
          const h = String(i).padStart(2, '0');
          return (
            <option key={h} value={h}>
              {h}
            </option>
          );
        })}
      </select>
      <span className="text-gray-500 font-medium">:</span>
      <select
        value={minute}
        required={required && Boolean(hour)}
        aria-label="分鐘"
        onChange={(e) => emit(hour || '00', e.target.value)}
        className="border border-gray-300 rounded-lg px-2 py-2 bg-white min-w-[4.5rem]"
      >
        <option value="">分</option>
        {minuteOptions.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        {/* 若已有唔喺 step 入面嘅值（例如 12:05），保留顯示 */}
        {minute && !minuteOptions.includes(minute) ? (
          <option value={minute}>{minute}</option>
        ) : null}
      </select>
      <span className="text-xs text-gray-400 ml-1">24h</span>
    </div>
  );
};

export default Time24Input;
