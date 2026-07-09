import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { PICKCOURT_ACCOUNT } from '../../utils/pickcourtRoutes';

/**
 * PickCourt 主站：舊會員路徑導向 /account/*
 * PickleVibes 子站（/picklevibes/*）仍使用舊頁面
 */
export function PickCourtMemberRedirect({
  to,
  legacy,
}: {
  to: string;
  legacy: React.ReactElement;
}) {
  const location = useLocation();
  const onPickleVibesOnly =
    location.pathname.startsWith('/picklevibes') ||
    location.pathname === '/picklevibes';

  if (onPickleVibesOnly) {
    return legacy;
  }
  return <Navigate to={to} replace />;
}

/** /orders/:id → /account/orders/:id */
export function PickCourtOrderDetailRedirect({ legacy }: { legacy: React.ReactElement }) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  if (location.pathname.startsWith('/picklevibes')) {
    return legacy;
  }
  return <Navigate to={`${PICKCOURT_ACCOUNT.orders}/${id}`} replace />;
}
