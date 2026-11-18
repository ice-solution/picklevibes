import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiConfig from '../config/api';
import SEO from '../components/SEO/SEO';
import {
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_KEYWORDS,
  DEFAULT_SEO_TITLE,
} from '../constants/platformBrand';
import PickleCourtNav from '../components/PickleCourt/PickleCourtNav';
import PickleCourtFooter from '../components/PickleCourt/PickleCourtFooter';
import PickleCourtCourtSearch from '../components/PickleCourt/PickleCourtCourtSearch';
import PickCourtPremium from '../components/PickleCourt/PickCourtPremium';
import PickCourtAllianceActivities from '../components/PickleCourt/PickCourtAllianceActivities';
import { resolveMediaUrl } from '../utils/storeBrandUtils';
import {
  BuildingStorefrontIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  TicketIcon,
  CpuChipIcon,
  ChartBarIcon,
  GlobeAltIcon,
  TrophyIcon,
  MapPinIcon,
  CreditCardIcon,
  ArrowRightIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
};

const venueFeatures = [
  {
    icon: CalendarDaysIcon,
    title: '場地預約管理',
    desc: '日曆、時段、包場與取消規則，獨立店鋪後台一站式管理。',
  },
  {
    icon: UserGroupIcon,
    title: '活動與課程',
    desc: '恆常活動、教練課堂、報名名額——每個場地自主營運。',
  },
  {
    icon: TicketIcon,
    title: '店內優惠與兌換',
    desc: '充值優惠、兌換碼、會員折扣，按場地靈活設定。',
  },
  {
    icon: CpuChipIcon,
    title: '智能場地控制',
    desc: '燈光、設備自動化排程，預約聯動開關，減少人手。',
  },
  {
    icon: ChartBarIcon,
    title: '會計與報表',
    desc: '收入認列、店鋪級財務報表，加盟財務清晰透明。',
  },
  {
    icon: LinkIcon,
    title: '聯盟平台上架',
    desc: '加盟 PickCourt 後，場地自動出現在聯盟搜尋與預約平台。',
  },
];

const playerFeatures = [
  {
    icon: GlobeAltIcon,
    title: '一帳號走遍聯盟',
    desc: 'PickCourt 會籍跨場地使用，搜尋、預約、參與活動。',
  },
  {
    icon: MapPinIcon,
    title: '聯盟場地搜尋',
    desc: '地圖與列表瀏覽合作場地，即時查看可預約時段。',
  },
  {
    icon: CreditCardIcon,
    title: '聯盟積分與會籍',
    desc: '統一會員體系，積分充值與 VIP 權益由平台統籌。',
  },
  {
    icon: TrophyIcon,
    title: '比賽計分與排行榜',
    desc: '場內計分系統接入，戰績、賽季排行一站查閱。',
  },
];

const steps = [
  {
    step: '01',
    title: '搵場或揀店',
    desc: '用首頁快捷搜跨店搵空缺，或者去「訂場」揀熟店睇全日格。',
  },
  {
    step: '02',
    title: '揀時段',
    desc: '確認日期、1／2 小時同價錢；未登入都可以先睇位。',
  },
  {
    step: '03',
    title: '登入付款',
    desc: '鎖定時段後先登入／註冊，完成付款即訂場成功。',
  },
];

type AllianceStore = {
  id: string;
  name: string;
  slug: string;
  address: string;
  district?: string | null;
  courtCount: number;
  tagline?: string | null;
  logoUrl?: string | null;
};

