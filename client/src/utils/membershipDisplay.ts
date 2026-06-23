export type PlatformMembershipInfo = {
  tier?: string;
  expiry?: string | null;
  isVipActive?: boolean;
  source?: string;
};

export function getMembershipTierLabel(
  tier?: string,
  isVipActive?: boolean
): string {
  if (tier === 'vip') {
    return isVipActive !== false ? 'VIP 會員' : 'VIP（已過期）';
  }
  if (tier === 'premium') return '高級會員';
  return '基本會員';
}

export function formatMembershipExpiry(expiry?: string | null): string {
  if (!expiry) return '—';
  const date = new Date(expiry);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('zh-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getMembershipBadgeClass(
  tier?: string,
  isVipActive?: boolean
): string {
  if (tier === 'vip' && isVipActive !== false) {
    return 'bg-amber-100 text-amber-900 ring-1 ring-amber-200';
  }
  if (tier === 'premium') {
    return 'bg-purple-100 text-purple-800 ring-1 ring-purple-200';
  }
  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
}

export function getMembershipSourceLabel(source?: string): string | null {
  if (!source || source === 'pickcourt') return null;
  if (source === 'legacy_picklevibes') return 'Picklevibes 舊會籍';
  return source;
}

export function resolveDisplayMembership(user?: {
  platformMembership?: PlatformMembershipInfo;
  membershipLevel?: string;
  membershipExpiry?: string | null;
} | null): PlatformMembershipInfo {
  const pm = user?.platformMembership;
  const tier = pm?.tier ?? user?.membershipLevel ?? 'basic';
  const expiry = pm?.expiry ?? user?.membershipExpiry ?? null;
  const isVipActive =
    pm?.isVipActive ??
    (tier === 'vip' ? !expiry || new Date(expiry) > new Date() : false);
  return {
    tier,
    expiry,
    isVipActive,
    source: pm?.source,
  };
}
