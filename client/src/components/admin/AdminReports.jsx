// client/src/components/admin/AdminReports.jsx
import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Spin, Alert, Table } from 'antd';
import axios from 'axios';
import { useSelector } from 'react-redux';

export default function AdminReports() {
  const token = useSelector(s => s.auth.token);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get('/api/admin/reports/summary', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data.data);
      } catch (e) {
        setError(e.response?.data?.message || e.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [token]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message="Không tải được báo cáo"
        description={error}
        style={{ margin: 24 }}
      />
    );
  }

  // safe-destructure with defaults
  const {
    totalUsers = 0,
    totalMembers = 0,
    activeMemberships = 0,
    avgSmokingPerDay = 0,
    totalRevenue = 0,
    monthlySignups = []
  } = data || {};

  // e.g. monthlySignups: [{ month: '2025-01', count: 10 }, ...]
  const columns = [
    { title: 'Tháng', dataIndex: 'month', key: 'month' },
    { title: 'Đăng ký mới', dataIndex: 'count', key: 'count' }
  ];

  return (
    <Card title="Báo cáo tổng quan" style={{ margin: 24 }}>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Statistic title="Tổng người dùng" value={totalUsers} />
        </Col>
        <Col span={8}>
          <Statistic title="Thành viên hiện tại" value={totalMembers} />
        </Col>
        <Col span={8}>
          <Statistic title="Gói đang hoạt động" value={activeMemberships} />
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Statistic
            title="Trung bình hút / ngày"
            value={avgSmokingPerDay}
            precision={2}
          />
        </Col>
        <Col span={12}>
          <Statistic
            title="Doanh thu (₫)"
            value={totalRevenue}
            precision={0}
            formatter={value => Number(value).toLocaleString()}
          />
        </Col>
      </Row>

      <Card type="inner" title="Đăng ký theo tháng">
        <Table
          rowKey="month"
          dataSource={monthlySignups}
          columns={columns}
          pagination={false}
          locale={{ emptyText: 'Chưa có dữ liệu tháng nào' }}
        />
      </Card>
    </Card>
  );
}
