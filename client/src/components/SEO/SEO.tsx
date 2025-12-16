import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  noindex?: boolean;
  structuredData?: object;
}

const SEO: React.FC<SEOProps> = ({
  title = 'Picklevibes | 香港智能匹克球室租場 | 24小時無人自助預約',
  description = 'Picklevibes 是香港最受歡迎的智能無人匹克球室。提供24小時網上自助租場服務，致力於提升您的球技與社交體驗。立即預約，輕鬆享受匹克球樂趣！',
  keywords = '匹克球,香港匹克球,匹克球場地,匹克球租場,智能匹克球室,無人匹克球室,24小時匹克球,荔枝角匹克球,匹克球預約,匹克球場地租用',
  image = '/logo512.png',
  url = 'https://picklevibes.hk',
  type = 'website',
  noindex = false,
  structuredData
}) => {
  const fullTitle = title.includes('Picklevibes') ? title : `${title} | Picklevibes`;
  const fullImageUrl = image.startsWith('http') ? image : `https://picklevibes.hk${image}`;
  const fullUrl = url.startsWith('http') ? url : `https://picklevibes.hk${url}`;

  const defaultStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'SportsActivityLocation',
    name: 'Picklevibes',
    description: 'Picklevibes 是香港最受歡迎的智能無人匹克球室。提供24小時網上自助租場服務，致力於提升您的球技與社交體驗。',
    url: 'https://picklevibes.hk',
    telephone: '+852 5600 4956',
    email: 'info@picklevibes.hk',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '荔枝角永康街37至39號福源廣場8樓B-D室',
      addressLocality: '荔枝角',
      addressRegion: '香港',
      addressCountry: 'HK'
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: '22.338493',
      longitude: '114.146919'
    },
    openingHours: 'Mo-Su 00:00-23:59',
    priceRange: '$$',
    sport: 'Pickleball',
    amenityFeature: [
      {
        '@type': 'LocationFeatureSpecification',
        name: '24小時營業',
        value: true
      },
      {
        '@type': 'LocationFeatureSpecification',
        name: '智能無人服務',
        value: true
      },
      {
        '@type': 'LocationFeatureSpecification',
        name: '網上預約',
        value: true
      }
    ]
  };

  const finalStructuredData = structuredData || defaultStructuredData;

  return (
    <Helmet>
      {/* 基本 Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {!noindex && <meta name="robots" content="index, follow" />}

      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={fullImageUrl} />
      <meta property="og:site_name" content="Picklevibes" />
      <meta property="og:locale" content="zh_TW" />

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImageUrl} />

      {/* Canonical URL */}
      <link rel="canonical" href={fullUrl} />

      {/* Structured Data (JSON-LD) */}
      <script type="application/ld+json">
        {JSON.stringify(finalStructuredData)}
      </script>
    </Helmet>
  );
};

export default SEO;

