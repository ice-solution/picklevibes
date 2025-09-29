import React from 'react';
import { Link } from 'react-router-dom';
import { 
  PhoneIcon, 
  EnvelopeIcon, 
  MapPinIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

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
      { name: '幫助中心', href: '/help' },
      { name: '常見問題', href: '/faq' },
      { name: '聯繫我們', href: '/contact' },
      { name: '隱私政策', href: '/privacy' },
    ],
    legal: [
      { name: '服務條款', href: '/terms' },
      { name: '退款政策', href: '/refund' },
      { name: '會員條款', href: '/membership' },
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
                href="https://facebook.com/picklevibes"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 hover:bg-primary-600 rounded-full flex items-center justify-center transition-colors duration-200"
              >
                <span className="text-sm font-bold">f</span>
              </a>
              <a
                href="https://instagram.com/picklevibes"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-gray-800 hover:bg-primary-600 rounded-full flex items-center justify-center transition-colors duration-200"
              >
                <span className="text-sm">📷</span>
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
                  <p className="text-gray-300">+852 6368 1655</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <EnvelopeIcon className="w-5 h-5 text-primary-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-gray-300">info@picklevibes.com</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <MapPinIcon className="w-5 h-5 text-primary-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-gray-300 text-sm">
                    Shop 338, 3/F, Hopewell Mall,<br />
                    15 Kennedy Road, Hong Kong
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <ClockIcon className="w-5 h-5 text-primary-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-gray-300">每天 7am - 11pm</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部版權信息 */}
        <div className="border-t border-gray-800 mt-12 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              © {currentYear} PickleVibes. 版權所有。由 EntroutWeb 設計。
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
