//AdminDashboard/jsx
import React from 'react';
import { Layout, Menu, Avatar, Typography, Card } from 'antd';
import {
  DashboardOutlined,
  AppstoreOutlined,
  TeamOutlined,
  TrophyOutlined,
  BarChartOutlined,
  UserOutlined,
  CreditCardOutlined, // <-- Thêm icon thanh toán
} from '@ant-design/icons';
import { Link, useLocation, Outlet } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

export default function AdminDashboard() {
  const { pathname } = useLocation();
  const key = pathname.split('/')[2] || 'dashboard';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sider
        width={220}
        style={{ background: '#001529' }}
        breakpoint="lg"
        collapsedWidth="0"
      >
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <Avatar size={64} icon={<TeamOutlined />} />
          <Title level={4} style={{ color: '#fff', margin: '12px 0 4px' }}>
            Admin
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.65)' }}>
            Quản trị viên
          </Text>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[key]}
          style={{ border: 'none', marginTop: 16 }}
        >
          <Menu.Item key="dashboard" icon={<DashboardOutlined />}>
            <Link to="/admin/dashboard">Dashboard</Link>
          </Menu.Item>
          <Menu.Item key="plans" icon={<AppstoreOutlined />}>
            <Link to="/admin/plans">Service Packages</Link>
          </Menu.Item>
          <Menu.Item key="coaches" icon={<TeamOutlined />}>
            <Link to="/admin/coaches">Coaches</Link>
          </Menu.Item>
          <Menu.Item key="achievements" icon={<TrophyOutlined />}>
            <Link to="/admin/achievements">Achievements</Link>
          </Menu.Item>
          <Menu.Item key="reports" icon={<BarChartOutlined />}>
            <Link to="/admin/reports">Reports</Link>
          </Menu.Item>
          <Menu.Item key="members" icon={<UserOutlined />}>
            <Link to="/admin/members">Members</Link>
          </Menu.Item>

          {/* Thêm mục Admin Payments */}
          <Menu.Item key="payments" icon={<CreditCardOutlined />}>
            <Link to="/admin/payments">Payments</Link>
          </Menu.Item>
        </Menu>
      </Sider>

      {/* Main Layout */}
      <Layout>
        <Header
          style={{
            background: 'linear-gradient(90deg, #4e54c8, #8f94fb)',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Title level={3} style={{ color: '#fff', margin: 0 }}>
            Admin Portal
          </Title>
        </Header>

        <Content style={{ margin: '24px' }}>
          <Card
            bordered={false}
            style={{ minHeight: 360, padding: 0, overflow: 'visible' }}
            bodyStyle={{ padding: 0 }}
          >
            <Outlet />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
}
