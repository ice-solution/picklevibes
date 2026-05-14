import React, { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import EdmTemplatesPanel from './EdmTemplatesPanel';
import EdmMailingListsPanel from './EdmMailingListsPanel';

/** 後端會逐封寄出，500 封遠超 axios 預設 10s，故單獨拉長（仍受反向代理／瀏覽器限制） */
const EDM_SEND_TIMEOUT_MS = 30 * 60 * 1000;

const defaultBodyHtml = `<p style="margin:0 0 12px;">您好，</p>
<p style="margin:0 0 12px;">感謝一直支持 <strong>PickleVibes</strong>！我們有新消息想與你分享。</p>
<p style="margin:0;">祝運動愉快！</p>`;

type RecipientMode = 'manual' | 'userIds' | 'roles';

type UserRow = {
  _id: string;
  name: string;
  email: string;
  role: string;
};

type EdmCampaignRow = {
  _id: string;
  subject: string;
  status: string;
  targetCount?: number;
  sentCount?: number;
  failedCount?: number;
  recipientMode?: string;
  createdAt?: string;
  recipientMeta?: Record<string, unknown>;
  createdBy?: { name?: string; email?: string };
  edmTemplateName?: string;
  edmMailingListName?: string;
};

type EdmSendLogRow = {
  _id: string;
  email: string;
  status: string;
  errorMessage?: string;
  sentAt?: string;
  user?: { name?: string; email?: string } | null;
};

type EdmHubView = 'templates' | 'lists' | 'send' | 'history';

const EdmSend: React.FC = () => {
  const [edmView, setEdmView] = useState<EdmHubView>('send');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedMailingListId, setSelectedMailingListId] = useState('');
  const [selectedMailingListLabel, setSelectedMailingListLabel] = useState('');
  const [selectedListMode, setSelectedListMode] = useState<string>('');
  const [templateOptions, setTemplateOptions] = useState<{ _id: string; name: string }[]>([]);
  const [mailingListOptions, setMailingListOptions] = useState<{ _id: string; name: string; listMode: string }[]>([]);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignsList, setCampaignsList] = useState<EdmCampaignRow[]>([]);
  const [campaignsTotal, setCampaignsTotal] = useState(0);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<
    EdmCampaignRow & {
      bodyHtml?: string;
      bodyText?: string;
      preheader?: string;
      headline?: string;
      ctaUrl?: string;
      ctaLabel?: string;
      footerNote?: string;
      edmTemplateName?: string;
      edmMailingListName?: string;
    } | null
  >(null);
  const [detailLogs, setDetailLogs] = useState<EdmSendLogRow[]>([]);
  const [detailLogsTotal, setDetailLogsTotal] = useState(0);
  const [detailLogsPage, setDetailLogsPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailLogsLimit = 80;
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('manual');
  const [recipients, setRecipients] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserRow[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserRow[]>([]);
  const [roleUser, setRoleUser] = useState(true);
  const [roleCoach, setRoleCoach] = useState(false);
  const [roleAdmin, setRoleAdmin] = useState(false);
  /** 依角色分批：與後端一致，固定依 email 升序；本批從第幾位開始（0 = 第一封） */
  const [roleBatchOffset, setRoleBatchOffset] = useState(0);
  const [roleBatchLimit, setRoleBatchLimit] = useState(500);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [rolePreview, setRolePreview] = useState<{
    totalMatched: number;
    offset: number;
    limit: number;
    hasMore: boolean;
    items: { email: string; name: string; role: string }[];
  } | null>(null);

  const [subject, setSubject] = useState('PickleVibes 最新消息');
  const [headline, setHeadline] = useState('最新活動與場地資訊');
  const [preheader, setPreheader] = useState('立即查看 PickleVibes 更新');
  const [bodyHtml, setBodyHtml] = useState(defaultBodyHtml);
  const [ctaUrl, setCtaUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('前往官網');
  const [footerNote, setFooterNote] = useState('你收到此郵件是因為曾於 PickleVibes 註冊或預約。');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{
    campaignId?: string;
    sent?: number;
    failed?: number;
    total?: number;
    recipientsThisBatch?: string[];
    recipientMeta?: {
      mode?: string;
      roles?: string[];
      totalMatched?: number;
      batchOffset?: number;
      batchLimit?: number;
      batchCount?: number;
      hasMore?: boolean;
      orderedBy?: string;
    };
    errors?: { to: string; error: string }[];
  } | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await api.get('/edm/campaigns', { params: { page: campaignPage, limit: 15 } });
      const d = res.data?.data;
      setCampaignsList(d?.items || []);
      setCampaignsTotal(d?.total ?? 0);
    } catch {
      setCampaignsList([]);
      setCampaignsTotal(0);
    } finally {
      setCampaignsLoading(false);
    }
  }, [campaignPage]);

  useEffect(() => {
    if (edmView !== 'history') return;
    void fetchCampaigns();
  }, [edmView, fetchCampaigns]);

  const openCampaignDetail = async (id: string) => {
    setDetailId(id);
    setDetailLogsPage(1);
    setDetailLoading(true);
    setDetailCampaign(null);
    setDetailLogs([]);
    try {
      const [cRes, lRes] = await Promise.all([
        api.get(`/edm/campaigns/${id}`),
        api.get(`/edm/campaigns/${id}/recipients`, { params: { page: 1, limit: detailLogsLimit } })
      ]);
      setDetailCampaign(cRes.data?.data?.campaign || null);
      setDetailLogs(lRes.data?.data?.items || []);
      setDetailLogsTotal(lRes.data?.data?.total ?? 0);
    } catch {
      setDetailCampaign(null);
      setDetailLogs([]);
      setDetailLogsTotal(0);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchDetailLogsPage = async (id: string, page: number) => {
    setDetailLoading(true);
    try {
      const lRes = await api.get(`/edm/campaigns/${id}/recipients`, { params: { page, limit: detailLogsLimit } });
      setDetailLogs(lRes.data?.data?.items || []);
      setDetailLogsTotal(lRes.data?.data?.total ?? 0);
      setDetailLogsPage(page);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshSendOptions = useCallback(async () => {
    try {
      const [tRes, mRes] = await Promise.all([
        api.get('/edm/templates', { params: { page: 1, limit: 100 } }),
        api.get('/edm/mailing-lists', { params: { page: 1, limit: 100 } })
      ]);
      setTemplateOptions(tRes.data?.data?.items || []);
      setMailingListOptions(mRes.data?.data?.items || []);
    } catch {
      setTemplateOptions([]);
      setMailingListOptions([]);
    }
  }, []);

  useEffect(() => {
    if (edmView === 'send') void refreshSendOptions();
  }, [edmView, refreshSendOptions]);

  const applyTemplateById = async (id: string) => {
    setSelectedTemplateId(id);
    if (!id) return;
    try {
      const res = await api.get(`/edm/templates/${id}`);
      const t = res.data?.data?.template;
      if (!t) return;
      setSubject(t.subject || '');
      setHeadline(t.headline || '');
      setPreheader(t.preheader || '');
      setBodyHtml(t.bodyHtml || defaultBodyHtml);
      setCtaUrl(t.ctaUrl || '');
      setCtaLabel(t.ctaLabel || '');
      setFooterNote(t.footerNote || '');
    } catch {
      setMsg('範本載入失敗');
    }
  };

  const applyMailingListById = async (id: string) => {
    setSelectedMailingListId(id);
    if (!id) {
      setSelectedMailingListLabel('');
      setSelectedListMode('');
      return;
    }
    try {
      const res = await api.get(`/edm/mailing-lists/${id}`);
      const list = res.data?.data?.list;
      if (!list) {
        setSelectedMailingListLabel('');
        setSelectedListMode('');
        return;
      }
      setSelectedMailingListLabel(`${list.name}（${list.listMode}）`);
      setSelectedListMode(String(list.listMode || ''));
      if (list.listMode === 'roles' && Array.isArray(list.roles)) {
        setRecipientMode('roles');
        setRoleUser(list.roles.includes('user'));
        setRoleCoach(list.roles.includes('coach'));
        setRoleAdmin(list.roles.includes('admin'));
        setRoleBatchOffset(list.defaultRoleBatchOffset ?? 0);
        setRoleBatchLimit(list.defaultRoleBatchLimit ?? 500);
      }
    } catch {
      setSelectedMailingListLabel('');
      setSelectedListMode('');
      setMsg('發送列表載入失敗');
    }
  };

  const searchUsers = useCallback(async (q: string) => {
    const s = q.trim();
    if (!s) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await api.get('/users', { params: { page: 1, limit: 30, search: s } });
      setSearchResults(res.data?.users || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (recipientMode !== 'userIds') return;
    const t = window.setTimeout(() => {
      void searchUsers(userSearch);
    }, 350);
    return () => window.clearTimeout(t);
  }, [userSearch, recipientMode, searchUsers]);

  const addUser = (u: UserRow) => {
    setSelectedUsers((prev) => {
      if (prev.some((x) => x._id === u._id)) return prev;
      return [...prev, u];
    });
  };

  const removeUser = (id: string) => {
    setSelectedUsers((prev) => prev.filter((x) => x._id !== id));
  };

  const buildPayload = () => {
    const base: Record<string, unknown> = {
      subject: subject.trim(),
      headline: headline.trim() || undefined,
      preheader: preheader.trim() || undefined,
      bodyHtml: bodyHtml.trim(),
      ctaUrl: ctaUrl.trim() || undefined,
      ctaLabel: ctaLabel.trim() || undefined,
      footerNote: footerNote.trim() || undefined
    };
    if (selectedTemplateId) base.templateId = selectedTemplateId;
    if (selectedMailingListId) {
      base.mailingListId = selectedMailingListId;
      base.roleBatchOffset = roleBatchOffset;
      base.roleBatchLimit = Math.min(2000, Math.max(1, roleBatchLimit));
      return base;
    }
    if (recipientMode === 'manual') {
      return {
        ...base,
        recipientMode,
        recipients: recipients.split('\n').map((s) => s.trim()).filter(Boolean)
      };
    }
    if (recipientMode === 'userIds') {
      return { ...base, recipientMode, userIds: selectedUsers.map((u) => u._id) };
    }
    const roles: string[] = [];
    if (roleUser) roles.push('user');
    if (roleCoach) roles.push('coach');
    if (roleAdmin) roles.push('admin');
    return {
      ...base,
      recipientMode: 'roles' as const,
      roles,
      roleBatchOffset,
      roleBatchLimit: Math.min(2000, Math.max(1, roleBatchLimit))
    };
  };

  const rolesParam = () => {
    const roles: string[] = [];
    if (roleUser) roles.push('user');
    if (roleCoach) roles.push('coach');
    if (roleAdmin) roles.push('admin');
    return roles.join(',');
  };

  const fetchRolePreview = async () => {
    if (!roleUser && !roleCoach && !roleAdmin) {
      setMsg('請至少勾選一個角色');
      return;
    }
    setPreviewLoading(true);
    setMsg(null);
    try {
      const res = await api.get('/edm/recipients-preview', {
        params: {
          roles: rolesParam(),
          offset: roleBatchOffset,
          limit: Math.min(2000, Math.max(1, roleBatchLimit))
        }
      });
      setRolePreview(res.data?.data || null);
    } catch (e: any) {
      setMsg(e?.response?.data?.message || '預覽失敗');
      setRolePreview(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const applyNextBatchOffset = () => {
    const m = result?.recipientMeta;
    if (m?.mode !== 'roles' || !m.hasMore) return;
    const next = (m.batchOffset ?? 0) + (m.batchCount ?? result?.total ?? 0);
    setRoleBatchOffset(next);
    setRolePreview(null);
    setMsg(`已將起始位置設為 ${next}，請再按「預覽本批」確認名單後發送。`);
  };

  const submit = async () => {
    if (!selectedMailingListId) {
      if (recipientMode === 'roles' && !roleUser && !roleCoach && !roleAdmin) {
        setMsg('請至少勾選一個角色');
        return;
      }
      if (recipientMode === 'userIds' && !selectedUsers.length) {
        setMsg('請從搜尋結果加入至少一位用戶');
        return;
      }
    }

    setBusy(true);
    setMsg(null);
    setResult(null);
    try {
      const res = await api.post('/edm/send', buildPayload(), { timeout: EDM_SEND_TIMEOUT_MS });
      setMsg(res.data?.message || '已送出');
      setResult(res.data?.data || null);
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e?.message || '發送失敗');
    } finally {
      setBusy(false);
    }
  };

  const hasMailContent = Boolean(selectedTemplateId) || (subject.trim().length > 0 && bodyHtml.trim().length > 0);
  let hasRecipients = Boolean(selectedMailingListId);
  if (!hasRecipients) {
    hasRecipients =
      recipientMode === 'manual'
        ? recipients.trim().length > 0
        : recipientMode === 'userIds'
          ? selectedUsers.length > 0
          : roleUser || roleCoach || roleAdmin;
  }

  const canSubmit = hasMailContent && hasRecipients;

  return (
    <div
      className={`space-y-6 ${
        edmView === 'history' ? 'max-w-5xl' : edmView === 'templates' || edmView === 'lists' ? 'max-w-6xl' : 'max-w-4xl'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">EDM</h2>
          <p className="text-sm text-gray-600 mt-1">
            {edmView === 'send' ? (
              <>
                先建立<strong>範本</strong>與<strong>發送列表</strong>可重複使用；發送時選擇範本／列表（可再覆寫內文）。單次寄送仍會寫入<strong>寄送紀錄</strong>。
              </>
            ) : edmView === 'templates' ? (
              <>建立可重用的郵件內容（主旨、HTML、CTA 等），之後在「發送」選用。</>
            ) : edmView === 'lists' ? (
              <>建立可重用的收件人設定（手動電郵／指定用戶／依角色與預設分批）。</>
            ) : (
              <>檢視歷次寄送內容快照與每位收件人結果。</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-0.5 shrink-0">
          {(
            [
              ['templates', '範本'],
              ['lists', '發送列表'],
              ['send', '發送'],
              ['history', '寄送紀錄']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`px-2.5 py-1.5 text-sm rounded-md ${edmView === id ? 'bg-white shadow text-gray-900' : 'text-gray-600'}`}
              onClick={() => {
                setEdmView(id);
                if (id === 'history') {
                  setDetailId(null);
                  setDetailCampaign(null);
                  setDetailLogs([]);
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {edmView === 'templates' ? (
        <EdmTemplatesPanel
          onUseInSend={(id) => {
            setEdmView('send');
            setSelectedTemplateId(id);
            void applyTemplateById(id);
          }}
        />
      ) : null}

      {edmView === 'lists' ? (
        <EdmMailingListsPanel
          onUseInSend={(id) => {
            setEdmView('send');
            void applyMailingListById(id);
          }}
        />
      ) : null}

      {edmView === 'history' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="font-medium text-gray-900">活動列表</span>
              <button type="button" className="text-xs btn-outline py-1 px-2" disabled={campaignsLoading} onClick={() => void fetchCampaigns()}>
                重新整理
              </button>
            </div>
            {campaignsLoading && !campaignsList.length ? (
              <p className="p-4 text-sm text-gray-500">載入中…</p>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[min(70vh,520px)] overflow-y-auto">
                {campaignsList.map((row) => (
                  <li key={row._id}>
                    <button
                      type="button"
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition ${detailId === row._id ? 'bg-primary-50/80' : ''}`}
                      onClick={() => void openCampaignDetail(row._id)}
                    >
                      <div className="font-medium text-gray-900 truncate">{row.subject}</div>
                      <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                        <span>{row.createdAt ? new Date(row.createdAt).toLocaleString('zh-HK') : '—'}</span>
                        <span>·</span>
                        <span className="font-mono">{row.status}</span>
                        <span>·</span>
                        <span>
                          {row.sentCount ?? 0}/{row.targetCount ?? 0} 成功
                          {(row.failedCount ?? 0) > 0 ? ` · ${row.failedCount} 失敗` : ''}
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {Math.ceil(campaignsTotal / 15) > 1 ? (
              <div className="px-4 py-2 border-t border-gray-100 flex justify-between items-center text-sm">
                <button
                  type="button"
                  className="text-primary-700 disabled:opacity-40"
                  disabled={campaignPage <= 1}
                  onClick={() => setCampaignPage((p) => Math.max(1, p - 1))}
                >
                  上一頁
                </button>
                <span className="text-gray-500">
                  第 {campaignPage} 頁 · 共 {campaignsTotal} 筆
                </span>
                <button
                  type="button"
                  className="text-primary-700 disabled:opacity-40"
                  disabled={campaignPage * 15 >= campaignsTotal}
                  onClick={() => setCampaignPage((p) => p + 1)}
                >
                  下一頁
                </button>
              </div>
            ) : null}
          </div>

          <div className="bg-white rounded-xl shadow border border-gray-100 p-4 space-y-4 min-h-[280px]">
            {!detailId ? (
              <p className="text-sm text-gray-500">請從左側選擇一筆紀錄。</p>
            ) : detailLoading && !detailCampaign ? (
              <p className="text-sm text-gray-500">載入詳情…</p>
            ) : detailCampaign ? (
              <>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{detailCampaign.subject}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    ID：<span className="font-mono">{detailCampaign._id}</span> · 模式 {detailCampaign.recipientMode ?? '—'} · 狀態{' '}
                    <span className="font-mono">{detailCampaign.status}</span>
                  </p>
                  {detailCampaign.edmTemplateName || detailCampaign.edmMailingListName ? (
                    <p className="text-xs text-gray-500 mt-1">
                      {detailCampaign.edmTemplateName ? (
                        <span>
                          範本：<strong>{detailCampaign.edmTemplateName}</strong>
                        </span>
                      ) : null}
                      {detailCampaign.edmTemplateName && detailCampaign.edmMailingListName ? ' · ' : null}
                      {detailCampaign.edmMailingListName ? (
                        <span>
                          發送列表：<strong>{detailCampaign.edmMailingListName}</strong>
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  {detailCampaign.createdBy ? (
                    <p className="text-xs text-gray-500">建立者：{detailCampaign.createdBy.name || '—'}（{detailCampaign.createdBy.email || '—'}）</p>
                  ) : null}
                </div>
                <div className="text-sm space-y-1 border border-gray-100 rounded-lg p-3 bg-gray-50/80">
                  <div>
                    <span className="text-gray-500">標題：</span>
                    {detailCampaign.headline || '—'}
                  </div>
                  <div>
                    <span className="text-gray-500">預覽摘要：</span>
                    {detailCampaign.preheader || '—'}
                  </div>
                  {detailCampaign.ctaUrl ? (
                    <div>
                      <span className="text-gray-500">CTA：</span>
                      {detailCampaign.ctaLabel || '連結'} → {detailCampaign.ctaUrl}
                    </div>
                  ) : null}
                  {detailCampaign.footerNote ? (
                    <div>
                      <span className="text-gray-500">頁尾：</span>
                      {detailCampaign.footerNote}
                    </div>
                  ) : null}
                </div>
                <details className="text-sm border border-gray-200 rounded-lg">
                  <summary className="cursor-pointer px-3 py-2 font-medium text-gray-800 bg-gray-50">HTML 內容快照</summary>
                  <pre className="p-3 max-h-48 overflow-auto text-[11px] leading-snug whitespace-pre-wrap break-words border-t border-gray-100 bg-white">
                    {detailCampaign.bodyHtml || '（無）'}
                  </pre>
                </details>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-800">收件人紀錄（每筆 email）</span>
                    {detailLogsTotal > detailLogsLimit ? (
                      <span className="text-xs text-gray-500">
                        第 {detailLogsPage} 頁 / {Math.ceil(detailLogsTotal / detailLogsLimit) || 1}
                      </span>
                    ) : null}
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                    <table className="min-w-full text-xs">
                      <thead className="bg-gray-100 text-gray-600 sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1.5 font-medium">email</th>
                          <th className="text-left px-2 py-1.5 font-medium">用戶</th>
                          <th className="text-left px-2 py-1.5 font-medium">結果</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailLogs.map((log) => (
                          <tr key={log._id} className={log.status === 'failed' ? 'bg-red-50/50' : ''}>
                            <td className="px-2 py-1.5 font-mono break-all">{log.email}</td>
                            <td className="px-2 py-1.5 text-gray-600">{log.user?.name || '—'}</td>
                            <td className="px-2 py-1.5">
                              <span className={log.status === 'sent' ? 'text-green-800' : 'text-red-800'}>{log.status}</span>
                              {log.errorMessage ? (
                                <div className="text-[10px] text-red-700 mt-0.5 break-words">{log.errorMessage}</div>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {detailLogsTotal > detailLogsLimit ? (
                    <div className="flex justify-between mt-2 text-xs">
                      <button
                        type="button"
                        className="text-primary-700 disabled:opacity-40"
                        disabled={detailLogsPage <= 1 || detailLoading}
                        onClick={() => detailId && void fetchDetailLogsPage(detailId, detailLogsPage - 1)}
                      >
                        上一頁
                      </button>
                      <button
                        type="button"
                        className="text-primary-700 disabled:opacity-40"
                        disabled={detailLogsPage * detailLogsLimit >= detailLogsTotal || detailLoading}
                        onClick={() => detailId && void fetchDetailLogsPage(detailId, detailLogsPage + 1)}
                      >
                        下一頁
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="text-sm text-red-600">無法載入此筆紀錄。</p>
            )}
          </div>
        </div>
      ) : null}

      {edmView === 'send' && msg && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            result?.failed ? 'bg-amber-50 text-amber-900 border border-amber-100' : 'bg-green-50 text-green-800 border border-green-100'
          }`}
        >
          {msg}
          {result ? (
            <div className="mt-2 font-mono text-xs space-y-1">
              <div>
                模式：{result.recipientMeta?.mode || '—'} · 本批寄送 {result.total ?? '—'} 封 · 成功 {result.sent} / 失敗 {result.failed}
              </div>
              {result.recipientMeta?.mode === 'roles' ? (
                <div>
                  符合角色總人數：{result.recipientMeta.totalMatched ?? '—'}；本批起始 {result.recipientMeta.batchOffset ?? 0}、每批上限{' '}
                  {result.recipientMeta.batchLimit ?? '—'}
                  {result.recipientMeta.hasMore ? ' · 尚有下一批' : ' · 已無下一批'}
                </div>
              ) : null}
              {result.recipientMeta?.roles?.length ? (
                <div>角色：{result.recipientMeta.roles.join(', ')}</div>
              ) : null}
              {result.recipientsThisBatch?.length ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-gray-800 font-medium">本批收件人 email（{result.recipientsThisBatch.length}）</summary>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-snug bg-white/80 p-2 rounded border border-gray-200">
                    {result.recipientsThisBatch.join('\n')}
                  </pre>
                </details>
              ) : null}
              {result.recipientMeta?.mode === 'roles' && result.recipientMeta.hasMore ? (
                <button type="button" className="mt-2 btn-outline text-xs py-1 px-2" onClick={applyNextBatchOffset}>
                  填好下一批起始位置（offset）
                </button>
              ) : null}
              {result.errors?.length ? (
                <pre className="mt-2 whitespace-pre-wrap break-words max-h-40 overflow-auto">{JSON.stringify(result.errors, null, 2)}</pre>
              ) : null}
              {result.campaignId ? (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <span className="text-gray-700">已存寄送紀錄 ID：</span>
                  <span className="font-mono">{result.campaignId}</span>
                  <button
                    type="button"
                    className="ml-2 text-primary-700 text-xs underline"
                    onClick={() => {
                      setEdmView('history');
                      void openCampaignDetail(result.campaignId!);
                    }}
                  >
                    在「寄送紀錄」中開啟
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {edmView === 'send' ? (
      <div className="bg-white rounded-xl shadow border border-gray-100 p-6 space-y-5">
        <div className="rounded-lg border border-primary-100 bg-primary-50/40 p-4 space-y-3">
          <div className="text-sm font-medium text-gray-800">重用資源</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">EDM 範本（選填，選後會載入下方表單）</label>
              <select
                className="input-field w-full text-sm"
                value={selectedTemplateId}
                onChange={(e) => {
                  const v = e.target.value;
                  void applyTemplateById(v);
                }}
              >
                <option value="">— 不使用已存範本 —</option>
                {templateOptions.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">發送列表（選填，選後以列表為準）</label>
              <select
                className="input-field w-full text-sm"
                value={selectedMailingListId}
                onChange={(e) => {
                  const v = e.target.value;
                  void applyMailingListById(v);
                }}
              >
                <option value="">— 不使用已存列表（改用手動設定）—</option>
                {mailingListOptions.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}（{t.listMode}）
                  </option>
                ))}
              </select>
            </div>
          </div>
              {selectedMailingListId ? (
            <p className="text-xs text-gray-700">
              目前收件人來自列表：<strong>{selectedMailingListLabel || selectedMailingListId}</strong>
              {selectedListMode === 'roles' ? (
                <>；本批請調整下方「起始位置／每批上限」後可預覽。</>
              ) : null}
              <button type="button" className="ml-2 text-primary-700 underline" onClick={() => void applyMailingListById('')}>
                清除列表改用手動設定
              </button>
            </p>
          ) : null}
        </div>

        {!selectedMailingListId ? (
          <>
            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">收件人來源（未選發送列表時）</span>
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="edm-recipient"
                    checked={recipientMode === 'manual'}
                    onChange={() => setRecipientMode('manual')}
                    className="text-primary-600"
                  />
                  手動電郵
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="edm-recipient"
                    checked={recipientMode === 'userIds'}
                    onChange={() => setRecipientMode('userIds')}
                    className="text-primary-600"
                  />
                  選擇用戶
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="edm-recipient"
                    checked={recipientMode === 'roles'}
                    onChange={() => setRecipientMode('roles')}
                    className="text-primary-600"
                  />
                  依角色
                </label>
              </div>
            </div>

            {recipientMode === 'manual' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">電郵（每行一個，最多 150）</label>
                <textarea
                  className="input-field w-full font-mono text-sm"
                  rows={6}
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="user@example.com&#10;other@example.com"
                />
              </div>
            ) : null}

            {recipientMode === 'userIds' ? (
              <div className="space-y-3 rounded-lg border border-gray-200 p-4 bg-gray-50/80">
                <label className="block text-sm font-medium text-gray-700">搜尋用戶（姓名／電郵／電話）</label>
                <input
                  className="input-field w-full"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="輸入關鍵字…"
                />
                <p className="text-xs text-gray-500">點「加入」加入收件清單，單次最多 500 位。</p>
                {searchLoading ? <p className="text-sm text-gray-500">搜尋中…</p> : null}
                {!searchLoading && userSearch.trim() && searchResults.length === 0 ? (
                  <p className="text-sm text-gray-500">沒有結果</p>
                ) : null}
                <ul className="max-h-48 overflow-y-auto divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
                  {searchResults.map((u) => (
                    <li key={u._id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">{u.name}</div>
                        <div className="text-gray-600 truncate">{u.email}</div>
                        <div className="text-xs text-gray-400">{u.role}</div>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 btn-outline text-xs py-1 px-2"
                        onClick={() => addUser(u)}
                        disabled={selectedUsers.some((s) => s._id === u._id)}
                      >
                        {selectedUsers.some((s) => s._id === u._id) ? '已加入' : '加入'}
                      </button>
                    </li>
                  ))}
                </ul>
                <div>
                  <span className="text-sm font-medium text-gray-700">已選 {selectedUsers.length} 位</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedUsers.map((u) => (
                      <span
                        key={u._id}
                        className="inline-flex items-center gap-1 rounded-full bg-primary-100 text-primary-900 text-xs pl-3 pr-1 py-1 max-w-full"
                      >
                        <span className="truncate">{u.name}</span>
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-primary-200 shrink-0"
                          aria-label="移除"
                          onClick={() => removeUser(u._id)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-gray-600 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-3">
            收件人由已選<strong>發送列表</strong>決定（後端依列表模式解析）。若列表為「依角色」，請在下方調整本批 offset／limit 並預覽。
          </p>
        )}

        {(recipientMode === 'roles' && !selectedMailingListId) || (selectedMailingListId && selectedListMode === 'roles') ? (
          <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-4 space-y-4">
            <p className="text-sm text-amber-950">
              只會寄給<strong>已啟用</strong>用戶；名單<strong>固定依 email 由 A→Z 排序</strong>，再按「起始位置」「每批上限」截取本批。單次最多寄<strong>2000</strong>封。
            </p>
            {selectedMailingListId && selectedListMode === 'roles' ? (
              <p className="text-xs text-gray-800 bg-white/70 border border-amber-100 rounded px-3 py-2">
                列表內角色：
                {[roleUser && 'user', roleCoach && 'coach', roleAdmin && 'admin'].filter(Boolean).join('、') || '—'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-6">
                <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                  <input type="checkbox" checked={roleUser} onChange={(e) => setRoleUser(e.target.checked)} className="rounded text-primary-600" />
                  一般用戶（user）
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                  <input type="checkbox" checked={roleCoach} onChange={(e) => setRoleCoach(e.target.checked)} className="rounded text-primary-600" />
                  教練（coach）
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-800">
                  <input type="checkbox" checked={roleAdmin} onChange={(e) => setRoleAdmin(e.target.checked)} className="rounded text-primary-600" />
                  管理員（admin）
                </label>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">起始位置（第幾位起，0 開始）</label>
                <input
                  type="number"
                  min={0}
                  className="input-field w-full"
                  value={roleBatchOffset}
                  onChange={(e) => setRoleBatchOffset(Math.max(0, parseInt(e.target.value, 10) || 0))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">本批最多幾封（1–2000）</label>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  className="input-field w-full"
                  value={roleBatchLimit}
                  onChange={(e) => setRoleBatchLimit(Math.min(2000, Math.max(1, parseInt(e.target.value, 10) || 500)))}
                />
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-outline w-full sm:w-auto" disabled={previewLoading} onClick={() => void fetchRolePreview()}>
                  {previewLoading ? '載入…' : '預覽本批'}
                </button>
              </div>
            </div>
            {rolePreview ? (
              <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
                <div className="font-medium text-gray-900">
                  符合條件共 <span className="text-primary-700">{rolePreview.totalMatched}</span> 人 · 預覽
                  {rolePreview.items.length
                    ? ` 第 ${rolePreview.offset}–${rolePreview.offset + rolePreview.items.length - 1} 位`
                    : '（本範圍無人）'}
                  {rolePreview.hasMore ? '（尚有更多）' : ''}
                </div>
                <ul className="mt-2 max-h-40 overflow-y-auto divide-y divide-gray-100 text-xs">
                  {rolePreview.items.map((row, idx) => (
                    <li key={`${row.email}-${idx}`} className="py-1 flex justify-between gap-2">
                      <span className="text-gray-600 truncate">{row.name}</span>
                      <span className="font-mono text-gray-800 shrink-0">{row.email}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">郵件主旨 *</label>
            <input className="input-field w-full" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">內文大標題</label>
            <input className="input-field w-full" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">預覽摘要（部分信箱列表顯示）</label>
          <input className="input-field w-full" value={preheader} onChange={(e) => setPreheader(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">正文 HTML *</label>
          <textarea
            className="input-field w-full font-mono text-xs"
            rows={12}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">請使用 inline style；之後後台編輯器會幫你產生 HTML。</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">按鈕連結（可選，須 http/https）</label>
            <input className="input-field w-full" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://picklevibes.hk/..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">按鈕文字</label>
            <input className="input-field w-full" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">頁尾說明</label>
          <input className="input-field w-full" value={footerNote} onChange={(e) => setFooterNote(e.target.value)} />
        </div>
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
          大量收件時後端會逐封寄出，可能需數分鐘；請勿關閉此頁。若仍中斷，請檢查 Apache／Nginx 的 proxy 逾時設定。
        </p>
        <button type="button" className="btn-primary" disabled={busy || !canSubmit} onClick={() => void submit()}>
          {busy ? '發送中…' : '發送 EDM'}
        </button>
      </div>
      ) : null}
    </div>
  );
};

export default EdmSend;
