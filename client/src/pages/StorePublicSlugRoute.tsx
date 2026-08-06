import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import StorePublic from './StorePublic';
import { isReservedStoreSlug } from '../utils/storeSlugRoutes';

/**
 * 店鋪公開頁：`/:storeSlug`（聯盟主站與自訂 consumer domain）
 */
export default function StorePublicSlugRoute() {
  const { storeSlug = '' } = useParams<{ storeSlug: string }>();
  if (!storeSlug || isReservedStoreSlug(storeSlug)) {
    return <Navigate to="/" replace />;
  }
  return <StorePublic />;
}
