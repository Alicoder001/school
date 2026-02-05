import { useState, useEffect } from 'react';
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
  const { addToast } = useGlobalToast();

  // Load devices
  useEffect(() => {
    fetchDevices()
      .then(setDevices)
      .catch((err) => {
        console.error('Failed to load devices:', err);
        addToast('Qurilmalarni yuklashda xato', 'error');
      });
  }, [addToast]);

  // Auto-select first device
  useEffect(() => {
    if (!selectedDeviceId && devices.length > 0) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  // Load users when device selected
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

  // Filter users
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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">O'quvchilar</h1>
          <p className="page-description">Qurilmadagi foydalanuvchilar ro'yxati</p>
        </div>
      </div>

      {/* Device Selector */}
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

      {/* Users Table */}
      <div className="page-content">
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
