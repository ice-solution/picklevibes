import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import SEO from '../components/SEO/SEO';

type FormField = {
  fieldName: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

type PublicForm = {
  id: string;
  title: string;
  slug: string;
  description: string;
  bannerUrl?: string;
  thankYouTitle: string;
  thankYouMessage: string;
  agreement?: { enabled: boolean; label?: string; content?: string };
  fields: FormField[];
  store?: { name: string; slug: string } | null;
};

function mediaUrl(path: string) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  return `${apiBase.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

const PublicApplicationForm: React.FC = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [closed, setClosed] = useState(false);
  const [closedMessage, setClosedMessage] = useState('');
  const [error, setError] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setClosed(false);
    setDone(null);
    axios
      .get(`/application-forms/public/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (cancelled) return;
        setForm(res.data.form);
        const init: Record<string, string> = {};
        (res.data.form.fields || []).forEach((f: FormField) => {
          init[f.fieldName] = '';
        });
        setValues(init);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 403 && err.response?.data?.closed) {
          setClosed(true);
          setClosedMessage(err.response.data.closedMessage || err.response.data.message || '');
          setForm({
            id: '',
            title: err.response.data.title || '申請表',
            slug,
            description: '',
            bannerUrl: err.response.data.bannerUrl || '',
            thankYouTitle: '',
            thankYouMessage: '',
            fields: [],
            store: err.response.data.store || null,
          });
        } else if (err.response?.status === 404) {
          setError('找不到此申請表');
        } else {
          setError(err.response?.data?.message || '載入失敗');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    try {
      setSubmitting(true);
      const res = await axios.post(`/application-forms/public/${encodeURIComponent(slug)}/submit`, {
        data: values,
        agreed,
      });
      setDone({
        title: res.data.thankYouTitle || form.thankYouTitle,
        message: res.data.thankYouMessage || form.thankYouMessage,
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        '提交失敗';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-gray-600">{error}</p>
        <Link to="/" className="text-primary-600 text-sm">
          返回首頁
        </Link>
      </div>
    );
  }

  if (closed) {
    return (
      <>
        <SEO title={`${form?.title || '申請表'} | PickleVibes`} url={`/${slug}`} />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          {form?.bannerUrl && (
            <img
              src={mediaUrl(form.bannerUrl)}
              alt=""
              className="w-full rounded-2xl object-cover mb-6 max-h-56"
            />
          )}
          {form?.store?.name && (
            <p className="text-sm text-primary-700 font-medium mb-2">{form.store.name}</p>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{form?.title}</h1>
          <p className="text-gray-600 whitespace-pre-wrap">{closedMessage}</p>
        </div>
      </>
    );
  }

  if (done) {
    return (
      <>
        <SEO title={`${done.title} | PickleVibes`} url={`/${slug}`} />
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">{done.title}</h1>
          <p className="text-gray-600 whitespace-pre-wrap mb-6">{done.message}</p>
          <Link to="/" className="text-primary-600 text-sm">
            返回首頁
          </Link>
        </div>
      </>
    );
  }

  if (!form) return null;

  return (
    <>
      <SEO
        title={`${form.title} | PickleVibes`}
        description={form.description || form.title}
        url={`/${slug}`}
        image={form.bannerUrl ? mediaUrl(form.bannerUrl) : undefined}
      />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-10 px-4">
        <div className="max-w-lg mx-auto">
          {form.bannerUrl && (
            <img
              src={mediaUrl(form.bannerUrl)}
              alt=""
              className="w-full rounded-2xl object-cover mb-6 max-h-64 shadow-sm"
            />
          )}
          <div className="text-center mb-8">
            {form.store && (
              <p className="text-sm text-primary-700 font-medium mb-2">{form.store.name}</p>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{form.title}</h1>
            {form.description && (
              <p className="text-gray-600 whitespace-pre-wrap">{form.description}</p>
            )}
          </div>

          <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
            {form.fields.map((field) => (
              <div key={field.fieldName}>
                <label className="block text-sm font-medium text-gray-800 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                    required={field.required}
                    placeholder={field.placeholder}
                    value={values[field.fieldName] || ''}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.fieldName]: e.target.value }))
                    }
                  />
                ) : field.type === 'select' ? (
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required={field.required}
                    value={values[field.fieldName] || ''}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.fieldName]: e.target.value }))
                    }
                  >
                    <option value="">請選擇</option>
                    {(field.options || []).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required={field.required}
                    placeholder={field.placeholder}
                    value={values[field.fieldName] || ''}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [field.fieldName]: e.target.value }))
                    }
                  />
                )}
              </div>
            ))}

            {form.agreement?.enabled && (
              <div className="space-y-2 pt-2">
                {form.agreement.content && (
                  <div className="text-xs text-gray-600 bg-slate-50 border rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {form.agreement.content}
                  </div>
                )}
                <label className="flex items-start gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    required
                  />
                  <span>{form.agreement.label || '我已閱讀並同意相關條款'}</span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? '提交中…' : '提交申請'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default PublicApplicationForm;
