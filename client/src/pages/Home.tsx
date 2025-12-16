import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useBooking } from '../contexts/BookingContext';
import SEO from '../components/SEO/SEO';
import Hero from '../components/Home/Hero';
import Features from '../components/Home/Features';
import Courts from '../components/Home/Courts';
import About from '../components/Home/About';
// import Testimonials from '../components/Home/Testimonials';
import CTA from '../components/Home/CTA';

const Home: React.FC = () => {
  const { fetchCourts } = useBooking();
  const { t } = useTranslation();

  useEffect(() => {
    fetchCourts();
  }, []); // 移除 fetchCourts 依賴，只在組件掛載時調用一次

  return (
    <>
      <SEO
        title="Picklevibes | 香港智能匹克球室租場 | 24小時無人自助預約"
        description="Picklevibes 是香港最受歡迎的智能無人匹克球室。提供24小時網上自助租場服務，致力於提升您的球技與社交體驗。立即預約，輕鬆享受匹克球樂趣！"
        keywords="匹克球,香港匹克球,匹克球場地,匹克球租場,智能匹克球室,無人匹克球室,24小時匹克球,荔枝角匹克球,匹克球預約,匹克球場地租用"
        url="/"
      />
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Hero />
      <Features />
      <Courts />
      <About />
      {/* <Testimonials /> */}
      <CTA />
    </motion.div>
    </>
  );
};

export default Home;
