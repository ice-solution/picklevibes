import React from 'react';
import { Link } from 'react-router-dom';
import { 
  PhoneIcon, 
  EnvelopeIcon, 
  MapPinIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

// 自定義社交媒體圖標
const FacebookIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
    <path d="m16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
  </svg>
);

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    company: [
      { name: '關於我們', href: '/about' },
      { name: '設施', href: '/facilities' },
      { name: '價格', href: '/pricing' },
      { name: '預約', href: '/booking' },
    ],
    support: [
      // { name: '幫助中心', href: '/help' },
      { name: '常見問題', href: '/faq' },
      // { name: '聯繫我們', href: '/contact' },
      { name: '隱私政策', href: '/privacy' },
    ],
    legal: [
      { name: '服務條款', href: '/terms' }
      // { name: '退款政策', href: '/refund' },
      // { name: '會員條款', href: '/membership' },
    ]
  };

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* 公司信息 */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center space-x-2 mb-6">
              <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">P</span>
              </div>
              <span className="text-2xl font-bold">PickleVibes</span>
            </Link>
            
            <p className="text-gray-300 mb-6 leading-relaxed">
              您的終極匹克球目的地在香港。我們不僅僅是一個匹克球場地，我們是一個通過積極生活方式和共同體驗團結人們的社區。
            </p>

            {/* 社交媒體 */}
            <div className="flex space-x-4">
              <a
                href="https://facebook.com/picklevibes.hk"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors duration-200 hover:scale-110 transform"
              >
                <FacebookIcon className="w-5 h-5" />
              </a>
              <a
                href="https://instagram.com/picklevibes.hk"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 hover:bg-gradient-to-r hover:from-purple-500 hover:to-pink-500 rounded-full flex items-center justify-center transition-colors duration-200 hover:scale-110 transform"
              >
                <InstagramIcon className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* 公司鏈接 */}
          <div>
            <h3 className="text-lg font-semibold mb-6">公司</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-gray-300 hover:text-white transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 支持鏈接 */}
          <div>
            <h3 className="text-lg font-semibold mb-6">支持</h3>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-gray-300 hover:text-white transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 聯繫信息 */}
          <div>
            <h3 className="text-lg font-semibold mb-6">聯繫我們</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <PhoneIcon className="w-5 h-5 text-primary-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-gray-300">+852 6190 2761</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <EnvelopeIcon className="w-5 h-5 text-primary-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-gray-300">info@picklevibes.hk</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <MapPinIcon className="w-5 h-5 text-primary-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-gray-300 text-sm">
                    荔枝角永康街37至39號福源廣場8樓B-D室
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <ClockIcon className="w-5 h-5 text-primary-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-gray-300">24小時營業</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部版權信息 */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              © {currentYear} PickleVibes hk 版權所有。
            </div>
            
            <div className="flex space-x-6 text-sm">
              {footerLinks.legal.map((link) => (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-gray-400 hover:text-white transition-colors duration-200"
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
