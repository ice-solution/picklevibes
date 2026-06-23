import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import apiConfig from '../config/api';
import SEO from '../components/SEO/SEO';
import PickleCourtNav from '../components/PickleCourt/PickleCourtNav';
import PickleCourtFooter from '../components/PickleCourt/PickleCourtFooter';
import PickleCourtCourtSearch from '../components/PickleCourt/PickleCourtCourtSearch';
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
  CheckCircleIcon,
  LinkIcon,
  ServerStackIcon,
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
    title: '場地加入聯盟',
    desc: '場館以 SaaS 訂閱方式開通獨立後台，設定場地、價格與營運規則，並選擇是否上架 PickCourt。',
  },
  {
    step: '02',
    title: '球友註冊會籍',
    desc: '用戶在 PickCourt 建立聯盟帳號，享有跨場地預約、活動報名與會員權益。',
  },
  {
    step: '03',
    title: '預約 · 活動 · 比賽',
    desc: '球友透過聯盟平台發現場地並預約；場館在自家後台營運；比賽數據同步至平台。',
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
};

const PickleCourtHome: React.FC = () => {
  const [allianceStores, setAllianceStores] = useState<AllianceStore[]>([]);

  useEffect(() => {
    const base = apiConfig.API_BASE_URL.replace(/\/$/, '');
    fetch(`${base}/platform/alliance/stores`)
      .then((r) => r.json())
      .then((data) => setAllianceStores(data.stores || []))
      .catch(() => setAllianceStores([]));
  }, []);

  return (
  <div id="top" className="min-h-screen bg-white text-pickcourt-navy">
    <SEO
      title="PickCourt | 聯盟式匹克球平台 · Pick Friends"
      description="PickCourt 連結全港匹克球場地與球友。場地以 SaaS 獨立營運，球友以聯盟會籍預約、參與活動與比賽。Pick Friends."
      keywords="PickCourt,匹克球,場地預約,匹克球聯盟,SaaS,智能球場,比賽計分"
      url="/"
    />

    <PickleCourtNav />

    <PickleCourtCourtSearch embedded syncUrl />

    {/* Platform intro */}
    <section id="platform" className="py-20 lg:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-pickcourt-navy">
            一個平台，兩種角色
          </h2>
          <p className="mt-4 text-lg text-slate-600 leading-relaxed">
            PickCourt 採用 <strong className="text-pickcourt-navy">SaaS 多租戶</strong> 架構：
            每個場地獨立營運、獨立資料邊界，同時透過聯盟 API 向 PickCourt 供應預約與查詢服務。
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          <motion.div
            {...fadeUp}
            className="bg-white rounded-2xl p-8 lg:p-10 shadow-lg border border-pickcourt-navy/5 hover:border-pickcourt-gold/30 transition-colors"
          >
            <div className="w-14 h-14 rounded-xl bg-pickcourt-navy flex items-center justify-center mb-6">
              <BuildingStorefrontIcon className="h-8 w-8 text-pickcourt-gold" />
            </div>
            <h3 className="text-2xl font-bold text-pickcourt-navy">場地 · SaaS 訂閱</h3>
            <p className="mt-3 text-slate-600 leading-relaxed">
              每間場館擁有專屬後台、專屬域名與完整營運工具——預約、活動、優惠、設備控制、會計，全部按店獨立管理。
            </p>
            <ul className="mt-6 space-y-3">
              {['獨立店鋪後台與員工權限', '店內活動與優惠自主設定', '聯盟搜尋一鍵曝光'].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircleIcon className="h-5 w-5 text-pickcourt-gold shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ delay: 0.1 }}
            className="bg-pickcourt-navy rounded-2xl p-8 lg:p-10 shadow-lg text-white"
          >
            <div className="w-14 h-14 rounded-xl bg-pickcourt-gold flex items-center justify-center mb-6">
              <UserGroupIcon className="h-8 w-8 text-pickcourt-navy-dark" />
            </div>
            <h3 className="text-2xl font-bold">
              <span className="text-white">Pickle</span>
              <span className="text-pickcourt-gold">Court</span>
              <span className="text-white"> · 聯盟平台</span>
            </h3>
            <p className="mt-3 text-white/75 leading-relaxed">
              球友在 PickCourt 註冊聯盟會籍，跨場地搜尋、預約與參與活動；比賽戰績與排行榜集中呈現。
            </p>
            <ul className="mt-6 space-y-3">
              {['聯盟會籍與積分體系', '跨場地預約與活動報名', '計分系統與賽季排行'].map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-white/85">
                  <CheckCircleIcon className="h-5 w-5 text-pickcourt-gold shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>

    {/* Venue SaaS features */}
    <section id="venues" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-pickcourt-gold font-semibold uppercase tracking-wider text-sm">For Venues</p>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold text-pickcourt-navy">
            場地 SaaS 功能
          </h2>
          <p className="mt-4 text-slate-600">
            基於 PickCourt SaaS 平台，為每個場地提供開箱即用的數位化工具。
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {venueFeatures.map((f, i) => (
            <motion.div
              key={f.title}
              {...fadeUp}
              transition={{ delay: i * 0.05 }}
              className="group p-6 lg:p-8 rounded-2xl border border-slate-200 hover:border-pickcourt-gold/50 hover:shadow-lg transition-all bg-white"
            >
              <div className="w-12 h-12 rounded-lg bg-pickcourt-navy/5 group-hover:bg-pickcourt-gold/20 flex items-center justify-center mb-4 transition-colors">
                <f.icon className="h-6 w-6 text-pickcourt-navy group-hover:text-pickcourt-gold-dark transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-pickcourt-navy">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Player alliance */}
    <section id="players" className="py-20 lg:py-28 bg-pickcourt-navy text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-pickcourt-gold font-semibold uppercase tracking-wider text-sm">For Players</p>
          <h2 className="mt-2 text-3xl lg:text-4xl font-bold">球友聯盟體驗</h2>
          <p className="mt-4 text-white/70">
            一個帳號，連結全港合作場地——預約、活動、比賽，盡在 PickCourt。
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {playerFeatures.map((f, i) => (
            <motion.div
              key={f.title}
              {...fadeUp}
              transition={{ delay: i * 0.08 }}
              className="text-center p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-pickcourt-gold/40 transition-colors"
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-pickcourt-gold/20 flex items-center justify-center mb-4">
                <f.icon className="h-7 w-7 text-pickcourt-gold" />
              </div>
              <h3 className="font-bold text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-white/65 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* Live alliance venues */}
    <section id="venues-list" className="py-16 lg:py-20 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl lg:text-3xl font-bold text-pickcourt-navy">聯盟合作場地</h2>
          <p className="mt-3 text-slate-600">已上架 PickCourt 的場地（即時由平台 API 載入）</p>
        </motion.div>
        {allianceStores.length === 0 ? (
          <p className="text-center text-slate-500 text-sm">
            暫無聯盟場地。請於後台店鋪管理啟用「上架 PickCourt 聯盟」。
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {allianceStores.map((s, i) => (
              <motion.div
                key={s.id}
                {...fadeUp}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-slate-200 p-6 hover:border-pickcourt-gold/50 hover:shadow-md transition-all"
              >
                <h3 className="font-bold text-lg text-pickcourt-navy">{s.name}</h3>
                {s.district && (
                  <p className="text-xs font-medium text-pickcourt-gold-dark mt-1">{s.district}</p>
                )}
                {s.tagline && <p className="text-sm text-pickcourt-gold-dark mt-1">{s.tagline}</p>}
                <p className="text-sm text-slate-600 mt-2">{s.address}</p>
                <p className="text-xs text-slate-400 mt-2">{s.courtCount} 個場地</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to={`/store/${s.slug}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-pickcourt-navy hover:text-pickcourt-gold"
                  >
                    查看場地
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                  <Link
                    to={`/booking/${s.slug}#court`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-pickcourt-gold-dark hover:text-pickcourt-gold"
                  >
                    立即預約
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>

    {/* Architecture */}
    <section className="py-20 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center mb-12">
          <h2 className="text-3xl font-bold text-pickcourt-navy">平台架構</h2>
          <p className="mt-3 text-slate-600">共享技術底座，場地資料獨立，聯盟服務統一對外</p>
        </motion.div>

        <motion.div
          {...fadeUp}
          className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg border border-slate-200 p-8 lg:p-12"
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-full max-w-md text-center py-4 px-6 rounded-xl bg-pickcourt-gold/15 border-2 border-pickcourt-gold">
              <ServerStackIcon className="h-8 w-8 text-pickcourt-gold-dark mx-auto mb-2" />
              <p className="font-bold text-pickcourt-navy">PickCourt 聯盟層</p>
              <p className="text-xs text-slate-500 mt-1">會籍 · 跨場預約 · 比賽聚合</p>
            </div>
            <div className="text-pickcourt-gold text-2xl">↕ 聯盟 API</div>
            <p className="text-sm text-slate-500 mt-2">場地預約、搜尋、計分由 PickCourt 平台統籌（Open API 日後開放）</p>
            <div className="grid sm:grid-cols-3 gap-4 w-full">
              {['場地 A', '場地 B', '場地 C'].map((name) => (
                <div
                  key={name}
                  className="text-center py-4 px-4 rounded-xl bg-pickcourt-navy text-white text-sm font-medium"
                >
                  <BuildingStorefrontIcon className="h-6 w-6 text-pickcourt-gold mx-auto mb-2" />
                  {name}
                  <p className="text-xs text-white/50 mt-1 font-normal">SaaS 獨立營運</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>

    {/* How it works */}
    <section id="how-it-works" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div {...fadeUp} className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-pickcourt-navy">運作方式</h2>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((s, i) => (
            <motion.div key={s.step} {...fadeUp} transition={{ delay: i * 0.1 }} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-pickcourt-gold/30 -translate-x-4 z-0" />
              )}
              <div className="relative z-10">
                <span className="text-5xl font-black text-pickcourt-gold/25">{s.step}</span>
                <h3 className="mt-2 text-xl font-bold text-pickcourt-navy">{s.title}</h3>
                <p className="mt-3 text-slate-600 leading-relaxed">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>

    {/* CTA */}
    <section id="contact" className="py-20 lg:py-24 bg-gradient-to-r from-pickcourt-navy-dark to-pickcourt-navy">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div {...fadeUp}>
          <h2 className="text-3xl lg:text-4xl font-bold text-white">
            加入 PickCourt 聯盟
          </h2>
          <p className="mt-4 text-lg text-white/70">
            場地合作洽詢、聯盟上架或產品演示，歡迎與我們聯絡。
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:info@pickcourt.hk?subject=PickCourt%20場地合作"
              className="inline-flex items-center justify-center gap-2 bg-pickcourt-gold text-pickcourt-navy-dark font-bold px-8 py-4 rounded-xl hover:bg-pickcourt-gold-light transition-colors"
            >
              聯絡我們
            </a>
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-colors"
            >
              球友註冊
            </Link>
          </div>
          <p className="mt-8 text-sm text-white/40">
            現有會員將逐步遷移至 PickCourt 聯盟會籍
          </p>
        </motion.div>
      </div>
    </section>

    <PickleCourtFooter />
  </div>
  );
};

export default PickleCourtHome;
