const { TuyaContext } = require('@tuya/tuya-connector-nodejs');

// 1. 初始化涂鴉雲端上下文
const tuya = new TuyaContext({
  baseUrl: 'https://openapi.tuyaus.com', // 根據你的 Data Center 選擇：tuyaeu.com(歐洲) / tuyaus.com(美西) / tuyacn.com(中國)
  accessKey: '你的_Access_ID',
  secretKey: '你的_Access_Secret',
});

const DEVICE_ID = '你的_燈制_Device_ID';

// 2. 定義控制燈制開關的函式
async function controlSwitch(turnOn) {
  try {
    // 涂鴉標準指令集通常使用 'switch_1' 或 'switch'，具體可在 API Explorer 中查詢
    const response = await tuya.request({
      method: 'POST',
      path: `/v1.0/devices/${DEVICE_ID}/commands`,
      body: {
        commands: [
          {
            code: 'switch_1', // 如果是單路開關通常是 switch_1，多路開關可能是 switch_2, switch_3...
            value: turnOn // true 代表開，false 代表關
          }
        ]
      }
    });

    if (response.success) {
      console.log(`燈制已成功變更狀態為: ${turnOn ? '開啟' : '關閉'}`);
    } else {
      console.error('控制失敗:', response.msg);
    }
  } catch (error) {
    console.error('發生錯誤:', error);
  }
}

// 範例：觸發開燈
controlSwitch(true);