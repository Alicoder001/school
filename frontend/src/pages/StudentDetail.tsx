import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Avatar,
  Typography,
  Statistic,
  Table,
  Tag,
  Calendar,
  Badge,
  Spin,
  Empty,
  Tooltip,
  DatePicker,
  Select,
  Space,
  Modal,
} from "antd";
import { UserOutlined, WifiOutlined, LoginOutlined, LogoutOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { useParams } from "react-router-dom";
import { useAttendanceSSE } from "../hooks/useAttendanceSSE";
import { studentsService } from "../services/students";
import type { Student, DailyAttendance, AttendanceStatus, AttendanceEvent } from "../types";
import dayjs, { Dayjs } from "dayjs";

const { Title, Text } = Typography;

const statusColors: Record<AttendanceStatus, string> = {
  PRESENT: "green",
  LATE: "orange",
  ABSENT: "red",
  EXCUSED: "gray",
};

const StudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<DailyAttendance[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState<Dayjs | null>(null);
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | undefined>();
  const [selectedRecord, setSelectedRecord] = useState<DailyAttendance | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [studentData, attendanceData, eventsData] = await Promise.all([
        studentsService.getById(id),
        studentsService.getAttendance(id),
        studentsService.getEvents(id),
      ]);
      setStudent(studentData);
      setAttendance(attendanceData);
      setEvents(eventsData);
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  // Eventlarni kun bo'yicha guruhlash
  const getEventsForDate = (date: string) => {
    const dateStr = dayjs(date).format("YYYY-MM-DD");
    return events.filter((e) => dayjs(e.timestamp).format("YYYY-MM-DD") === dateStr);
  };

  // SSE for real-time updates - filter by this student
  const { isConnected } = useAttendanceSSE(student?.schoolId || null, {
    onEvent: (event) => {
      // Only refresh if event is for this student
      if (event?.studentId === id) {
        fetchData();
      }
    },
    enabled: !!student?.schoolId,
  });

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    loadInitial();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!student) {
    return <Empty description="Student not found" />;
  }

  // Calculate stats including excused and average late time
  const lateRecords = attendance.filter((a) => a.status === "LATE");
  const avgLateMinutes = lateRecords.length > 0
    ? Math.round(lateRecords.reduce((sum, a) => sum + (a.lateMinutes || 0), 0) / lateRecords.length)
    : 0;

  const stats = {
    total: attendance.length,
    present: attendance.filter((a) => a.status === "PRESENT").length,
    late: lateRecords.length,
    absent: attendance.filter((a) => a.status === "ABSENT").length,
    excused: attendance.filter((a) => a.status === "EXCUSED").length,
    avgLateMinutes,
  };

  const attendanceMap = new Map(
    attendance.map((a) => [dayjs(a.date).format("YYYY-MM-DD"), a]),
  );

  const dateCellRender = (date: Dayjs) => {
    const key = date.format("YYYY-MM-DD");
    const record = attendanceMap.get(key);
    if (!record) return null;
    return <Badge color={statusColors[record.status]} />;
  };

  // Jami maktabda bo'lgan vaqtni hisoblash
  const totalTimeInSchool = attendance.reduce((sum, a) => sum + (a.totalTimeOnPremises || 0), 0);
  const avgTimePerDay = stats.total > 0 ? Math.round(totalTimeInSchool / stats.total) : 0;

  // Vaqtni soat:daqiqa formatiga o'girish
  const formatDuration = (minutes: number) => {
    if (!minutes) return "-";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}s ${mins}d`;
    }
    return `${mins} daqiqa`;
  };

  const columns = [
    {
      title: "Sana",
      dataIndex: "date",
      key: "date",
      render: (d: string) => dayjs(d).format("DD MMM, YYYY"),
    },
    {
      title: "Holat",
      dataIndex: "status",
      key: "status",
      render: (s: AttendanceStatus, record: DailyAttendance) => (
        <Space>
          <Tag color={statusColors[s]}>{s}</Tag>
          {record.currentlyInSchool && <Tag icon={<LoginOutlined />} color="purple">Maktabda</Tag>}
        </Space>
      ),
    },
    {
      title: "Kirdi",
      dataIndex: "firstScanTime",
      key: "arrived",
      render: (t: string) => (t ? <><LoginOutlined style={{ color: '#52c41a', marginRight: 4 }} />{dayjs(t).format("HH:mm")}</> : "-"),
    },
    {
      title: "Chiqdi",
      dataIndex: "lastOutTime",
      key: "left",
      render: (t: string) => (t ? <><LogoutOutlined style={{ color: '#1890ff', marginRight: 4 }} />{dayjs(t).format("HH:mm")}</> : "-"),
    },
    {
      title: "Maktabda",
      dataIndex: "totalTimeOnPremises",
      key: "timeInSchool",
      render: (m: number | null) => (m ? <><ClockCircleOutlined style={{ marginRight: 4 }} />{formatDuration(m)}</> : "-"),
    },
    {
      title: "Kechikish",
      dataIndex: "lateMinutes",
      key: "late",
      render: (m: number | null) => (m ? <Tag color="orange">{m} daqiqa</Tag> : "-"),
    },
    {
      title: "Izoh",
      dataIndex: "notes",
      key: "notes",
      render: (n: string) => n || "-",
    },
  ];

  return (
    <div>
      {/* Connection Status Indicator */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tooltip title={isConnected ? 'Real-time ulangan' : 'Real-time ulanish yo\'q'}>
          <Badge
            status={isConnected ? 'success' : 'error'}
            text={
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <WifiOutlined style={{ color: isConnected ? '#52c41a' : '#ff4d4f' }} />
                {isConnected ? 'Live' : 'Offline'}
              </span>
            }
          />
        </Tooltip>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24} align="middle">
          <Col>
            <Avatar
              size={80}
              src={
                student.photoUrl
                  ? `http://localhost:4000/${student.photoUrl}`
                  : undefined
              }
              icon={<UserOutlined />}
            />
          </Col>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              {student.name}
            </Title>
            <Text type="secondary">{student.class?.name || "No class"}</Text>
            <br />
            <Text>ID: {student.deviceStudentId || "-"}</Text>
            <br />
            <Text>
              Parent: {student.parentName || "-"} ({student.parentPhone || "-"})
            </Text>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={4}>
          <Card size="small">
            <Statistic title="Jami kunlar" value={stats.total} />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card size="small">
            <Statistic
              title="Kelgan"
              value={stats.present}
              styles={{ content: { color: "#52c41a" } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card size="small">
            <Statistic
              title="Kech qolgan"
              value={stats.late}
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card size="small">
            <Statistic
              title="Kelmagan"
              value={stats.absent}
              styles={{ content: { color: "#ff4d4f" } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card size="small">
            <Statistic
              title="Sababli"
              value={stats.excused}
              styles={{ content: { color: "#8c8c8c" } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={4}>
          <Card size="small">
            <Statistic
              title="O'rtacha vaqt"
              value={formatDuration(avgTimePerDay)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Average late info */}
      {stats.late > 0 && (
        <Card size="small" style={{ marginBottom: 16, background: '#fffbe6' }}>
          <Text>
            ⏰ <strong>O'rtacha kechikish:</strong> {stats.avgLateMinutes} daqiqa ({stats.late} marta kech kelgan)
          </Text>
        </Card>
      )}

      {/* Pie Chart va Oxirgi Kirdi-Chiqdilar */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Davomat taqsimoti" size="small">
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Kelgan", value: stats.present, color: "#52c41a" },
                      { name: "Kech", value: stats.late, color: "#faad14" },
                      { name: "Kelmagan", value: stats.absent, color: "#ff4d4f" },
                      { name: "Sababli", value: stats.excused, color: "#8c8c8c" },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {[
                      { name: "Kelgan", value: stats.present, color: "#52c41a" },
                      { name: "Kech", value: stats.late, color: "#faad14" },
                      { name: "Kelmagan", value: stats.absent, color: "#ff4d4f" },
                      { name: "Sababli", value: stats.excused, color: "#8c8c8c" },
                    ].filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Ma'lumot yo'q" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Oxirgi kirdi-chiqdilar" size="small">
            {events.length > 0 ? (
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {events.slice(0, 10).map((event) => (
                  <div 
                    key={event.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 10,
                      padding: '8px 10px',
                      marginBottom: 6,
                      background: event.eventType === 'IN' ? '#f6ffed' : '#e6f7ff',
                      borderRadius: 6,
                      borderLeft: `3px solid ${event.eventType === 'IN' ? '#52c41a' : '#1890ff'}`,
                    }}
                  >
                    <Tag 
                      icon={event.eventType === "IN" ? <LoginOutlined /> : <LogoutOutlined />}
                      color={event.eventType === "IN" ? "success" : "processing"}
                      style={{ margin: 0 }}
                    >
                      {event.eventType === "IN" ? "KIRDI" : "CHIQDI"}
                    </Tag>
                    <Text strong>{dayjs(event.timestamp).format("HH:mm")}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(event.timestamp).format("DD MMM")}
                    </Text>
                    {event.device?.name && (
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto' }}>
                        {event.device.name}
                      </Text>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="Kirdi-chiqdi ma'lumoti yo'q" />
            )}
          </Card>
        </Col>
      </Row>

      <Card 
        title="Davomat Kalendari" 
        style={{ marginBottom: 16 }}
        extra={
          <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
            <span><Badge color="green" /> Kelgan</span>
            <span><Badge color="orange" /> Kech</span>
            <span><Badge color="red" /> Kelmagan</span>
            <span><Badge color="gray" /> Excused</span>
          </div>
        }
      >
        <Calendar fullscreen={false} cellRender={dateCellRender} />
      </Card>

      <Card 
        title="Davomat Tarixi"
        extra={
          <Space>
            <DatePicker
              picker="month"
              placeholder="Oy tanlang"
              value={monthFilter}
              onChange={(date) => setMonthFilter(date)}
              allowClear
            />
            <Select
              placeholder="Status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              style={{ width: 120 }}
              allowClear
              options={[
                { value: "PRESENT", label: "Kelgan" },
                { value: "LATE", label: "Kech" },
                { value: "ABSENT", label: "Kelmagan" },
                { value: "EXCUSED", label: "Excused" },
              ]}
            />
          </Space>
        }
      >
        <Table
          dataSource={attendance.filter((a) => {
            let match = true;
            if (monthFilter) {
              match = match && dayjs(a.date).isSame(monthFilter, 'month');
            }
            if (statusFilter) {
              match = match && a.status === statusFilter;
            }
            return match;
          })}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          onRow={(record) => ({
            onClick: () => {
              setSelectedRecord(record);
              setModalOpen(true);
            },
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* Kirdi-Chiqdi Modal */}
      <Modal
        title={
          selectedRecord && (
            <Space>
              <span>{dayjs(selectedRecord.date).format("DD MMMM, YYYY")}</span>
              <Tag color={statusColors[selectedRecord.status]}>{selectedRecord.status}</Tag>
              {selectedRecord.currentlyInSchool && (
                <Tag icon={<LoginOutlined />} color="purple">Hozir maktabda</Tag>
              )}
            </Space>
          )
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={500}
      >
        {selectedRecord && (
          <div>
            {/* Kunlik statistika */}
            <div style={{ 
              display: 'flex', 
              gap: 16, 
              marginBottom: 16, 
              padding: 12, 
              background: '#fafafa', 
              borderRadius: 8 
            }}>
              <div>
                <Text type="secondary">Kirdi</Text>
                <div><Text strong>{selectedRecord.firstScanTime ? dayjs(selectedRecord.firstScanTime).format("HH:mm") : "-"}</Text></div>
              </div>
              <div>
                <Text type="secondary">Chiqdi</Text>
                <div><Text strong>{selectedRecord.lastOutTime ? dayjs(selectedRecord.lastOutTime).format("HH:mm") : "-"}</Text></div>
              </div>
              <div>
                <Text type="secondary">Maktabda</Text>
                <div><Text strong>{formatDuration(selectedRecord.totalTimeOnPremises || 0)}</Text></div>
              </div>
              {selectedRecord.lateMinutes && selectedRecord.lateMinutes > 0 && (
                <div>
                  <Text type="secondary">Kechikish</Text>
                  <div><Tag color="orange">{selectedRecord.lateMinutes} daqiqa</Tag></div>
                </div>
              )}
            </div>

            {/* Kirdi-Chiqdi tarixi */}
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Kirdi-Chiqdi tarixi</Text>
            {(() => {
              const dayEvents = getEventsForDate(selectedRecord.date);
              if (dayEvents.length === 0) {
                return <Empty description="Bu kunda kirdi-chiqdi ma'lumoti yo'q" />;
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dayEvents.map((event) => (
                    <div 
                      key={event.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 12,
                        padding: '10px 14px',
                        background: event.eventType === 'IN' ? '#f6ffed' : '#e6f7ff',
                        borderRadius: 8,
                        borderLeft: `4px solid ${event.eventType === 'IN' ? '#52c41a' : '#1890ff'}`,
                      }}
                    >
                      <Tag 
                        icon={event.eventType === "IN" ? <LoginOutlined /> : <LogoutOutlined />}
                        color={event.eventType === "IN" ? "success" : "processing"}
                        style={{ margin: 0 }}
                      >
                        {event.eventType === "IN" ? "KIRDI" : "CHIQDI"}
                      </Tag>
                      <Text strong style={{ fontSize: 16 }}>{dayjs(event.timestamp).format("HH:mm:ss")}</Text>
                      {event.device?.name && (
                        <Text type="secondary">{event.device.name}</Text>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StudentDetail;
