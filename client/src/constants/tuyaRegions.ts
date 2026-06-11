export const TUYA_BASE_URL_OPTIONS = [
  { value: 'https://openapi.tuyacn.com', label: '中國 (tuyacn)' },
  { value: 'https://openapi.tuyaus.com', label: '美西 (tuyaus)' },
  { value: 'https://openapi-ueaz.tuyaus.com', label: '美東 (ueaz)' },
  { value: 'https://openapi.tuyaeu.com', label: '歐洲 (tuyaeu)' },
  { value: 'https://openapi-weaz.tuyaeu.com', label: '西歐 (weaz)' },
  { value: 'https://openapi.tuyain.com', label: '印度 (tuyain)' },
  { value: 'https://openapi-sg.iotbing.com', label: '新加坡 (sg) — 香港／東南亞' },
] as const;

export interface TuyaDeviceConfig {
  deviceId: string;
  label: string;
  switchCode: string;
  enabled: boolean;
}

export interface TuyaZoneConfig {
  _id?: string;
  name: string;
  enabled: boolean;
  devices: TuyaDeviceConfig[];
  courtIds: string[];
}

export const emptyTuyaDevice = (): TuyaDeviceConfig => ({
  deviceId: '',
  label: '燈',
  switchCode: 'switch_1',
  enabled: true,
});

export const emptyTuyaZone = (): TuyaZoneConfig => ({
  name: '控制區',
  enabled: true,
  devices: [emptyTuyaDevice()],
  courtIds: [],
});
