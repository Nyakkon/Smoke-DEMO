import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Spin, Alert } from 'antd';
import { useSelector } from 'react-redux';

const UsersNeedingSupport = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const token = useSelector(state => state.auth.token);

  useEffect(() => {
    if (!token) {
      setError('Vui lòng đăng nhập');
      setLoading(false);
      return;
    }
    
    axios.get('/api/admin/support-needed', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => setData(res.data.data))
      .catch(err => setError(err.response?.data?.message || err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Spin tip="Loading..." style={{ margin: 50 }} />;
  if (error) return <Alert type="error" message={error} style={{ margin: 50 }} />;

  return (
    <div>
      <h2>Người dùng cần hỗ trợ</h2>
      <Table
        dataSource={data}
        columns={[
          { title: 'Tên', dataIndex: 'FirstName', key: 'FirstName' },
          { title: 'Họ', dataIndex: 'LastName', key: 'LastName' },
          { title: 'Email', dataIndex: 'Email', key: 'Email' },
          { title: 'Mức độ động lực', dataIndex: 'MotivationLevel', key: 'MotivationLevel' },
          { title: 'Trạng thái kế hoạch bỏ thuốc', dataIndex: 'Status', key: 'Status' },
        ]}
        rowKey="UserID"
      />
    </div>
  );
};

export default UsersNeedingSupport;
