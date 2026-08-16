import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SEO from '../components/SEO/SEO';
import {
  GiftIcon,
  HomeModernIcon,
  AcademicCapIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';

type Tier = {
  id: string;
  code: string;
  nameZh: string;
  nameEn: string;
  join: string;
  credits: string;
  bonus: string;
  perks: string;
  accent: string;
  glow: string;
  badge: string;
};

const TIERS: Tier[] = [
  {
    id: 'silver',
    code: 'S',
    nameZh: 'SILVER 銀級',
    nameEn: 'VIBE STARTER',
    join: '入會 $15,000　JOIN AT $15,000',
    credits: '獲 $18,000 積分　RECEIVE $18,000 CREDITS',
    bonus: '+$3,000 贈送積分 · 20%　+$3,000 BONUS · 20%',
    perks: '12 個月 · 場租 9.5 折 · 提前 21 日預訂　|　12 MONTHS · 5% OFF COURTS · BOOK 21 DAYS AHEAD',
    accent: '#ff4fd8',
    glow: 'rgba(255,79,216,0.45)',
    badge: 'from-pink-300 to-fuchsia-500',
  },
  {
    id: 'gold',
    code: 'G',
    nameZh: 'GOLD 金級',
    nameEn: 'VIBE PRO',
    join: '入會 $30,000　JOIN AT $30,000',
    credits: '獲 $38,000 積分　RECEIVE $38,000 CREDITS',
    bonus: '+$8,000 贈送積分 · 27%　+$8,000 BONUS · 27%',
    perks:
      '18 個月 · 場租 9 折 · 提前 28 日預訂 · 可綁定 1 位親友　|　18 MONTHS · 10% OFF COURTS · BOOK 28 DAYS AHEAD · 1 FRIEND LINK',
    accent: '#f5c542',
    glow: 'rgba(245,197,66,0.4)',
    badge: 'from-amber-300 to-yellow-500',
  },
  {
    id: 'platinum',
    code: 'P',
    nameZh: 'PLATINUM 白金級',
    nameEn: 'VIBE ELITE',
    join: '入會 $50,000　JOIN AT $50,000',
    credits: '獲 $66,666 積分　RECEIVE $66,666 CREDITS',
    bonus: '+$16,666 贈送積分 · 33%　+$16,666 BONUS · 33%',
    perks:
      '36 個月 · 場租 8.5 折 · 提前 60 日預訂 · 可綁定 3 位親友　|　36 MONTHS · 15% OFF COURTS · BOOK 60 DAYS AHEAD · 3 FRIEND LINKS',
    accent: '#2de2e6',
    glow: 'rgba(45,226,230,0.4)',
    badge: 'from-cyan-300 to-teal-400',
  },
];

const EXCLUSIVE = [
  { icon: GiftIcon, zh: '迎新禮品', en: 'WELCOME GIFTS' },
  { icon: HomeModernIcon, zh: 'VIP 房優惠', en: 'VIP ROOM' },
  { icon: AcademicCapIcon, zh: '教練優惠', en: 'COACHING' },
  { icon: TrophyIcon, zh: '比賽優先報名', en: 'TOURNAMENT PRIORITY' },
];

const Vips: React.FC = () => {
  return (
    <>
      <SEO
        title="VIP 會員獎賞 | PickleVibes"
        description="PickleVibes VIP 會員：儲值即享積分贈賞、場租折扣與優先預訂禮遇。"
        keywords="VIP會員,銀級,金級,白金,PickleVibes"
      />
      <div className="min-h-screen text-white relative overflow-hidden bg-[#05070f]">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage: `
              radial-gradient(ellipse at 15% 10%, rgba(236,72,153,0.22), transparent 42%),
              radial-gradient(ellipse at 85% 5%, rgba(20,184,166,0.2), transparent 40%),
              radial-gradient(ellipse at 50% 100%, rgba(245,158,11,0.12), transparent 45%),
              linear-gradient(180deg, #070b16 0%, #05070f 55%, #0a0612 100%)
            `,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(45,226,230,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,79,216,0.12) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          }}
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <motion.header
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="text-center mb-10 sm:mb-12"
          >
            <p
              className="text-3xl sm:text-4xl font-black tracking-[0.25em] mb-5"
              style={{
                color: '#5cf0f2',
                textShadow: '0 0 18px rgba(45,226,230,0.65), 0 0 40px rgba(45,226,230,0.25)',
              }}
            >
              VIBES
            </p>
            <div
              className="inline-block px-5 py-2 mb-6 border rounded-md text-sm sm:text-base font-semibold tracking-wide"
              style={{
                borderColor: '#ff4fd8',
                color: '#ff9ae6',
                boxShadow: '0 0 18px rgba(255,79,216,0.35), inset 0 0 12px rgba(255,79,216,0.12)',
              }}
            >
              隆重發佈　/　GRAND OPENING EXCLUSIVE
            </div>
            <h1
              className="text-4xl sm:text-6xl font-black tracking-tight mb-3"
              style={{
                color: '#ff5bd8',
                textShadow: '0 0 22px rgba(255,79,216,0.55), 0 0 48px rgba(255,79,216,0.25)',
              }}
            >
              VIP 會員獎賞
            </h1>
            <p
              className="text-sm sm:text-base font-semibold tracking-[0.18em] mb-4"
              style={{ color: '#5cf0f2' }}
            >
              VIP MEMBERSHIP REWARDS
            </p>
            <p
              className="text-base sm:text-lg max-w-2xl mx-auto"
              style={{
                color: '#f5c542',
                textShadow: '0 0 12px rgba(245,197,66,0.25)',
              }}
            >
              儲值即享積分贈賞、場租折扣與優先預訂禮遇
            </p>
          </motion.header>

          <div className="space-y-5">
            {TIERS.map((tier, index) => (
              <motion.article
                key={tier.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + index * 0.08, duration: 0.45 }}
                className="rounded-xl border bg-black/35 backdrop-blur-sm px-4 py-5 sm:px-6 sm:py-6"
                style={{
                  borderColor: tier.accent,
                  boxShadow: `0 0 24px ${tier.glow}, inset 0 0 20px rgba(255,255,255,0.02)`,
                }}
              >
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 sm:items-center">
                  <div
                    className={`shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br ${tier.badge} flex items-center justify-center shadow-lg`}
                    style={{ boxShadow: `0 0 20px ${tier.glow}` }}
                  >
                    <span className="text-2xl font-black text-black/80">{tier.code}</span>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h2 className="text-xl sm:text-2xl font-bold" style={{ color: tier.accent }}>
                        {tier.nameZh}
                      </h2>
                      <span className="text-sm tracking-[0.14em] text-white/70">{tier.nameEn}</span>
                    </div>
                    <p className="text-sm sm:text-base text-white/90">{tier.join}</p>
                    <p className="text-sm sm:text-base font-semibold text-white">{tier.credits}</p>
                    <p className="text-sm" style={{ color: tier.accent }}>
                      {tier.bonus}
                    </p>
                    <p className="text-xs sm:text-sm text-white/65 leading-relaxed pt-1">
                      {tier.perks}
                    </p>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 rounded-xl border px-4 py-6 sm:px-6"
            style={{
              borderColor: '#ff4fd8',
              boxShadow: '0 0 24px rgba(255,79,216,0.25)',
              background: 'rgba(12,8,20,0.65)',
            }}
          >
            <h3
              className="text-center text-lg font-bold mb-5 tracking-wide"
              style={{ color: '#ff9ae6' }}
            >
              專屬禮遇：　EXCLUSIVE PERKS
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {EXCLUSIVE.map((item) => (
                <div key={item.en} className="text-center space-y-2">
                  <div
                    className="mx-auto w-12 h-12 rounded-full border flex items-center justify-center"
                    style={{
                      borderColor: '#5cf0f2',
                      boxShadow: '0 0 14px rgba(45,226,230,0.35)',
                    }}
                  >
                    <item.icon className="w-6 h-6" style={{ color: '#5cf0f2' }} />
                  </div>
                  <p className="text-sm font-semibold text-white">{item.zh}</p>
                  <p className="text-[11px] tracking-wider text-white/55">{item.en}</p>
                </div>
              ))}
            </div>
          </motion.section>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link
              to="/recharge"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-bold text-black transition-transform hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #ff4fd8, #f5c542)',
                boxShadow: '0 0 24px rgba(255,79,216,0.35)',
              }}
            >
              立即儲值／了解入會
            </Link>
            <Link
              to="/booking"
              className="inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold border transition-colors hover:bg-white/5"
              style={{ borderColor: '#5cf0f2', color: '#5cf0f2' }}
            >
              前往預約場地
            </Link>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default Vips;
