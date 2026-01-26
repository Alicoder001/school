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
} from "antd";
import { UserOutlined, WifiOutlined } from "@ant-design/icons";
import { useParams } from "react-router-dom";
import { useAttendanceSSE } from "../hooks/useAttendanceSSE";
import { studentsService } from "../services/students";
import type { Student, DailyAttendance, AttendanceStatus } from "../types";
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
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [studentData, attendanceData] = await Promise.all([
        studentsService.getById(id),
        studentsService.getAttendance(id),
      ]);
      setStudent(studentData);
      setAttendance(attendanceData);
    } catch (err) {
      console.error(err);
    }
  }, [id]);

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

  const stats = {
    total: attendance.length,
    present: attendance.filter((a) => a.status === "PRESENT").length,
    late: attendance.filter((a) => a.status === "LATE").length,
    absent: attendance.filter((a) => a.status === "ABSENT").length,
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

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      render: (d: string) => dayjs(d).format("MMM DD, YYYY"),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (s: AttendanceStatus) => <Tag color={statusColors[s]}>{s}</Tag>,
    },
    {
      title: "Arrived",
      dataIndex: "firstScanTime",
      key: "arrived",
      render: (t: string) => (t ? dayjs(t).format("HH:mm") : "-"),
    },
    {
      title: "Left",
      dataIndex: "lastScanTime",
      key: "left",
      render: (t: string) => (t ? dayjs(t).format("HH:mm") : "-"),
    },
    {
      title: "Late By",
      dataIndex: "lateMinutes",
      key: "late",
      render: (m: number | null) => (m ? `${m} min` : "-"),
    },
    {
      title: "Notes",
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

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Total Days" value={stats.total} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Present"
              value={stats.present}
              styles={{ content: { color: "#52c41a" } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Late"
              value={stats.late}
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Absent"
              value={stats.absent}
              styles={{ content: { color: "#ff4d4f" } }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Attendance Calendar" style={{ marginBottom: 16 }}>
        <Calendar fullscreen={false} cellRender={dateCellRender} />
      </Card>

      <Card title="Attendance History">
        <Table
          dataSource={attendance}
          columns={columns}
          rowKey="id"
          size="small"
        />
      </Card>
    </div>
  );
};

export default StudentDetail;
