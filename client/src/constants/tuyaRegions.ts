export const TUYA_BASE_URL_OPTIONS = [
  { value: 'https://openapi.tuyacn.com', label: '中國 (tuyacn)' },
  { value: 'https://openapi.tuyaus.com', label: '美西 (tuyaus)' },
  { value: 'https://openapi.tuyaeu.com', label: '歐洲 (tuyaeu)' },
  { value: 'https://openapi.tuyain.com', label: '印度 (tuyain)' },
] as const;

export interface TuyaDeviceConfig {
  deviceId: string;
  label: string;
  switchCode: string;
  enabled: boolean;
}

export const emptyTuyaDevice = (): TuyaDeviceConfig => ({
  deviceId: '',
  label: '燈',
  switchCode: 'switch_1',
  enabled: true,
});
