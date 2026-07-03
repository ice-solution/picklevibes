import React, { useEffect, useMemo, useState } from 'react';
import { resolveStoreLogoUrls } from '../utils/storeBrandUtils';

type Props = {
  logoPath?: string | null;
  displayName: string;
  primaryColor: string;
  className?: string;
  fallbackClassName?: string;
};

const StoreBrandLogo: React.FC<Props> = ({
  logoPath,
  displayName,
  primaryColor,
  className = 'h-20 w-20 sm:h-24 sm:w-24 object-contain rounded-2xl bg-white shadow-sm border border-gray-100 p-2',
  fallbackClassName = 'h-20 w-20 sm:h-24 sm:w-24 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-sm',
}) => {
  const candidates = useMemo(() => resolveStoreLogoUrls(logoPath), [logoPath]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [logoPath]);

  const src = candidates[index];
  const label = displayName || '店鋪';

  if (!src) {
    return (
      <div className={fallbackClassName} style={{ backgroundColor: primaryColor }}>
        {label.charAt(0)}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={label}
      className={className}
      onError={() => {
        if (index < candidates.length - 1) setIndex((i) => i + 1);
      }}
    />
  );
};

export default StoreBrandLogo;
