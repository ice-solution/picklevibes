import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import SEO from '../components/SEO/SEO';

type VlogData = {
  _id: string;
  title: string;
  tags?: string[];
  seo?: { title?: string; description?: string; keywords?: string };
  heroBannerUrl?: string;
  contentHtml?: string;
  publishedAt?: string;
};

const Vlog: React.FC = () => {
  const { id } = useParams();
  const [vlog, setVlog] = useState<VlogData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const res = await axios.get(`/vlogs/${id}`);
        setVlog(res.data?.data?.vlog || null);
      } catch {
        setVlog(null);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id]);

  const seo = useMemo(() => {
    const title = vlog?.seo?.title || vlog?.title || 'Vlog';
    const description = vlog?.seo?.description || '';
    const keywords = vlog?.seo?.keywords || (vlog?.tags ? vlog.tags.join(',') : '');
    return { title, description, keywords };
  }, [vlog]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow p-6">載入中...</div>
        </div>
      </div>
    );
  }

  if (!vlog) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow p-6">找不到此 Vlog。</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title={seo.title} description={seo.description} keywords={seo.keywords} url={`/vlog/${vlog._id}`} />
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
            {vlog.heroBannerUrl ? (
              <div className="h-56 sm:h-72 md:h-80 bg-gray-100">
                <img src={vlog.heroBannerUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ) : null}

            <div className="p-6 sm:p-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{vlog.title}</h1>
              {Array.isArray(vlog.tags) && vlog.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {vlog.tags.map((t) => (
                    <span key={t} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="prose prose-gray max-w-none mt-6">
                <div dangerouslySetInnerHTML={{ __html: vlog.contentHtml || '' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Vlog;

