export type AccessControlVendor = 'hik' | 'dahua';

export const ACCESS_CONTROL_VENDORS: { value: AccessControlVendor; label: string }[] = [
  { value: 'hik', label: '海康 HIK' },
  { value: 'dahua', label: '大華 Dahua' },
];

export const DAHUA_DEFAULT_DEVICE_MODEL = 'DHI-ASI3213A-W';

export function accessControlVendorLabel(
  enabled?: boolean,
  vendor?: string | null
): string {
  if (!enabled) return '僅確認信';
  if (vendor === 'dahua') return '大華';
  return 'HIK';
}
