import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useBooking } from '../contexts/BookingContext';
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
  );
};

export default Home;
