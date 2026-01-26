import React, { useEffect, useState, useCallback } from "react";
import { Row, Col, Card, Statistic, Table, Tag, Spin, Empty, Badge, Tooltip, Typography, Alert, List, Progress } from "antd";
import {
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  WifiOutlined,
  FileTextOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from "recharts";
import { useSchool } from "../hooks/useSchool";
import { useAttendanceSSE } from "../hooks/useAttendanceSSE";
import { dashboardService } from "../services/dashboard";
import { schoolsService } from "../services/schools";
import type { DashboardStats, AttendanceEvent, School } from "../types";
import dayjs from "dayjs";

const { Text } = Typography;

const COLORS = ["#52c41a", "#faad14", "#ff4d4f", "#8c8c8c"];

const Dashboard: React.FC = () => {
  const { schoolId } = useSchool();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(dayjs());

  const fetchStats = useCallback(async () => {
    if (!schoolId) return;
    try {
      const statsData = await dashboardService.getStats(schoolId);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [schoolId]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // SSE for real-time updates
  const { isConnected } = useAttendanceSSE(schoolId, {
    onEvent: (event) => {
      // Add new event to the top of the list
      setEvents((prev) => [event as unknown as AttendanceEvent, ...prev].slice(0, 10));
      // Refresh stats
      fetchStats();
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!schoolId) return;
      setLoading(true);
      try {
        const [statsData, eventsData, schoolData] = await Promise.all([
          dashboardService.getStats(schoolId),
          dashboardService.getRecentEvents(schoolId, 10),
          schoolsService.getById(schoolId),
        ]);
        setStats(statsData);
        setEvents(eventsData);
        setSchool(schoolData);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schoolId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) {
    return <Empty description="No data available" />;
  }

  const pieData = [
    { name: "Present", value: stats.presentToday - stats.lateToday },
    { name: "Late", value: stats.lateToday },
    { name: "Absent", value: stats.absentToday },
  ].filter((d) => d.value > 0);

  const eventColumns = [
    {
      title: "Student",
      dataIndex: ["student", "name"],
      key: "student",
      render: (_: any, record: AttendanceEvent) =>
        record.student?.name || "Unknown",
    },
    {
      title: "Time",
      dataIndex: "timestamp",
      key: "time",
      render: (time: string) => dayjs(time).format("HH:mm"),
    },
    {
      title: "Type",
      dataIndex: "eventType",
      key: "type",
      render: (type: string) => (
        <Tag color={type === "IN" ? "green" : "blue"}>{type}</Tag>
      ),
    },
    {
      title: "Class",
      dataIndex: ["student", "class", "name"],
      key: "class",
      render: (_: any, record: AttendanceEvent) =>
        record.student?.class?.name || "-",
    },
  ];

  return (
    <div>
      {/* Header with time and connection status */}
      <div style={{ 
        marginBottom: 16, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Text strong style={{ fontSize: 16 }}>
            🕐 {currentTime.format('HH:mm')} | 📅 {currentTime.format('YYYY-MM-DD, dddd')}
          </Text>
        </div>
        <Tooltip title={isConnected ? 'Real-time ulangan' : 'Real-time ulanish yo\'q'}>
          <Badge
            status={isConnected ? 'success' : 'error'}
            text={
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <WifiOutlined style={{ color: isConnected ? '#52c41a' : '#ff4d4f' }} />
                {isConnected ? 'Live' : 'Offline'}
              </span>
            }
          />
        </Tooltip>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Students"
              value={stats.totalStudents}
              prefix={<TeamOutlined style={{ color: "#1890ff" }} />}
              styles={{ content: { color: "#1890ff" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Present Today"
              value={stats.presentToday}
              suffix={`(${stats.presentPercentage}%)`}
              prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
              styles={{ content: { color: "#52c41a" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Late Today"
              value={stats.lateToday}
              prefix={<ClockCircleOutlined style={{ color: "#faad14" }} />}
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Absent Today"
              value={stats.absentToday}
              prefix={<CloseCircleOutlined style={{ color: "#ff4d4f" }} />}
              styles={{ content: { color: "#ff4d4f" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card>
            <Statistic
              title="Excused"
              value={stats.excusedToday || 0}
              prefix={<FileTextOutlined style={{ color: "#8c8c8c" }} />}
              styles={{ content: { color: "#8c8c8c" } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Attendance Distribution">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No attendance data" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Recent Activity">
            <Table
              dataSource={events}
              columns={eventColumns}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: "No recent activity" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Not Yet Arrived Alert */}
      {stats.notYetArrivedCount && stats.notYetArrivedCount > 0 && (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginTop: 16 }}
          message={
            <span>
              <strong>{stats.notYetArrivedCount}</strong> ta o'quvchi hali kelmagan
            </span>
          }
          description={
            <List
              size="small"
              dataSource={stats.notYetArrived?.slice(0, 5)}
              renderItem={(item) => (
                <List.Item style={{ padding: '4px 0' }}>
                  {item.name} ({item.className})
                </List.Item>
              )}
              footer={
                stats.notYetArrivedCount > 5 && (
                  <Text type="secondary">...va yana {stats.notYetArrivedCount - 5} ta</Text>
                )
              }
            />
          }
        />
      )}

      {/* Class Breakdown and Weekly Stats */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Sinf bo'yicha davomat" size="small">
            {stats.classBreakdown && stats.classBreakdown.length > 0 ? (
              <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                {stats.classBreakdown.map((cls) => (
                  <div key={cls.classId} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text strong>{cls.className}</Text>
                      <Text type="secondary">
                        {cls.present}/{cls.total} kelgan
                        {cls.late > 0 && <Tag color="orange" style={{ marginLeft: 8 }}>{cls.late} kech</Tag>}
                      </Text>
                    </div>
                    <Progress
                      percent={cls.total > 0 ? Math.round((cls.present / cls.total) * 100) : 0}
                      size="small"
                      status={cls.total > 0 && cls.present / cls.total < 0.8 ? 'exception' : 'success'}
                      showInfo={false}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="Ma'lumot yo'q" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Haftalik trend" size="small">
            {stats.weeklyStats && stats.weeklyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.weeklyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dayName" />
                  <YAxis />
                  <RechartsTooltip />
                  <Bar dataKey="present" fill="#52c41a" name="Kelgan" />
                  <Bar dataKey="late" fill="#faad14" name="Kech" />
                  <Bar dataKey="absent" fill="#ff4d4f" name="Kelmagan" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Ma'lumot yo'q" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Rules Footer */}
      {school && (
        <Card size="small" style={{ marginTop: 16, background: '#fafafa' }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', color: '#666' }}>
            <Text type="secondary">
              ⏰ <strong>Kech qolish:</strong> sinf boshlanishidan {school.lateThresholdMinutes} daqiqa keyin
            </Text>
            <Text type="secondary">
              ❌ <strong>Kelmagan:</strong> {school.absenceCutoffTime} gacha scan qilmasa
            </Text>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
