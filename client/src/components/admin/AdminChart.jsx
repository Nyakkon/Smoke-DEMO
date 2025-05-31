import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Row,
  Col,
  Card,
  Typography,
  Spin,
  Alert,
  DatePicker,
  Select,
} from 'antd';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSelector } from 'react-redux';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

export default function AdminDashboard() {
  const token = useSelector(s => s.auth.token);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();
  const [range, setRange] = useState([null, null]);
  const [serviceFilter, setServiceFilter] = useState('all');
  const [postFilter, setPostFilter] = useState('all');

  useEffect(() => {
    if (!token) {
      setError('Vui lòng đăng nhập');
      setLoading(false);
      return;
    }
    setLoading(true);
    axios.get('/api/admin/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        from: range[0]?.toISOString(),
        to:   range[1]?.toISOString(),
        service: serviceFilter,
        post:    postFilter,
      }
    })
    .then(r => setStats(r.data))
    .catch(e => setError(e.response?.data?.message || e.message))
    .finally(() => setLoading(false));
  }, [token, range, serviceFilter, postFilter]);

  if (loading) return <Spin tip="Loading..." style={{ margin: 50 }} />;
  if (error)   return <Alert type="error" message={error} style={{ margin: 50 }} />;

  const trends = stats.trends || [];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Data Dashboard</Title>

      {/* Filter options */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col>
          <Text>Auto date range</Text>
          <RangePicker
            value={range}
            onChange={setRange}
            style={{ width: 200 }}
          />
        </Col>
        <Col>
          <Text>Services</Text>
          <Select value={serviceFilter} onChange={setServiceFilter} style={{ width: 150 }}>
            <Option value="all">All</Option>
            <Option value="basic">Basic</Option>
            <Option value="premium">Premium</Option>
            <Option value="pro">Pro</Option>
          </Select>
        </Col>
        <Col>
          <Text>Posts</Text>
          <Select value={postFilter} onChange={setPostFilter} style={{ width: 150 }}>
            <Option value="all">All</Option>
            <Option value="blog">Blog</Option>
            <Option value="community">Community</Option>
          </Select>
        </Col>
      </Row>

      {/* Earnings & Progress Over Time chart */}
      <Card style={{ marginBottom: 24 }} title="Earnings & Progress Over Time">
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <AreaChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="value1" name="User Count" />
              <Area type="monotone" dataKey="value2" name="Revenue" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Total Users and Payments */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Text strong>Users</Text>
            <Title level={3} style={{ margin: 0 }}>{stats.usersCount}</Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text strong>Payments</Text>
            <Title level={3} style={{ margin: 0 }}>{stats.paymentsCount}</Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text strong>Active Plans</Text>
            <Title level={3} style={{ margin: 0 }}>{stats.activePlans}</Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text strong>Quitters</Text>
            <Title level={3} style={{ margin: 0 }}>{stats.successfulQuitters}</Title>
          </Card>
        </Col>
      </Row>

      {/* Components below still render lists for quitting & support */}
      {/* <QuittingUsers /> */}
    </div>
  );
}
