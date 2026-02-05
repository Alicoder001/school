import { useState, useEffect, useMemo } from 'react';
import { fetchDevices, fetchUsers, deleteUser, recreateUser, fileToFaceBase64 } from '../api';
import { useGlobalToast } from '../hooks/useToast';
import { Icons } from '../components/ui/Icons';
import type { DeviceConfig, UserInfoEntry, UserInfoSearchResponse } from '../types';
export function StudentsPage() {
  const [devices, setDevices] = useState<DeviceConfig[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [userList, setUserList] = useState<UserInfoSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserInfoEntry | null>(null);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState('unknown');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editNewId, setEditNewId] = useState(false);
  const [editReuseFace, setEditReuseFace] = useState(true);
  const { addToast } = useGlobalToast();
  const editPreviewUrl = useMemo(() => (editFile ? URL.createObjectURL(editFile) : null), [editFile]);
  useEffect(() => {
    return () => {
      if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
    };
  }, [editPreviewUrl]);
  useEffect(() => {
    fetchDevices()
      .then(setDevices)
      .catch((err) => {
        console.error('Failed to load devices:', err);
        addToast('Qurilmalarni yuklashda xato', 'error');
      });
  }, [addToast]);
  useEffect(() => {
    if (!selectedDeviceId && devices.length > 0) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);
  useEffect(() => {
    if (!selectedDeviceId) {
      setUserList(null);
      return;
    }
    const loadUsers = async () => {
      setLoading(true);
      try {
        const data = await fetchUsers(selectedDeviceId);
        setUserList(data);
      } catch (err) {
        console.error('Failed to load users:', err);
        addToast('Foydalanuvchilarni yuklashda xato', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [selectedDeviceId, addToast]);
  const filteredUsers = userList?.UserInfoSearch?.UserInfo?.filter(user => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return user.name.toLowerCase().includes(query) || 
           user.employeeNo.toLowerCase().includes(query);
  }) || [];
  const handleDeleteUser = async (employeeNo: string) => {
    if (!selectedDeviceId) return;
    if (!window.confirm('Bu foydalanuvchini qurilmadan o\'chirmoqchimisiz?')) return;
    try {
      await deleteUser(selectedDeviceId, employeeNo);
      addToast('Foydalanuvchi o\'chirildi', 'success');
      // Reload users
      const data = await fetchUsers(selectedDeviceId);
      setUserList(data);
    } catch (err) {
      addToast('O\'chirishda xato', 'error');
    }
  };
  const startEditUser = (user: UserInfoEntry) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditGender(user.gender || 'unknown');
    setEditFile(null);
    setEditNewId(false);
    setEditReuseFace(true);
  };
  const cancelEditUser = () => {
    setEditingUser(null);
    setEditFile(null);
  };
  const handleSaveEdit = async () => {
    if (!selectedDeviceId || !editingUser) return;
    if (!editName.trim()) {
      addToast("Ism majburiy", "error");
      return;
    }
    if (!editReuseFace && !editFile) {
      addToast("Yangi rasm tanlang yoki avvalgi rasmni ishlating", "error");
      return;
    }

    try {
      const faceImageBase64 = editFile ? await fileToFaceBase64(editFile) : undefined;
      await recreateUser(
        selectedDeviceId,
        editingUser.employeeNo,
        editName.trim(),
        editGender,
        editNewId,
        editReuseFace,
        faceImageBase64,
      );
      addToast("Foydalanuvchi qayta yaratildi", "success");
      cancelEditUser();
      const data = await fetchUsers(selectedDeviceId);
      setUserList(data);
    } catch (err) {
      console.error("Failed to recreate user:", err);
      addToast("Qayta yaratishda xato", "error");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">O'quvchilar</h1>
          <p className="page-description">Qurilmadagi foydalanuvchilar ro'yxati</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="form-group">
          <label>Qurilma:</label>
          <select 
            className="input"
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
          >
            <option value="">Tanlang</option>
            {devices.map(device => (
              <option key={device.id} value={device.id}>
                {device.name} ({device.host})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Qidirish:</label>
          <input
            className="input"
            placeholder="Ism yoki ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="page-content">
        {editingUser && (
          <div className="card edit-user-panel">
            <h2>Foydalanuvchini qayta yaratish</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Ism</label>
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ism va familiya"
                />
              </div>
              <div className="form-group">
                <label>Jinsi</label>
                <select
                  className="input"
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={editReuseFace}
                    onChange={(e) => setEditReuseFace(e.target.checked)}
                  />
                  Avvalgi rasmni ishlatish
                </label>
              </div>
              <div className="form-group">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={editNewId}
                    onChange={(e) => setEditNewId(e.target.checked)}
                  />
                  Yangi ID berish
                </label>
              </div>
            </div>

            {!editReuseFace && (
              <div className="form-row">
                <div className="form-group">
                  <label>Yangi rasm</label>
                  <input
                    type="file"
                    className="input"
                    accept="image/*"
                    onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="form-group">
                  <label>Preview</label>
                  {editPreviewUrl ? (
                    <img
                      src={editPreviewUrl}
                      alt="Preview"
                      className="image-preview"
                    />
                  ) : (
                    <div className="empty-state">
                      <Icons.Image />
                      <p>Rasm tanlanmagan</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="form-actions">
              <button className="button button-primary" onClick={handleSaveEdit}>
                <Icons.Check /> Saqlash
              </button>
              <button className="button button-secondary" onClick={cancelEditUser}>
                <Icons.X /> Bekor qilish
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-state">Yuklanmoqda...</div>
        ) : !selectedDeviceId ? (
          <div className="empty-state">
            <Icons.Monitor />
            <p>Qurilma tanlang</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <Icons.Users />
            <p>Foydalanuvchilar topilmadi</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee No</th>
                  <th>Ism</th>
                  <th>Jinsi</th>
                  <th>Yuzlar soni</th>
                  <th>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.employeeNo}>
                    <td>{user.employeeNo}</td>
                    <td>{user.name}</td>
                    <td>{user.gender || '-'}</td>
                    <td>{user.numOfFace || 0}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-primary"
                          onClick={() => startEditUser(user)}
                          title="Qayta yaratish"
                        >
                          <Icons.Refresh />
                        </button>
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => handleDeleteUser(user.employeeNo)}
                          title="O'chirish"
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
