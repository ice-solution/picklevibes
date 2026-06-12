import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  CalendarIcon,
  MapPinIcon,
  UsersIcon,
  CurrencyDollarIcon,
  ClockIcon,
  XMarkIcon,
  AcademicCapIcon,
  UserPlusIcon,
  ClipboardDocumentIcon,
  BookmarkIcon,
} from '@heroicons/react/24/outline';
import CoachAutocomplete from '../Common/CoachAutocomplete';
import UserAutocomplete from '../Common/UserAutocomplete';

interface Activity {
  _id: string;
  title: string;
  description: string;
  poster?: string;
  maxParticipants: number;
  currentParticipants: number;
  price: number;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  location: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  organizer: {
    _id: string;
    name: string;
    email: string;
  };
  coaches?: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
  requirements?: string;
  isActive: boolean;
  isPinned?: boolean;
  pinnedAt?: string | null;
  pinnedUntil?: string | null;
  isEffectivelyPinned?: boolean;
  createdAt: string;
  venueHoldMode?: 'full_venue' | 'single_court';
  venueHoldCourtId?: string | { _id: string; name?: string };
}

interface VenueCourtOption {
  _id: string;
  name: string;
  type: string;
}

interface ActivityRegistration {
  _id: string;
  user: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
  participantCount: number;
  totalCost: number;
  status: 'registered' | 'cancelled' | 'completed';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  contactInfo: {
    email: string;
    phone: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

interface AutocompleteUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
}

const defaultParticipantStats = {
  totalRegistered: 0,
  availableSpots: 0,
  maxParticipants: 0
};

type ParticipantStats = typeof defaultParticipantStats;
type ParticipantCountValue = number | '';

const ActivityManagement: React.FC = () => {
  const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  const fixedVenueLocation = '荔枝角福源廣場8樓B C D室';
  const customLocationOption = '__custom__';
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [pinModalActivity, setPinModalActivity] = useState<Activity | null>(null);
  const [pinUntilValue, setPinUntilValue] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participants, setParticipants] = useState<ActivityRegistration[]>([]);
  const [participantsStats, setParticipantsStats] = useState<ParticipantStats>({ ...defaultParticipantStats });
  const [selectedParticipantActivity, setSelectedParticipantActivity] = useState<Activity | null>(null);
  const [selectedUserForAdd, setSelectedUserForAdd] = useState<AutocompleteUser | null>(null);
  const [addParticipantForm, setAddParticipantForm] = useState<{
    participantCount: ParticipantCountValue;
    contactEmail: string;
    contactPhone: string;
    notes: string;
    deductPoints: boolean;
  }>({
    participantCount: 1,
    contactEmail: '',
    contactPhone: '',
    notes: '',
    deductPoints: false
  });
  const [addingParticipant, setAddingParticipant] = useState(false);
  const [removingParticipantId, setRemovingParticipantId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [sendingBatchReminders, setSendingBatchReminders] = useState(false);

  // 表單狀態
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    poster: '',
    maxParticipants: 10,
    price: 0,
    startDate: '',
    endDate: '',
    registrationDeadline: '',
    location: '',
    requirements: '',
    coaches: [] as any[],
    venueHoldMode: 'full_venue' as 'full_venue' | 'single_court',
    venueHoldCourtId: ''
  });
  const [locationOption, setLocationOption] = useState<string>(fixedVenueLocation);
  const [customLocation, setCustomLocation] = useState<string>('');
  const [venueCourts, setVenueCourts] = useState<VenueCourtOption[]>([]);

  // 圖片上傳狀態
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  useEffect(() => {
    fetchActivities();
  }, [currentPage, statusFilter]);

  useEffect(() => {
    if (!showCreateModal && !showEditModal) return;
    const loadCourts = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/courts`);
        const data = await res.json();
        const list = (data.courts || []) as VenueCourtOption[];
        const allowed = new Set(['competition', 'training', 'solo']);
        setVenueCourts(list.filter((c) => allowed.has(c.type)));
      } catch {
        setVenueCourts([]);
      }
    };
    loadCourts();
  }, [showCreateModal, showEditModal, apiBaseUrl]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10'
      });
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await fetch(`${apiBaseUrl}/activities?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      setActivities(data.activities || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('獲取活動列表失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = () => {
    setFormData({
      title: '',
      description: '',
      poster: '',
      maxParticipants: 10,
      price: 0,
      startDate: '',
      endDate: '',
      registrationDeadline: '',
      location: '',
      requirements: '',
      coaches: [],
      venueHoldMode: 'full_venue',
      venueHoldCourtId: ''
    });
    setSelectedFile(null);
    setImagePreview('');
    setLocationOption(fixedVenueLocation);
    setCustomLocation('');
    setShowCreateModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 檢查文件類型
      if (!file.type.startsWith('image/')) {
        alert('請選擇圖片文件 (PNG, JPG, JPEG)');
        return;
      }
      
      // 檢查文件大小 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('圖片文件大小不能超過 5MB');
        return;
      }
      
      setSelectedFile(file);
      
      // 創建預覽
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * 將 UTC 時間轉換為本地時間字符串（用於 datetime-local 輸入框）
   */
  const formatDateTimeLocal = (dateString: string): string => {
    const date = new Date(dateString);
    // 獲取本地時間的年月日時分
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  /** 活動開始／結束僅允許整點（分鐘為 :00），與場地預約時段一致、避免非整點時間 */
  const formatDateTimeLocalHourOnly = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:00`;
  };

  const snapDateTimeLocalToHour = (value: string): string => {
    if (!value) return value;
    const m = value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}):\d{2}(?::\d{2})?/);
    if (m) return `${m[1]}:00`;
    return value;
  };

  const handleEditActivity = (activity: Activity) => {
    let courtId = '';
    if (activity.venueHoldCourtId) {
      courtId =
        typeof activity.venueHoldCourtId === 'object' && activity.venueHoldCourtId._id
          ? String(activity.venueHoldCourtId._id)
          : String(activity.venueHoldCourtId);
    }
    setFormData({
      title: activity.title,
      description: activity.description,
      poster: activity.poster || '',
      maxParticipants: activity.maxParticipants,
      price: activity.price,
      startDate: formatDateTimeLocalHourOnly(activity.startDate),
      endDate: formatDateTimeLocalHourOnly(activity.endDate),
      registrationDeadline: formatDateTimeLocal(activity.registrationDeadline),
      location: activity.location,
      requirements: activity.requirements || '',
      coaches: activity.coaches || [],
      venueHoldMode: activity.venueHoldMode === 'single_court' ? 'single_court' : 'full_venue',
      venueHoldCourtId: courtId
    });
    setSelectedFile(null);
    setImagePreview(activity.poster ? getImageUrl(activity.poster) : '');
    if (activity.location === fixedVenueLocation) {
      setLocationOption(fixedVenueLocation);
      setCustomLocation('');
    } else {
      setLocationOption(customLocationOption);
      setCustomLocation(activity.location || '');
    }
    setSelectedActivity(activity);
    setShowEditModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const finalLocation = locationOption === customLocationOption
        ? customLocation.trim()
        : locationOption;

      if (!finalLocation) {
        alert('請輸入活動地點');
        return;
      }

      if (!selectedActivity && !selectedFile) {
        alert('沒有poster是不行，請先上傳活動海報');
        return;
      }

      if (finalLocation === fixedVenueLocation) {
        if (formData.venueHoldMode === 'single_court' && !formData.venueHoldCourtId) {
          alert('請選擇要佔用的場地');
          return;
        }
        const shouldContinue = window.confirm('相關日期將會佔據場地時間，確認?');
        if (!shouldContinue) {
          return;
        }
      }

      const url = selectedActivity ? `${apiBaseUrl}/activities/${selectedActivity._id}` : `${apiBaseUrl}/activities`;
      const method = selectedActivity ? 'PUT' : 'POST';

      const submitPayload = {
        ...formData,
        startDate: snapDateTimeLocalToHour(formData.startDate),
        endDate: snapDateTimeLocalToHour(formData.endDate)
      };
      
      // 創建 FormData 對象
      const formDataToSend = new FormData();
      
      // 添加表單數據
      Object.keys(submitPayload).forEach(key => {
        if (key === 'location' || key === 'venueHoldMode' || key === 'venueHoldCourtId') {
          return;
        }
        const value = submitPayload[key as keyof typeof submitPayload];
        if (value !== '' && value !== null) {
          // 特殊處理 coaches 陣列
          if (key === 'coaches' && Array.isArray(value)) {
            value.forEach((coach, index) => {
              if (coach && typeof coach === 'object' && coach._id) {
                formDataToSend.append(`coaches[${index}]`, coach._id);
              }
            });
          } else {
            formDataToSend.append(key, String(value));
          }
        }
      });
      formDataToSend.append('location', finalLocation);
      if (finalLocation === fixedVenueLocation) {
        formDataToSend.append('venueHoldMode', formData.venueHoldMode);
        if (formData.venueHoldMode === 'single_court' && formData.venueHoldCourtId) {
          formDataToSend.append('venueHoldCourtId', formData.venueHoldCourtId);
        }
      }

      // 如果有選中的文件，添加到 FormData
      if (selectedFile) {
        formDataToSend.append('poster', selectedFile);
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataToSend
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '操作失敗');
      }

      alert(selectedActivity ? '活動更新成功！' : '活動創建成功！');
      setShowCreateModal(false);
      setShowEditModal(false);
      setSelectedActivity(null);
      setSelectedFile(null);
      setImagePreview('');
      fetchActivities();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleDeleteActivity = async (activityId: string, activityTitle: string) => {
    if (!window.confirm(`確定要刪除活動「${activityTitle}」嗎？此操作無法撤銷。`)) {
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/activities/${activityId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '刪除失敗');
      }

      alert('活動刪除成功！');
      fetchActivities();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const formatPinUntil = (pinnedUntil?: string | null) => {
    if (!pinnedUntil) return '直至手動取消';
    return new Date(pinnedUntil).toLocaleString('zh-HK', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const toDatetimeLocalValue = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openPinModal = (activity: Activity) => {
    setPinModalActivity(activity);
    setPinUntilValue(toDatetimeLocalValue(activity.pinnedUntil));
  };

  const submitPin = async (pinned: boolean) => {
    if (!pinModalActivity) return;
    try {
      setPinSaving(true);
      const body: { pinned: boolean; pinnedUntil?: string | null } = { pinned };
      if (pinned) {
        body.pinnedUntil = pinUntilValue
          ? new Date(pinUntilValue).toISOString()
          : null;
      }
      const response = await fetch(`${apiBaseUrl}/activities/${pinModalActivity._id}/pin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || '置頂設定失敗');
      }
      setPinModalActivity(null);
      setPinUntilValue('');
      fetchActivities();
    } catch (error: any) {
      alert(error.message || '置頂設定失敗');
    } finally {
      setPinSaving(false);
    }
  };

  const handleDuplicateActivity = async (activity: Activity) => {
    if (!window.confirm(`確定要複制活動「${activity.title}」嗎？將建立一個新活動（標題會加上「(複製)」、報名人數歸零）。`)) {
      return;
    }
    try {
      const response = await fetch(`${apiBaseUrl}/activities/${activity._id}/duplicate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '複制失敗');
      }
      alert('活動已複制！');
      fetchActivities();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return '未知時間';
    }
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return '未知時間';
    }
    return date.toLocaleString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'ongoing':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'upcoming':
        return '即將開始';
      case 'ongoing':
        return '進行中';
      case 'completed':
        return '已完結';
      case 'cancelled':
        return '已取消';
      default:
        return status;
    }
  };

  const getImageUrl = (imagePath: string) => {
    if (!imagePath) return '';
    if (imagePath.startsWith('http')) return imagePath;

    const base = apiBaseUrl.replace(/\/$/, '');
    return `${base}${imagePath}`;
  };

  const resetAddParticipantForm = () => {
    setSelectedUserForAdd(null);
    setAddParticipantForm({
      participantCount: 1,
      contactEmail: '',
      contactPhone: '',
      notes: '',
      deductPoints: false
    });
  };

  const updateActivityParticipantCountInList = (activityId: string, totalRegistered: number) => {
    setActivities(prev => prev.map(activity =>
      activity._id === activityId
        ? { ...activity, currentParticipants: totalRegistered }
        : activity
    ));

    setSelectedParticipantActivity(prev =>
      prev && prev._id === activityId
        ? { ...prev, currentParticipants: totalRegistered }
        : prev
    );
  };

  const fetchActivityRegistrations = async (activityId: string) => {
    try {
      setParticipantsLoading(true);
      const response = await fetch(`${apiBaseUrl}/activities/${activityId}/registrations`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '獲取活動參加者失敗');
      }

      setParticipants((data.registrations || []) as ActivityRegistration[]);
      setParticipantsStats(data.stats ? { ...defaultParticipantStats, ...data.stats } : { ...defaultParticipantStats });
      updateActivityParticipantCountInList(activityId, data.stats?.totalRegistered ?? 0);
    } catch (error) {
      console.error('獲取活動參加者失敗:', error);
      alert((error as Error).message || '獲取活動參加者失敗');
      setParticipants([]);
      setParticipantsStats({ ...defaultParticipantStats });
    } finally {
      setParticipantsLoading(false);
    }
  };

  const handleOpenParticipantsModal = (activity: Activity) => {
    setSelectedParticipantActivity(activity);
    setShowParticipantsModal(true);
    resetAddParticipantForm();
    fetchActivityRegistrations(activity._id);
  };

  const handleCloseParticipantsModal = () => {
    setShowParticipantsModal(false);
    setSelectedParticipantActivity(null);
    setParticipants([]);
    setParticipantsStats({ ...defaultParticipantStats });
    resetAddParticipantForm();
  };

  const handleSelectUserForAdd = (user: AutocompleteUser | null) => {
    setSelectedUserForAdd(user);
    if (user) {
      setAddParticipantForm(prev => ({
        ...prev,
        contactEmail: user.email || '',
        contactPhone: user.phone || ''
      }));
    } else {
      setAddParticipantForm(prev => ({
        ...prev,
        contactEmail: '',
        contactPhone: ''
      }));
    }
  };

  const handleAddParticipant = async () => {
    if (!selectedParticipantActivity) return;
    if (!selectedUserForAdd) {
      alert('請先選擇用戶');
      return;
    }
    const participantCountValue =
      addParticipantForm.participantCount === ''
        ? 0
        : Number(addParticipantForm.participantCount);

    if (participantCountValue < 1) {
      alert('請輸入有效的參加人數（至少 1 人）');
      return;
    }
    if (!addParticipantForm.contactEmail) {
      alert('請提供聯絡郵箱');
      return;
    }
    if (!addParticipantForm.contactPhone) {
      alert('請提供聯絡電話');
      return;
    }

    try {
      setAddingParticipant(true);
      const response = await fetch(`${apiBaseUrl}/activities/${selectedParticipantActivity._id}/admin/registrations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: selectedUserForAdd._id,
          participantCount: participantCountValue,
          contactInfo: {
            email: addParticipantForm.contactEmail,
            phone: addParticipantForm.contactPhone
          },
          notes: addParticipantForm.notes,
          deductPoints: addParticipantForm.deductPoints
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '新增參加者失敗');
      }

      setParticipants(prev => [data.registration as ActivityRegistration, ...prev]);
      setParticipantsStats(data.stats ? { ...defaultParticipantStats, ...data.stats } : { ...defaultParticipantStats });
      updateActivityParticipantCountInList(
        selectedParticipantActivity._id,
        data.stats?.totalRegistered ?? selectedParticipantActivity.currentParticipants
      );
      resetAddParticipantForm();
    } catch (error) {
      console.error('新增活動參加者失敗:', error);
      alert((error as Error).message || '新增活動參加者失敗');
    } finally {
      setAddingParticipant(false);
    }
  };

  const handleRemoveParticipant = async (registrationId: string) => {
    if (!selectedParticipantActivity) return;

    const confirmRemove = window.confirm('確定要移除此參加者嗎？');
    if (!confirmRemove) {
      return;
    }

    const shouldRefund = window.confirm('是否需要退還積分？選擇「確定」將退還積分，選擇「取消」則不退還。');
    const reason = window.prompt('請輸入移除原因（可留空）', '管理員手動移除') || '管理員手動移除';

    try {
      setRemovingParticipantId(registrationId);
      const response = await fetch(`${apiBaseUrl}/activities/${selectedParticipantActivity._id}/admin/registrations/${registrationId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          refundPoints: shouldRefund,
          reason
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '移除參加者失敗');
      }

      const updatedRegistration = data.registration as Partial<ActivityRegistration>;
      setParticipants(prev => prev.map(reg =>
        reg._id === registrationId ? { ...reg, ...updatedRegistration } : reg
      ));
      setParticipantsStats(data.stats ? { ...defaultParticipantStats, ...data.stats } : { ...defaultParticipantStats });
      updateActivityParticipantCountInList(
        selectedParticipantActivity._id,
        data.stats?.totalRegistered ?? selectedParticipantActivity.currentParticipants
      );
    } catch (error) {
      console.error('移除活動參加者失敗:', error);
      alert((error as Error).message || '移除活動參加者失敗');
    } finally {
      setRemovingParticipantId(null);
    }
  };

  const handleSendReminder = async (registrationId: string) => {
    if (!selectedParticipantActivity) {
      return;
    }

    try {
      setSendingReminderId(registrationId);
      const response = await fetch(
        `${apiBaseUrl}/activities/${selectedParticipantActivity._id}/admin/registrations/${registrationId}/notify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '發送提醒電郵失敗');
      }

      alert('提醒電郵已發送給參加者');
    } catch (error) {
      console.error('發送活動提醒電郵失敗:', error);
      alert((error as Error).message || '發送提醒電郵失敗');
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleSendBatchReminder = async () => {
    if (!selectedParticipantActivity) {
      return;
    }
    if (participants.length === 0) {
      alert('目前沒有已報名的參加者');
      return;
    }

    const confirmSend = window.confirm('確定要向所有已報名參加者發送通知電郵嗎？');
    if (!confirmSend) {
      return;
    }

    try {
      setSendingBatchReminders(true);
      const response = await fetch(
        `${apiBaseUrl}/activities/${selectedParticipantActivity._id}/admin/registrations/notify-all`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '批量發送通知電郵失敗');
      }

      const summaryMessage = data.failed && data.failed.length > 0
        ? `${data.message}\n未成功的參加者：\n${data.failed.map((item: any) => `- ${item.registrationId}: ${item.reason}`).join('\n')}`
        : data.message;
      alert(summaryMessage);
    } catch (error) {
      console.error('批量發送活動提醒電郵失敗:', error);
      alert((error as Error).message || '批量發送通知電郵失敗');
    } finally {
      setSendingBatchReminders(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入活動中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">活動管理</h2>
          <p className="text-gray-600">管理所有活動和報名情況</p>
        </div>
        <button
          onClick={handleCreateActivity}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          創建活動
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === '' 
              ? 'bg-primary-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          全部活動
        </button>
        <button
          onClick={() => setStatusFilter('upcoming')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'upcoming' 
              ? 'bg-primary-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          即將開始
        </button>
        <button
          onClick={() => setStatusFilter('ongoing')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'ongoing' 
              ? 'bg-primary-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          進行中
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            statusFilter === 'completed' 
              ? 'bg-primary-600 text-white' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          已完結
        </button>
      </div>

      {/* Activities List */}
      {activities.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <CalendarIcon className="h-16 w-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暫無活動</h3>
          <p className="text-gray-600">點擊「創建活動」按鈕開始創建第一個活動</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {activities.map((activity, index) => (
            <motion.div
              key={activity._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`bg-white rounded-xl shadow-lg overflow-hidden ${
                activity.isEffectivelyPinned ? 'ring-2 ring-amber-400' : ''
              }`}
            >
              {/* Poster */}
              {(activity as any).posterThumb || activity.poster ? (
                <div className="relative h-48 bg-gray-200 overflow-hidden">
                  <img
                    src={getImageUrl(((activity as any).posterThumb || activity.poster) as string)}
                    alt={activity.title}
                    className="w-full h-full object-cover"
                  />
                  {activity.isEffectivelyPinned && (
                    <span className="absolute top-3 left-3 px-2.5 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full shadow">
                      置頂
                    </span>
                  )}
                </div>
              ) : activity.isEffectivelyPinned ? (
                <div className="relative h-12 bg-amber-50 border-b border-amber-200 flex items-center px-4">
                  <span className="px-2.5 py-1 bg-amber-500 text-white text-xs font-semibold rounded-full">
                    置頂
                  </span>
                </div>
              ) : null}

              <div className="p-6">
                {/* Status Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                      {getStatusText(activity.status)}
                    </span>
                    {activity.isEffectivelyPinned && (
                      <span className="text-xs text-amber-700">{formatPinUntil(activity.pinnedUntil)}</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDate(activity.createdAt)}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                  {activity.title}
                </h3>

                {/* Description */}
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {activity.description}
                </p>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    <span>{formatDate(activity.startDate)}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPinIcon className="h-4 w-4 mr-2" />
                    <span>{activity.location}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <UsersIcon className="h-4 w-4 mr-2" />
                    <span>{activity.currentParticipants}/{activity.maxParticipants} 人</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <CurrencyDollarIcon className="h-4 w-4 mr-2" />
                    <span>{activity.price} 積分/人</span>
                  </div>
                  {activity.coaches && activity.coaches.length > 0 && (
                    <div className="flex items-center text-sm text-gray-600">
                      <AcademicCapIcon className="h-4 w-4 mr-2" />
                      <span>教練: {activity.coaches.map(coach => coach.name).join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>報名進度</span>
                    <span>{activity.maxParticipants - activity.currentParticipants} 個名額</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (activity.currentParticipants / activity.maxParticipants) * 100)}%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* Actions：上 icon、下文字，避免窄欄位時橫排難讀 */}
                <div className="grid grid-cols-5 gap-2">
                  <button
                    type="button"
                    onClick={() => openPinModal(activity)}
                    className={`flex flex-col items-center justify-center gap-1.5 px-1.5 py-3 border rounded-lg transition-colors min-h-[4.5rem] ${
                      activity.isEffectivelyPinned
                        ? 'text-amber-700 border-amber-400 bg-amber-50'
                        : 'text-gray-600 border-gray-300 hover:bg-gray-50'
                    }`}
                    title="置頂設定"
                  >
                    <BookmarkIcon className="h-5 w-5 shrink-0" />
                    <span className="text-xs text-center leading-snug">置頂</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenParticipantsModal(activity)}
                    className="flex flex-col items-center justify-center gap-1.5 px-1.5 py-3 text-primary-600 border border-primary-300 rounded-lg hover:bg-primary-50 transition-colors min-h-[4.5rem]"
                  >
                    <UserPlusIcon className="h-5 w-5 shrink-0" />
                    <span className="text-xs text-center leading-snug">管理參加者</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateActivity(activity)}
                    className="flex flex-col items-center justify-center gap-1.5 px-1.5 py-3 text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors min-h-[4.5rem]"
                    title="複制活動"
                  >
                    <ClipboardDocumentIcon className="h-5 w-5 shrink-0" />
                    <span className="text-xs text-center leading-snug">複制</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditActivity(activity)}
                    className="flex flex-col items-center justify-center gap-1.5 px-1.5 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[4.5rem]"
                  >
                    <PencilIcon className="h-5 w-5 shrink-0" />
                    <span className="text-xs text-center leading-snug">編輯</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteActivity(activity._id, activity.title)}
                    className="flex flex-col items-center justify-center gap-1.5 px-1.5 py-3 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors min-h-[4.5rem]"
                  >
                    <TrashIcon className="h-5 w-5 shrink-0" />
                    <span className="text-xs text-center leading-snug">刪除</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center">
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一頁
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 border rounded-lg ${
                  currentPage === page
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一頁
            </button>
          </div>
        </div>
      )}

      {showParticipantsModal && selectedParticipantActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    管理參加者 - {selectedParticipantActivity.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    已報名 {participantsStats.totalRegistered}/{participantsStats.maxParticipants} 人，剩餘 {participantsStats.availableSpots} 個名額
                  </p>
                </div>
                <button
                  onClick={handleCloseParticipantsModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">新增參加者</h4>
                <div className="space-y-4">
                  <UserAutocomplete
                    value={selectedUserForAdd ? selectedUserForAdd._id : ''}
                    onChange={handleSelectUserForAdd}
                    placeholder="輸入姓名或電郵搜尋用戶"
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">參加人數</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={addParticipantForm.participantCount === '' ? '' : addParticipantForm.participantCount}
                        onChange={(e) => {
                          const rawValue = e.target.value;
                          if (rawValue === '') {
                            setAddParticipantForm(prev => ({
                              ...prev,
                              participantCount: ''
                            }));
                            return;
                          }

                          const numericValue = Number(rawValue);
                          if (Number.isNaN(numericValue)) {
                            return;
                          }

                          const safeValue = Math.max(1, Math.min(10, numericValue));
                          setAddParticipantForm(prev => ({
                            ...prev,
                            participantCount: safeValue
                          }));
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">聯絡電郵</label>
                      <input
                        type="email"
                        value={addParticipantForm.contactEmail}
                        onChange={(e) => setAddParticipantForm(prev => ({
                          ...prev,
                          contactEmail: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">聯絡電話</label>
                      <input
                        type="text"
                        value={addParticipantForm.contactPhone}
                        onChange={(e) => setAddParticipantForm(prev => ({
                          ...prev,
                          contactPhone: e.target.value
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">備註</label>
                      <input
                        type="text"
                        value={addParticipantForm.notes}
                        onChange={(e) => setAddParticipantForm(prev => ({
                          ...prev,
                          notes: e.target.value
                        }))}
                        placeholder="可選"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center space-x-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={addParticipantForm.deductPoints}
                        onChange={(e) => setAddParticipantForm(prev => ({
                          ...prev,
                          deductPoints: e.target.checked
                        }))}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span>扣除用戶積分（若勾選，將立即扣除）</span>
                    </label>
                    <button
                      onClick={handleAddParticipant}
                      disabled={
                        addingParticipant ||
                        !selectedUserForAdd ||
                        addParticipantForm.participantCount === '' ||
                        Number(addParticipantForm.participantCount || 0) < 1
                      }
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${
                        addingParticipant ||
                        !selectedUserForAdd ||
                        addParticipantForm.participantCount === '' ||
                        Number(addParticipantForm.participantCount || 0) < 1
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                      }`}
                    >
                      {addingParticipant ? '新增中...' : '新增參加者'}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-3">
                  <h4 className="text-sm font-semibold text-gray-700">已報名名單</h4>
                  <button
                    onClick={handleSendBatchReminder}
                    disabled={
                      sendingBatchReminders ||
                      participantsLoading ||
                      participants.length === 0
                    }
                    className={`inline-flex items-center justify-center px-4 py-2 text-sm rounded-lg border ${
                      sendingBatchReminders || participantsLoading || participants.length === 0
                        ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'border-primary-300 text-primary-600 hover:bg-primary-50'
                    }`}
                  >
                    {sendingBatchReminders ? '發送中...' : '批量發送通知電郵'}
                  </button>
                </div>
                {participantsLoading ? (
                  <div className="py-10 text-center text-gray-500">載入中...</div>
                ) : participants.length === 0 ? (
                  <div className="py-10 text-center text-gray-500">暫無參加者</div>
                ) : (
                  <div className="space-y-3">
                    {participants.map(reg => (
                      <div
                        key={reg._id}
                        className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {reg.user ? `${reg.user.name} (${reg.user.email})` : '未知用戶'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              reg.status === 'registered'
                                ? 'bg-green-100 text-green-700'
                                : reg.status === 'cancelled'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-gray-100 text-gray-600'
                            }`}>
                              {reg.status === 'registered' ? '已報名' : reg.status === 'cancelled' ? '已取消' : '已完成'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              reg.paymentStatus === 'paid'
                                ? 'bg-blue-100 text-blue-700'
                                : reg.paymentStatus === 'refunded'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {reg.paymentStatus === 'paid' ? '已扣積分' : reg.paymentStatus === 'refunded' ? '已退款' : '未扣積分'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            人數 {reg.participantCount} 人 · 總費用 {reg.totalCost} 積分
                          </p>
                          <p className="text-xs text-gray-500">
                            聯絡：{reg.contactInfo?.email} / {reg.contactInfo?.phone}
                          </p>
                          <p className="text-xs text-gray-400">
                            報名於 {formatDate(reg.createdAt)}
                            {reg.notes && ` · 備註：${reg.notes}`}
                            {reg.status === 'cancelled' && reg.cancellationReason && ` · 原因：${reg.cancellationReason}`}
                          </p>
                        </div>
                        {reg.status === 'registered' && (
                          <div className="mt-4 md:mt-0 flex flex-col md:flex-row md:items-center md:space-x-3 space-y-2 md:space-y-0">
                            <button
                              onClick={() => handleSendReminder(reg._id)}
                              disabled={sendingReminderId === reg._id}
                              className={`px-4 py-2 text-sm rounded-lg border ${
                                sendingReminderId === reg._id
                                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                                  : 'border-primary-300 text-primary-600 hover:bg-primary-50'
                              }`}
                            >
                              {sendingReminderId === reg._id ? '發送中...' : '發送通知電郵'}
                            </button>
                            <button
                              onClick={() => handleRemoveParticipant(reg._id)}
                              disabled={removingParticipantId === reg._id}
                              className={`px-4 py-2 text-sm rounded-lg border ${
                                removingParticipantId === reg._id
                                  ? 'border-gray-200 text-gray-400'
                                  : 'border-red-300 text-red-600 hover:bg-red-50'
                              }`}
                            >
                              {removingParticipantId === reg._id ? '處理中...' : '移除'}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedActivity ? '編輯活動' : '創建新活動'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowEditModal(false);
                    setSelectedActivity(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      活動標題 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="請輸入活動標題"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      活動地點 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={locationOption}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLocationOption(v);
                        if (v !== fixedVenueLocation) {
                          setFormData((prev) => ({
                            ...prev,
                            venueHoldMode: 'full_venue',
                            venueHoldCourtId: ''
                          }));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    >
                      <option value={fixedVenueLocation}>{fixedVenueLocation}</option>
                      <option value={customLocationOption}>自訂地點</option>
                    </select>
                    {locationOption === customLocationOption && (
                      <input
                        type="text"
                        value={customLocation}
                        onChange={(e) => setCustomLocation(e.target.value)}
                        className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="請輸入自訂活動地點"
                        required
                      />
                    )}
                    {locationOption === fixedVenueLocation && (
                      <div className="mt-3 space-y-2 rounded-lg border border-amber-100 bg-amber-50/80 p-3">
                        <label className="block text-sm font-medium text-gray-800">
                          場地佔用方式
                        </label>
                        <select
                          value={formData.venueHoldMode}
                          onChange={(e) => {
                            const mode = e.target.value === 'single_court' ? 'single_court' : 'full_venue';
                            setFormData((prev) => ({
                              ...prev,
                              venueHoldMode: mode,
                              venueHoldCourtId: mode === 'full_venue' ? '' : prev.venueHoldCourtId
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                          <option value="full_venue">包場（三場地）</option>
                          <option value="single_court">單一場地</option>
                        </select>
                        {formData.venueHoldMode === 'single_court' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              選擇場地 <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={formData.venueHoldCourtId}
                              onChange={(e) =>
                                setFormData({ ...formData, venueHoldCourtId: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                              required={formData.venueHoldMode === 'single_court'}
                            >
                              <option value="">請選擇場地</option>
                              {venueCourts.map((c) => (
                                <option key={c._id} value={c._id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    活動描述 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="請輸入活動描述"
                    required
                  />
                </div>

                {/* 人數限制和費用 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      人數限制 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.maxParticipants}
                      onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      min="1"
                      max="100"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      費用 (積分) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      min="0"
                      required
                    />
                  </div>
                </div>

                {/* 時間設置：截止獨立一行；開始／結束並列，避免 datetime-local 被擠壓截斷 */}
                <div className="space-y-4">
                  <div className="w-full min-w-0">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      報名截止時間 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.registrationDeadline}
                      onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                      className="w-full max-w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <p className="text-xs text-gray-500 md:col-span-2 -mt-1 mb-0">
                      活動開始與結束時間僅限整點（分鐘為 :00），與場地預約時段一致。
                    </p>
                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        活動開始時間 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        step={3600}
                        value={formData.startDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            startDate: snapDateTimeLocalToHour(e.target.value)
                          })
                        }
                        className="w-full max-w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>

                    <div className="min-w-0">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        活動結束時間 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        step={3600}
                        value={formData.endDate}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            endDate: snapDateTimeLocalToHour(e.target.value)
                          })
                        }
                        className="w-full max-w-full min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* 活動要求 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    活動要求
                  </label>
                  <textarea
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="請輸入活動要求（可選）"
                  />
                </div>

                {/* 教練選擇 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center space-x-2">
                      <AcademicCapIcon className="w-4 h-4" />
                      <span>負責教練</span>
                    </div>
                  </label>
                  <div className="space-y-2">
                    {formData.coaches.map((coach, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="flex-1 bg-gray-50 px-3 py-2 rounded-md">
                          <span className="text-sm font-medium">{coach.name}</span>
                          <span className="text-sm text-gray-500 ml-2">({coach.email})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newCoaches = formData.coaches.filter((_, i) => i !== index);
                            setFormData({ ...formData, coaches: newCoaches });
                          }}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <CoachAutocomplete
                      value=""
                      onChange={(coach) => {
                        if (coach && !formData.coaches.find(c => c._id === coach._id)) {
                          setFormData({ ...formData, coaches: [...formData.coaches, coach] });
                        }
                      }}
                      placeholder="搜索並添加教練（可選）"
                      className="w-full"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    選擇負責此活動的教練，教練將在「我的課程預約」頁面看到此活動
                  </p>
                </div>

                {/* 活動海報 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    活動海報
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleFileSelect}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    支持 PNG、JPG、JPEG 格式，文件大小不超過 5MB
                  </p>
                  
                  {/* 圖片預覽 */}
                  {imagePreview && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-700 mb-2">預覽：</p>
                      <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                        <img
                          src={imagePreview}
                          alt="活動海報預覽"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      setSelectedActivity(null);
                    }}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    {selectedActivity ? '更新活動' : '創建活動'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {pinModalActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">置頂設定</h3>
                <p className="text-sm text-gray-500 mt-1">{pinModalActivity.title}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPinModalActivity(null);
                  setPinUntilValue('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
              置頂活動會顯示在活動中心「現在活動」列表最前；多個置頂時，開始日期愈接近今天愈前。
            </p>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              置頂至（選填）
            </label>
            <input
              type="datetime-local"
              value={pinUntilValue}
              onChange={(e) => setPinUntilValue(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <p className="text-xs text-gray-500 mb-4">留空 = 長期置頂，直至按「取消置頂」</p>

            <div className="flex flex-wrap gap-2 justify-end">
              {pinModalActivity.isEffectivelyPinned && (
                <button
                  type="button"
                  disabled={pinSaving}
                  onClick={() => submitPin(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  取消置頂
                </button>
              )}
              <button
                type="button"
                disabled={pinSaving}
                onClick={() => submitPin(true)}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
              >
                {pinSaving ? '儲存中…' : pinModalActivity.isEffectivelyPinned ? '更新置頂' : '確認置頂'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityManagement;
