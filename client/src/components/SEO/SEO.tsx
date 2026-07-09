import React from 'react';
import { Helmet } from 'react-helmet-async';
import {
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_KEYWORDS,
  DEFAULT_SEO_TITLE,
  DEFAULT_STRUCTURED_DATA,
  PLATFORM_NAME,
  PLATFORM_OG_IMAGE,
  absoluteAssetUrl,
  absolutePlatformUrl,
  formatPageTitle,
} from '../../constants/platformBrand';

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
  title = DEFAULT_SEO_TITLE,
  description = DEFAULT_SEO_DESCRIPTION,
  keywords = DEFAULT_SEO_KEYWORDS,
  image = PLATFORM_OG_IMAGE,
  url = '/',
  type = 'website',
  noindex = false,
  structuredData,
}) => {
  const fullTitle = formatPageTitle(title);
  const fullImageUrl = absoluteAssetUrl(image);
  const fullUrl = absolutePlatformUrl(url);
  const finalStructuredData = structuredData || DEFAULT_STRUCTURED_DATA;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={PLATFORM_NAME} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {!noindex && <meta name="robots" content="index, follow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={fullImageUrl} />
      <meta property="og:site_name" content={PLATFORM_NAME} />
      <meta property="og:locale" content="zh_TW" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImageUrl} />

      <link rel="canonical" href={fullUrl} />

      <script type="application/ld+json">{JSON.stringify(finalStructuredData)}</script>
    </Helmet>
  );
};

export default SEO;
