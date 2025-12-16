import React from 'react';
import { motion } from 'framer-motion';
import SEO from '../components/SEO/SEO';

const Privacy: React.FC = () => {
  return (
    <>
      <SEO
        title="隱私政策 | Picklevibes"
        description="Picklevibes 智能匹克球室個人資料收集聲明與隱私政策。了解我們如何收集、使用和保護您的個人資料。"
        keywords="隱私政策,個人資料保護,資料收集聲明"
        url="/privacy"
        noindex={true}
      />
      <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-green-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
              隱私政策
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Picklevibes 智能匹克球室個人資料收集聲明
            </p>
          </motion.div>
        </div>
      </section>

      {/* Privacy Policy Content */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl shadow-lg p-8 md:p-12"
          >
            <div className="prose prose-lg max-w-none">
              <p className="text-gray-700 leading-relaxed mb-8">
                Picklevibes 智能匹克球室（「本公司」）致力遵守香港特別行政區法例《個人資料（私隱）條例》（第486章）（「該條例」）的規定，以保障本公司所持有的個人資料的私隱性、保密性及安全性。本公司同樣致力於確保我們的所有員工、高級職員和代理人遵守這些義務。本個人資料收集聲明（「本聲明」）旨在通知閣下有關本公司收集、使用、儲存、轉移及披露閣下的個人資料。
              </p>

              {/* 1. 個人資料的目的與收集 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                viewport={{ once: true }}
                className="mb-12"
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-6">1. 個人資料的目的與收集</h2>
                <div className="space-y-4 text-gray-700 leading-relaxed">
                  <p>
                    本公司將在您註冊成為會員時收集您的個人資料。閣下無需提供個人資料；然而，本公司可能無法處理閣下的註冊及向閣下提供服務。
                  </p>
                  <p>
                    本公司可能會收集閣下的全名、性別、出生月份*、流動電話號碼、電郵地址及/或住址，用於以下一個或多個用途：
                  </p>
                  <div className="bg-gray-50 rounded-lg p-6 mt-6">
                    <ul className="space-y-3 list-none">
                      <li className="flex items-start">
                        <span className="font-semibold text-blue-600 mr-3">A.</span>
                        <span>為公司提供的匹克球場地、發球機訓練場地、智能門禁系統和/或相關服務；</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold text-blue-600 mr-3">B.</span>
                        <span>用於通訊、宣傳、客戶關係管理和/或公共關係；</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold text-blue-600 mr-3">C.</span>
                        <span>用於客戶、會員或使用者帳戶和記錄的申請、建立、操作和管理；</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold text-blue-600 mr-3">D.</span>
                        <span>處理意見、查詢和投訴；</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold text-blue-600 mr-3">E.</span>
                        <span>處理或要求開單和支付積分充值，確定未付金額，必要時收取未付款項；</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold text-blue-600 mr-3">F.</span>
                        <span>用於識別和驗證您的身份，特別是透過智能門禁系統進出設施時；和/或</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold text-blue-600 mr-3">G.</span>
                        <span>用於與上述任何目的直接相關之目的。</span>
                      </li>
                    </ul>
                  </div>
                  <p className="text-sm text-gray-600 mt-4">
                    *提供您的出生月份是自願的。本公司僅會使用您的出生月份來提供特別的生日促銷和優惠。
                  </p>
                </div>
              </motion.div>

              {/* 2. 直銷中使用您的個人資料 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="mb-12"
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-6">2. 直銷中使用您的個人資料</h2>
                <div className="space-y-4 text-gray-700 leading-relaxed">
                  <p>
                    本公司明確保留其、其代理人¹、其特許經營者² 和/或其關聯公司，包括其子公司²和其聯營公司³ ("關聯公司")使用您的全名、電話號碼、電郵地址和住宅地址 ("個人資料")，向您發送與本公司、其代理人、其特許經營者和/或其關聯公司可能提供的下列類別商品和服務相關的直接促銷通訊，包括匹克球、運動訓練、運動裝備、健康生活及相關服務 ("直接促銷用途"）。
                  </p>
                  <p>
                    除非本公司在使用您的個人資料之前已獲得您的書面同意 (包括您表示不反對)，否則本公司、其代理人、其特許經營者和/或其關聯公司不得使用您的個人資料。如會員對前述個人資料的使用已表示同意，將有權以書面方式向 <a href="mailto:info@picklevibes.com" className="text-blue-600 hover:text-blue-700">info@picklevibes.com</a> 提交申請選擇退出上述內容。本公司不會對您要求本公司停止使用您的個人資用於直接促銷料的請求收取任何費用。
                  </p>
                  <div className="bg-blue-50 rounded-lg p-6 mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">附注:</h3>
                    <ul className="space-y-2 text-sm text-gray-700">
                      <li>¹ 代理人是指 Picklevibes 聘請的任何通訊、宣傳、客戶關係管理和/或公共關係服務的代理人。</li>
                      <li>² 特許經營者及子公司是指 Picklevibes 品牌的匹克球中心。</li>
                      <li>³ 聯營公司是指 Picklevibes 旗下可能提供的其他運動或健康相關品牌。</li>
                    </ul>
                  </div>
                </div>
              </motion.div>

              {/* 3. 披露 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                viewport={{ once: true }}
                className="mb-12"
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-6">3. 披露</h2>
                <div className="space-y-4 text-gray-700 leading-relaxed">
                  <p>
                    本公司將採取一切可行措施，確保您的個人資料保密。在遵守任何適用法律規定的前提下，您的個人資料可能會出於以下目的提供給以下各方：
                  </p>
                  <div className="bg-gray-50 rounded-lg p-6 mt-6">
                    <ul className="space-y-3 list-none">
                      <li className="flex items-start">
                        <span className="font-semibold text-blue-600 mr-3">A.</span>
                        <span>本公司聘請的任何代理人，負責進行通訊、宣傳、客戶關係管理和/或公共關服務，以及任何發送直接促銷通訊的其特許經營者和關聯公司（包括向會員發送直接促銷通訊，介紹本公司認為會員可能感興趣的任何促銷活動和服務）；</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold text-blue-600 mr-3">B.</span>
                        <span>任何向本公司提供與本公司業務和運營相關服務或技術的承包商或服務提供商，包括行政、電信、數據處理、智能預約系統、支付服務或技術、處理和調查爭議，以及與本公司業務運營相關的其他服務；</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold text-blue-600 mr-3">C.</span>
                        <span>向本公司提供行政（包括會員帳戶和積分記錄的管理）、技術（包括資訊技術和雲端服務）或其他服務（包括律師和審計師等專業顧問）且對本公司負有保密義務的任何代理人、承包商或服務提供商；</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold text-blue-600 mr-3">D.</span>
                        <span>本公司根據任何對本公司具有約束力或適用於本公司的法律要求，或為遵守監管機構或其他機構（包括行業和自我監管機構）發布的任何指南或行為準則而必須向其披露信息的任何人; 及</span>
                      </li>
                      <li className="flex items-start">
                        <span className="font-semibold text-blue-600 mr-3">E.</span>
                        <span>本公司權利或業務的任何實際或擬議受讓人、受讓方、參與方或次級參與方。</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>


              {/* 4. 安全性 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true }}
                className="mb-12"
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-6">4. 安全性</h2>
                <div className="space-y-4 text-gray-700 leading-relaxed">
                  <p>
                    本公司採取適當的安全措施和保障措施，以保護會員的個人資料（包括生物資料）不受意外、非法或未經授權的破壞、遺失、篡改、存取、披露或使用。
                  </p>
                  <p>
                    我們的所有員工、代理人、其特許經營者、關聯公司和供應商均受保密約束。只有獲授權人士可根據該條例和本聲明，在 「有需要知道 」的基礎上處理您的個人資料（包括生物資料）。
                  </p>
                  <div className="bg-green-50 rounded-lg p-6 mt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">個人資訊主體註銷帳戶</h3>
                    <p className="text-gray-700">
                      您隨時可註銷先前註冊的帳戶，您可以透過以下方式自行操作：透過「設定-帳號安全-註銷帳號」進行註銷或聯絡線上客服或撥打客服電話。
                    </p>
                    <p className="text-gray-700 mt-4">
                      在註銷帳戶之後(三個工作天內完成註銷)，我們將停止為您提供產品或服務，並依據您的要求，刪除您的個人信息，法律法規另有規定的除外。
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* 5. 一般事項 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                viewport={{ once: true }}
                className="mb-12"
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-6">5. 一般事項</h2>
                <div className="space-y-4 text-gray-700 leading-relaxed">
                  <p>
                    您可以隨時要求 (i) 查閱或改正您的個人資料；及/或 (ii) 選擇退出直接促銷通訊。為了行使您的權利，並避免潛在的誤傳或誤解，本公司建議您將書面請求寄至 <a href="mailto:info@picklevibes.hk" className="text-blue-600 hover:text-blue-700">info@picklevibes.hk</a>。本公司將在合理可行的情況下盡快滿足您的要求。
                  </p>
                  <p>
                    本公司保留您個人資料的時間，以達成收集資料之目的所需為限。如果您終止會員資格，本公司將在切實可行的範圍內盡快刪除您的個人資料。
                  </p>
                  <p className="font-semibold text-gray-900">
                    中英文版本如有歧異，概以英文版本為準。
                  </p>
                </div>
              </motion.div>

              {/* 6. 免責聲明 */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                viewport={{ once: true }}
                className="mb-12"
              >
                <h2 className="text-3xl font-bold text-gray-900 mb-6">6. 免責聲明</h2>
                <div className="space-y-4 text-gray-700 leading-relaxed">
                  <p>
                    本網頁所包含的所有資訊僅供參考，可能會有所變更。Picklevibes 不保證或聲明此處提供的資訊是準確、完整或最新的，並拒絕承擔因本網頁內容而產生或因依賴本網頁內容而引致的任何損失或損害的責任。
                  </p>
                </div>
              </motion.div>

            </div>
          </motion.div>
        </div>
      </section>
    </div>
    </>
  );
};

export default Privacy;
