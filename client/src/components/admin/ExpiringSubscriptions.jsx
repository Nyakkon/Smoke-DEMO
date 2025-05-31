// client/src/components/admin/ExpiringSubscriptions.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Spin, Alert, Button, InputNumber } from 'antd';
import { useSelector } from 'react-redux';

export default function ExpiringSubscriptions() {
  const token = useSelector(s => s.auth.token);
  const [days, setDays] = useState(7);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    axios.get('/api/admin/subscriptions/expiring-soon', {
      headers: { Authorization: `Bearer ${token}` },
      params: { days }
    })
    .then(res => setData(res.data.data))
    .catch(err => setError(err.response?.data?.message || err.message))
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!token) {
      setError('Vui lòng đăng nhập');
      setLoading(false);
      return;
    }
    fetchData();
  }, [token]);

  if (loading) return <Spin tip="Loading..." style={{ margin: 50 }} />;
  if (error)   return <Alert type="error" message={error} style={{ margin: 50 }} />;

  const columns = [
    { title: 'Tên',        dataIndex: 'FirstName', key: 'FirstName' },
    { title: 'Họ',         dataIndex: 'LastName',  key: 'LastName' },
    { title: 'Email',      dataIndex: 'Email',     key: 'Email' },
    { title: 'Gói hiện tại',dataIndex: 'PlanName', key: 'PlanName' },
    { 
      title: 'Ngày hết hạn',
      dataIndex: 'EndDate',
      key: 'EndDate',
      render: dt => new Date(dt).toLocaleDateString()
    },
  ];

  return (
    <div style={{ marginTop: 24 }}>
      <h2>Gói dịch vụ sắp hết hạn</h2>
      <div style={{ marginBottom: 16 }}>
        <span>Trong&nbsp;</span>
        <InputNumber min={1} value={days} onChange={v => setDays(v)} />&nbsp;ngày&nbsp;
        <Button type="primary" onClick={fetchData}>Lấy lại</Button>
      </div>
      <Table
        dataSource={data}
        columns={columns}
        rowKey="UserID"
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}
