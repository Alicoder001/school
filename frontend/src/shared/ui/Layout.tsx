import React, { useEffect, useState } from "react";
import {
  Layout as AntLayout,
  Menu,
  Dropdown,
  Avatar,
  Button,
  theme,
  Badge,
  Tooltip,
  Typography,
} from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useSchool } from "../../hooks/useSchool";
import { buildMenuItems } from "./layoutMenu";
import { HeaderMetaProvider, useHeaderMeta } from "./HeaderMetaContext";
import {
  fullHeightLayoutStyle,
  getLiveIconStyle,
  getContentStyle,
  getHeaderStyle,
  getLogoContainerStyle,
  getLogoTitleStyle,
  getAvatarStyle,
  getSiderStyle,
  menuNoBorderStyle,
  headerTimeRowStyle,
  timeIconStyle,
  timeSubTextStyle,
  timeTextStyle,
  calendarIconStyle,
  liveStatusTextStyle,
} from "./styles";
import dayjs from "dayjs";

const { Header, Sider, Content } = AntLayout;
const { Text } = Typography;

const headerMiddleStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  justifyContent: "flex-end",
  flex: 1,
} as const;

const siderUserWrapStyle = {
  marginTop: "auto",
  padding: "12px 16px",
  borderTop: "1px solid #f0f0f0",
  display: "flex",
  alignItems: "center",
  gap: 12,
} as const;

const siderUserTextStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
} as const;

const roleLabelMap: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  SCHOOL_ADMIN: "Admin",
  TEACHER: "O'qituvchi",
  GUARD: "Qo'riqchi",
};

type BackState = {
  backTo?: string;
  schoolName?: string;
};

const LayoutInner: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { schoolId: contextSchoolId, isSuperAdmin } = useSchool();
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();
  const { meta } = useHeaderMeta();
  const [currentTime, setCurrentTime] = useState(dayjs());

  // URL'dan schoolId ni olish (SuperAdmin maktab panelida bo'lganda)
  const urlSchoolId = location.pathname.match(/\/schools\/([^\/]+)/)?.[1];
  const schoolId = urlSchoolId || contextSchoolId;
  const isViewingSchool = !!urlSchoolId; // SuperAdmin maktab panelini ko'rayaptimi?
  const backState = (location.state || {}) as BackState;

  useEffect(() => {
    if (!meta.showTime) return;
    const timer = setInterval(() => setCurrentTime(dayjs()), 60000);
    return () => clearInterval(timer);
  }, [meta.showTime]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const userMenuItems = [
    {
      key: "logout",
      label: "Chiqish",
      icon: <LogoutOutlined />,
      onClick: handleLogout,
    },
  ];

  const menuItems = buildMenuItems({
    isSuperAdmin,
    isViewingSchool,
    schoolId,
    role: user?.role,
    backTo: backState.backTo,
  });

  return (
    <AntLayout style={fullHeightLayoutStyle}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        onBreakpoint={(broken) => setCollapsed(broken)}
        style={getSiderStyle(themeToken)}
      >
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={getLogoContainerStyle(themeToken)}>
            <h2
              style={getLogoTitleStyle({
                collapsed,
                color: themeToken.colorPrimary,
              })}
            >
              {collapsed
                ? "AS"
                : isViewingSchool
                  ? backState.schoolName || user?.school?.name || "Maktab"
                  : user?.school?.name || "Dashboard"}
            </h2>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <Menu
              mode="inline"
              selectedKeys={[location.pathname]}
              items={menuItems}
              onClick={({ key }) =>
                isSuperAdmin && isViewingSchool
                  ? navigate(key, { state: backState })
                  : navigate(key)
              }
              style={{ ...menuNoBorderStyle, flex: 1, minHeight: 0 }}
            />
          </div>
          <div style={{ ...siderUserWrapStyle, width: "100%", marginTop: "auto" }}>
            <Dropdown menu={{ items: userMenuItems }} placement="topLeft">
              <Avatar
                icon={<UserOutlined />}
                style={getAvatarStyle(themeToken.colorPrimary)}
              />
            </Dropdown>
            {!collapsed && (
              <div style={siderUserTextStyle}>
                <Text ellipsis>
                  {isSuperAdmin && !isViewingSchool
                    ? "Barcha maktablar"
                    : user?.school?.name || "Maktab"}
                </Text>
                {user?.role && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {roleLabelMap[user.role] || user.role}
                  </Text>
                )}
              </div>
            )}
          </div>
        </div>
      </Sider>
      <AntLayout>
        <Header
          style={getHeaderStyle(themeToken)}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={headerMiddleStyle}>
            {meta.showTime && (
              <div style={headerTimeRowStyle}>
                <ClockCircleOutlined style={timeIconStyle} />
                <Text strong style={timeTextStyle}>{currentTime.format("HH:mm")}</Text>
                <Text type="secondary" style={timeSubTextStyle}>
                  <CalendarOutlined style={calendarIconStyle} />
                  {currentTime.format("DD MMM, ddd")}
                </Text>
              </div>
            )}
            {meta.showLiveStatus && (
              <Tooltip title={meta.isConnected ? "Real vaqt ulangan" : "Oflayn"}>
                <Badge
                  status={meta.isConnected ? "success" : "error"}
                  text={
                    <span style={liveStatusTextStyle}>
                      <WifiOutlined style={getLiveIconStyle(meta.isConnected)} />
                      {meta.isConnected ? "Jonli" : "Oflayn"}
                    </span>
                  }
                  style={{ display: "flex", alignItems: "center" }}
                />
              </Tooltip>
            )}
          </div>
          <div />
        </Header>
        <Content
          style={getContentStyle(themeToken)}
        >
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

const Layout: React.FC = () => (
  <HeaderMetaProvider>
    <LayoutInner />
  </HeaderMetaProvider>
);

export default Layout;