const PickleCourtHome: React.FC = () => {
  const [allianceStores, setAllianceStores] = useState<AllianceStore[]>([]);
  const [allianceLoading, setAllianceLoading] = useState(true);
  const [allianceError, setAllianceError] = useState('');

  useEffect(() => {
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    setAllianceLoading(true);
    setAllianceError('');
    fetch(`${base}/platform/alliance/stores`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || '載入場地失敗');
        setAllianceStores(data.stores || []);
      })
      .catch((e) => {
        setAllianceStores([]);
        setAllianceError(e instanceof Error ? e.message : '載入場地失敗');
      })
      .finally(() => setAllianceLoading(false));
  }, []);

  return (
  <div id="top" className="min-h-screen bg-white text-pickcourt-navy pb-24 lg:pb-0">
    <SEO
      title={DEFAULT_SEO_TITLE}
      description={DEFAULT_SEO_DESCRIPTION}
      keywords={DEFAULT_SEO_KEYWORDS}
      url="/"
    />

    <PickleCourtNav />

    <PickleCourtCourtSearch embedded syncUrl />

    <PickCourtPremium />

    {/* 聯盟合作場地 */}
    <section id="alliance" className="py-12 lg:py-16 bg-white border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl lg:text-3xl font-bold text-pickcourt-navy">聯盟合作場地</h2>
          <p className="mt-2 text-sm text-slate-500">
            識店直接訂；唔識店用上面搜尋。亦可{' '}
            <Link to="/book" className="text-pickcourt-navy font-semibold underline">
              打開訂場全日格
            </Link>
          </p>
        </motion.div>
        {allianceLoading && (
          <p className="text-center text-slate-500 text-sm py-8">搵緊聯盟場地…</p>
        )}
        {allianceError && !allianceLoading && (
          <div className="text-center text-sm text-red-700 py-6">
            {allianceError}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => window.location.reload()}
            >
              再試
            </button>
          </div>
        )}
        {!allianceLoading && !allianceError && allianceStores.length === 0 ? (
          <p className="text-center text-slate-500 text-sm">
            暫時未有上架場地，請稍後再睇，或者先用上面搜尋試下。
          </p>
        ) : null}
        {!allianceLoading && allianceStores.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allianceStores.map((s, i) => {
              const logoSrc = resolveMediaUrl(s.logoUrl);
              return (
              <motion.div
                key={s.id}
                {...fadeUp}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-slate-200 overflow-hidden hover:border-pickcourt-gold/50 hover:shadow-md transition-all flex flex-col bg-white"
              >
                <div className="flex items-center justify-center min-h-[148px] px-6 py-8 bg-slate-50 border-b border-slate-100">
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={s.name}
                      className="max-h-24 max-w-[85%] w-auto object-contain"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-pickcourt-navy/5 border border-slate-200 flex items-center justify-center">
                      <BuildingStorefrontIcon className="h-10 w-10 text-pickcourt-navy/40" />
                    </div>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-1 text-center">
                <h3 className="font-bold text-lg text-pickcourt-navy">{s.name}</h3>
                {s.district && (
                  <p className="text-xs font-medium text-pickcourt-gold-dark mt-1">{s.district}</p>
                )}
                {s.tagline && <p className="text-sm text-pickcourt-gold-dark mt-1">{s.tagline}</p>}
                <p className="text-sm text-slate-600 mt-2">{s.address}</p>
                <p className="text-xs text-slate-400 mt-2">{s.courtCount} 個場地</p>
                <div className="mt-4 flex flex-col gap-2 items-stretch">
                  <Link
                    to={`/book?store=${encodeURIComponent(s.slug)}`}
                    className="inline-flex items-center justify-center gap-1 text-sm font-bold bg-pickcourt-navy text-white rounded-xl py-2.5 hover:opacity-90"
                  >
                    立即預約
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/${s.slug}`}
                    className="inline-flex items-center justify-center gap-1 text-sm font-medium text-pickcourt-navy/70 hover:text-pickcourt-gold"
                  >
                    場地詳情
                  </Link>
                </div>
                </div>
              </motion.div>
            );
            })}
          </div>
        ) : null}
      </div>
    </section>

    <PickCourtAllianceActivities />

    {/* 比賽功能暫時收起 */}
    {/* <PickCourtAllianceTournaments /> */}

    {/* 球友向簡介（保留）；B2B／SaaS 詳情收至頁尾 contact 前 */}
    <section id="players" className="py-16 lg:py-20 bg-pickcourt-navy text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl lg:text-3xl font-bold">一個帳號，全港聯盟場</h2>
          <p className="mt-3 text-white/70 text-sm sm:text-base">
            搜尋、訂場、活動同兌換券都喺 PickCourt；付款前先登入就得。
          </p>
        </motion.div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {playerFeatures.map((f, i) => (
            <motion.div
              key={f.title}
              {...fadeUp}
              transition={{ delay: i * 0.05 }}
              className="text-center p-5 rounded-2xl bg-white/5 border border-white/10"
            >
              <f.icon className="h-7 w-7 text-pickcourt-gold mx-auto mb-3" />
              <h3 className="font-bold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-white/65 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* How it works — 球友三步 */}
    <section id="how-it-works" className="py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center mb-10">
          <h2 className="text-2xl lg:text-3xl font-bold text-pickcourt-navy">點樣訂場</h2>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((s, i) => (
            <motion.div key={s.step} {...fadeUp} transition={{ delay: i * 0.1 }} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-pickcourt-gold/30 -translate-x-4 z-0" />
              )}
              <div className="relative z-10">
                <p className="text-xs font-semibold text-pickcourt-gold-dark">{s.step}</p>
                <h3 className="mt-1 text-lg font-bold text-pickcourt-navy">{s.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    <details id="platform" className="group border-y border-slate-200 bg-slate-50">
      <summary className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 cursor-pointer list-none flex items-center justify-between gap-3 text-sm text-slate-500 hover:text-pickcourt-navy">
        <span>場館 SaaS／平台介紹（球友可略過）</span>
        <span className="text-xs group-open:hidden">展開</span>
        <span className="text-xs hidden group-open:inline">收起</span>
      </summary>
      <div id="venues" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 space-y-2">
        <p className="text-sm text-slate-600 leading-relaxed">
          每間場館可獨立後台營運，並選擇上架 PickCourt 聯盟。以下功能可逐項展開。
        </p>
        {venueFeatures.map((f) => (
          <details key={f.title} className="rounded-lg border border-slate-200 bg-white group/item">
            <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-pickcourt-navy flex items-center gap-2">
              <f.icon className="h-4 w-4 text-pickcourt-gold shrink-0" />
              <span className="flex-1">{f.title}</span>
              <span className="text-xs text-slate-400 group-open/item:hidden">＋</span>
              <span className="text-xs text-slate-400 hidden group-open/item:inline">−</span>
            </summary>
            <p className="px-3 pb-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-2">
              {f.desc}
            </p>
          </details>
        ))}
      </div>
    </details>

    {/* CTA — 場地合作次級 */}
    <section id="contact" className="py-12 lg:py-16 bg-slate-100 border-t border-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div {...fadeUp}>
          <h2 className="text-xl font-bold text-pickcourt-navy">場地合作</h2>
          <p className="mt-2 text-sm text-slate-600">
            場館上架、產品演示：電郵聯絡即可。球友直接用上方搜尋或訂場。
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:info@pickcourt.hk?subject=PickCourt%20場地合作"
              className="inline-flex items-center justify-center gap-2 border border-pickcourt-navy/30 text-pickcourt-navy font-semibold px-6 py-2.5 rounded-xl hover:bg-white transition-colors text-sm"
            >
              電郵洽詢
            </a>
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-pickcourt-navy text-white font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-colors text-sm"
            >
              球友註冊
            </Link>
          </div>
        </motion.div>
      </div>
    </section>

    <PickleCourtFooter />
  </div>
  );
};

export default PickleCourtHome;
