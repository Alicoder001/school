import React, { useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Divider,
  InputNumber,
  Space,
  Typography,
} from "antd";
import {
  DesktopOutlined,
  KeyOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useSchool } from "../hooks/useSchool";
import { PageHeader, StatItem } from "../shared/ui";
import { agentService } from "../services/agent";
import { API_BASE_URL } from "../config";

const { Text, Paragraph } = Typography;

const AgentOnboarding: React.FC = () => {
  const { schoolId } = useSchool();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [ttlMinutes, setTtlMinutes] = useState(10);
  const [pairing, setPairing] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);

  const pairCommand = useMemo(() => {
    const code = pairing?.code ? pairing.code : "<PAIR_CODE>";
    return `curl -X POST ${API_BASE_URL}/agent/pair -H "Content-Type: application/json" -d '{\"code\":\"${code}\"}'`;
  }, [pairing?.code]);

  const scanCommand =
    "npm run agent:scan -- --subnet 192.168.1.0/24 --pretty";

  const provisionCommand = useMemo(() => {
    const id = schoolId || "<SCHOOL_ID>";
    return `npm run agent:provision -- --api ${API_BASE_URL} --token <AGENT_JWT> --schoolId ${id} --input mapping.json --test --sync --deploy`;
  }, [schoolId]);

  const handleCreatePairing = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const data = await agentService.createPairing(schoolId, ttlMinutes);
      setPairing(data);
      message.success("Pairing code yaratildi");
    } catch (err) {
      message.error("Pairing code yaratishda xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader>
        <StatItem
          icon={<DesktopOutlined />}
          value="Desktop Agent"
          label="onboarding"
          color="#1890ff"
        />
      </PageHeader>

      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Card
          size="small"
          title={
            <Space>
              <KeyOutlined />
              <span>Agent Pairing</span>
            </Space>
          }
          style={{ maxWidth: 700 }}
        >
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Text type="secondary">
              Pairing code 1 marta ishlatiladi va qisqa muddatga amal qiladi.
            </Text>
            <Space align="center" wrap>
              <Text>TTL (min):</Text>
              <InputNumber
                min={1}
                max={60}
                value={ttlMinutes}
                onChange={(value) =>
                  setTtlMinutes(Number(value || 10))
                }
              />
              <Button
                type="primary"
                onClick={handleCreatePairing}
                loading={loading}
              >
                Code yaratish
              </Button>
            </Space>

            {pairing && (
              <Space direction="vertical" size={4}>
                <Text strong copyable>
                  {pairing.code}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tugash vaqti: {dayjs(pairing.expiresAt).format("DD MMM, HH:mm")}
                </Text>
              </Space>
            )}
          </Space>
        </Card>

        <Card
          size="small"
          title={
            <Space>
              <PlayCircleOutlined />
              <span>CLI Quickstart</span>
            </Space>
          }
          style={{ maxWidth: 900 }}
        >
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <Text strong>1) Agent token olish</Text>
            <Paragraph copyable={{ text: pairCommand }}>
              {pairCommand}
            </Paragraph>

            <Divider style={{ margin: "8px 0" }} />

            <Text strong>2) LAN scan</Text>
            <Paragraph copyable={{ text: scanCommand }}>
              {scanCommand}
            </Paragraph>

            <Text strong>3) Provision (NVR/Cameras + sync + deploy)</Text>
            <Paragraph copyable={{ text: provisionCommand }}>
              {provisionCommand}
            </Paragraph>
          </Space>
        </Card>
      </Space>
    </div>
  );
};

export default AgentOnboarding;
