import React from 'react';
import { motion } from 'framer-motion';
import { DocumentTextIcon, ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const Terms: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 頁面標題 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center mb-4">
            <DocumentTextIcon className="w-12 h-12 text-primary-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">服務使用條款</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            請仔細閱讀以下條款，使用我們的服務即表示您同意遵守這些條款
          </p>
          <div className="mt-4 text-sm text-gray-500">
            最後更新：2024年1月
          </div>
        </motion.div>

        {/* 條款內容 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-lg shadow-lg p-8"
        >
          {/* 1. 接受條款 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">1</span>
              接受條款
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">1.1 協議範圍</h3>
                <p className="text-gray-700 leading-relaxed">
                  本《服務使用條款》（下稱「本條款」）構成您（下稱「會員」或「用戶」）與 Picklevibes 智能匹克球室（下稱「本公司」）之間具有法律約束力的協議。本條款適用於您使用本公司提供的所有服務，包括但不限於場地租賃、發球機設施、線上預約系統、會員積分系統及所有相關設施（下稱「本服務」）。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">1.2 接受</h3>
                <p className="text-gray-700 leading-relaxed">
                  透過註冊成為本公司會員、充值積分或使用本服務，即表示您已閱讀、理解並同意遵守本條款的所有內容。如果您不同意本條款的任何部分，請勿使用本服務。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">1.3 修訂</h3>
                <p className="text-gray-700 leading-relaxed">
                  本公司保留隨時修訂、更改或更新本條款的權利。所有修訂將在本公司網站或應用程式上公佈後立即生效。您在修訂發布後繼續使用本服務，即視為接受修訂後的條款。
                </p>
              </div>
            </div>
          </section>

          {/* 2. 會員資格與帳戶安全 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">2</span>
              會員資格與帳戶安全
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">2.1 會員註冊</h3>
                <p className="text-gray-700 leading-relaxed">
                  使用本服務必須註冊成為會員。您必須提供真實、準確、完整和最新的個人資料。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">2.2 帳戶責任</h3>
                <p className="text-gray-700 leading-relaxed">
                  您須對您的會員帳戶及其密碼的保密性負全部責任，並對透過您的帳戶進行的所有活動負全部責任。如發現任何未經授權使用您的帳戶，您必須立即通知本公司。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">2.3 年齡限制</h3>
                <p className="text-gray-700 leading-relaxed">
                  未滿 18 歲的人士必須在父母或法定監護人的監督和同意下，方可註冊和使用本服務。
                </p>
              </div>
            </div>
          </section>

          {/* 3. 預約、積分與收費 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">3</span>
              預約、積分與收費
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">3.1 積分制</h3>
                <p className="text-gray-700 leading-relaxed">
                  本服務採用積分制收費。會員必須先充值購買積分，方可用於預約場地及發球機設施。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">3.2 積分充值</h3>
                <p className="text-gray-700 leading-relaxed">
                  積分充值一經完成，即視為最終交易。所有已充值或已購買的積分，在任何情況下均不可退回現金。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">3.3 預約與扣除</h3>
                <p className="text-gray-700 leading-relaxed">
                  預約場地或設施時，系統將即時從您的會員帳戶中扣除相應積分。不同時段、不同設施（例如：標準場地或發球機練習區）所需的積分可能不同，請以預約系統顯示為準。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">3.4 優惠代碼</h3>
                <p className="text-gray-700 leading-relaxed">
                  本公司會不定期發放優惠代碼。優惠代碼的使用受限於其特定的條款和條件，且不可兌換現金。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">3.5 取消政策</h3>
                <div className="space-y-2">
                  <p className="text-gray-700 leading-relaxed">
                    a. 會員必須在預約時段開始前的指定時間（例如：24小時）內取消預約，被扣除的積分方可退還至會員帳戶。
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    b. 超過指定時間取消或未出席（No Show），該次預約所扣除的積分將不予退還。
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    c. 本公司保留因不可抗力因素（如惡劣天氣、設備故障）取消預約的權利。在此情況下，會員將獲全額積分退還。
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* 4. 場地使用與行為規範 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">4</span>
              場地使用與行為規範
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">4.1 自助服務</h3>
                <p className="text-gray-700 leading-relaxed">
                  本公司提供 24 小時智能自助服務。會員需自行負責進場、使用設施和離場的流程。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">4.2 進場與離場</h3>
                <p className="text-gray-700 leading-relaxed">
                  會員必須在預約時段開始後方可使用智能門禁進入場地，並必須在預約時段結束前準時離場。超時使用將可能導致額外收費或暫停會員資格。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">4.3 設施維護</h3>
                <p className="text-gray-700 leading-relaxed">
                  會員有責任愛護場地及設施，包括匹克球場地、球網、發球機及休息區。如因會員行為造成設施損壞，本公司保留向該會員追討全部維修或更換費用的權利。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">4.4 發球機使用</h3>
                <p className="text-gray-700 leading-relaxed">
                  使用發球機設施前，會員必須仔細閱讀並遵守所有操作指示和安全規定。因不當操作發球機而導致的任何傷害或設備損壞，會員須自行承擔責任。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">4.5 行為準則</h3>
                <div className="space-y-2">
                  <p className="text-gray-700 leading-relaxed">
                    a. 會員在使用場地時，應保持禮貌，尊重其他使用者。
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    b. 嚴禁在場地內吸煙、飲酒、使用違禁藥物或進行任何非法活動。
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    c. 嚴禁攜帶寵物（導盲犬除外）或危險物品進入場地。
                  </p>
                  <p className="text-gray-700 leading-relaxed">
                    d. 會員須保持場地清潔，並將垃圾帶走或丟棄至指定垃圾桶。
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">4.6 監控</h3>
                <p className="text-gray-700 leading-relaxed">
                  為了安全和管理目的，所有場地均設有閉路電視監控系統。會員同意本公司在遵守私隱政策的前提下，收集和使用相關錄像。
                </p>
              </div>
            </div>
          </section>

          {/* 5. 免責聲明與責任限制 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">5</span>
              免責聲明與責任限制
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">5.1 運動風險</h3>
                <p className="text-gray-700 leading-relaxed">
                  匹克球運動存在固有風險。會員承認並承擔在使用本服務期間可能發生的所有風險，包括但不限於受傷、財產損失或死亡。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">5.2 財物安全</h3>
                <p className="text-gray-700 leading-relaxed">
                  本公司對會員在場地內遺失、被盜或損壞的個人財物不承擔任何責任。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">5.3 設備故障</h3>
                <p className="text-gray-700 leading-relaxed">
                  儘管本公司會定期維護設施，但若發生設備（包括發球機、空調、照明等）臨時故障，本公司將盡快處理，但不對因此造成的任何時間損失、預約取消或間接損失承擔責任。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">5.4 責任限制</h3>
                <p className="text-gray-700 leading-relaxed">
                  在法律允許的最大範圍內，本公司對會員因使用或無法使用本服務而產生的任何直接、間接、附帶、特殊或懲罰性損害概不負責，即使本公司已被告知此類損害的可能性。
                </p>
              </div>
            </div>
          </section>

          {/* 6. 會員資格終止 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">6</span>
              會員資格終止
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">6.1 本公司權利</h3>
                <p className="text-gray-700 leading-relaxed mb-2">
                  本公司保留在以下情況下，立即暫停或終止任何會員的服務使用權利和會員資格的權利，且無需退還任何已充值積分：
                </p>
                <div className="space-y-1 ml-4">
                  <p className="text-gray-700 leading-relaxed">a. 違反本條款的任何規定。</p>
                  <p className="text-gray-700 leading-relaxed">b. 進行任何非法、欺詐或濫用本服務的行為。</p>
                  <p className="text-gray-700 leading-relaxed">c. 嚴重破壞場地設施或影響其他會員的正常使用。</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">6.2 會員註銷</h3>
                <p className="text-gray-700 leading-relaxed">
                  會員可隨時透過本公司指定的程序申請註銷帳戶。帳戶註銷後，所有剩餘積分將被作廢，且不可退回現金。
                </p>
              </div>
            </div>
          </section>

          {/* 7. 準據法與爭議解決 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">7</span>
              準據法與爭議解決
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">7.1 準據法</h3>
                <p className="text-gray-700 leading-relaxed">
                  本條款受香港特別行政區法律管轄並依其解釋。
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">7.2 爭議解決</h3>
                <p className="text-gray-700 leading-relaxed">
                  任何因本條款引起或與本條款有關的爭議、索賠或分歧，雙方應首先尋求友好協商解決。若協商不成，雙方同意將爭議提交香港法院進行專屬管轄。
                </p>
              </div>
            </div>
          </section>

          {/* 8. 一般條款 */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
              <span className="bg-primary-100 text-primary-600 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">8</span>
              一般條款
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">8.1 完整協議</h3>
                <p className="text-gray-700 leading-relaxed">
                  本條款（連同私隱政策和任何相關的服務規則或指南）構成您與本公司之間關於使用本服務的完整協議。
                </p>
              </div>
            </div>
          </section>

          {/* 聯繫信息 */}
          <div className="border-t border-gray-200 pt-8 mt-8">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <ShieldCheckIcon className="w-6 h-6 text-primary-600 mr-2" />
                聯繫我們
              </h3>
              <p className="text-gray-700 mb-4">
                如果您對本使用條款有任何疑問，請聯繫我們：
              </p>
              <div className="space-y-2 text-sm text-gray-600">
                <p>📧 電子郵件：info@picklevibes.hk</p>
                <p>📞 電話：+852 5600 4956</p>
                <p>📍 地址：荔枝角永康街37至39號福源廣場8樓B-D室</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 重要提醒 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6"
        >
          <div className="flex items-start">
            <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 mr-3 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">重要提醒</h3>
              <p className="text-yellow-700">
                請仔細閱讀以上條款。使用我們的服務即表示您已理解並同意遵守所有條款和條件。如有任何疑問，請在註冊前聯繫我們。
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Terms;
