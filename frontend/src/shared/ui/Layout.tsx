import React, { useState } from "react";
import {
  Layout as AntLayout,
  Menu,
  Dropdown,
  Avatar,
  Button,
  theme,
} from "antd";
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useSchool } from "../../hooks/useSchool";
import { buildMenuItems } from "./layoutMenu";
import {
  fullHeightLayoutStyle,
  getContentStyle,
  getHeaderStyle,
  getLogoContainerStyle,
  getLogoTitleStyle,
  getAvatarStyle,
  getSiderStyle,
  menuNoBorderStyle,
} from "./styles";

const { Header, Sider, Content } = AntLayout;

const headerRightStyle = {
  display: "flex",
  alignItems: "center",
  gap: 16,
} as const;

const Layout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const { schoolId: contextSchoolId, isSuperAdmin } = useSchool();
  const navigate = useNavigate();
  const location = useLocation();
  const { token: themeToken } = theme.useToken();

  // URL'dan schoolId ni olish (SuperAdmin maktab panelida bo'lganda)
  const urlSchoolId = location.pathname.match(/\/schools\/([^\/]+)/)?.[1];
  const schoolId = urlSchoolId || contextSchoolId;
  const isViewingSchool = !!urlSchoolId; // SuperAdmin maktab panelini ko'rayaptimi?

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const userMenuItems = [
    { key: "profile", label: "Profil", icon: <UserOutlined /> },
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
        <div
          style={getLogoContainerStyle(themeToken)}
        >
          <h2
            style={getLogoTitleStyle({
              collapsed,
              color: themeToken.colorPrimary,
            })}
          >
            {collapsed ? "AS" : "Davomat"}
          </h2>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={menuNoBorderStyle}
        />
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
          <div style={headerRightStyle}>
            <span>
              {isSuperAdmin && !isViewingSchool
                ? "Barcha maktablar"
                : user?.school?.name || "Maktab"}
            </span>
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <Avatar
                icon={<UserOutlined />}
                style={getAvatarStyle(themeToken.colorPrimary)}
              />
            </Dropdown>
          </div>
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

export default Layout;
