import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, Spin, Alert } from 'antd';
import { useSelector } from 'react-redux';

const QuittingUsers = () => {
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
    
    axios.get('/api/admin/quitting', {
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
      <h2>Người dùng đang bỏ thuốc</h2>
      <Table
        dataSource={data}
        columns={[
          { title: 'Tên', dataIndex: 'FirstName', key: 'FirstName' },
          { title: 'Họ', dataIndex: 'LastName', key: 'LastName' },
          { title: 'Email', dataIndex: 'Email', key: 'Email' },
          { title: 'Số điếu thuốc/ngày', dataIndex: 'CigarettesPerDay', key: 'CigarettesPerDay' },
          { title: 'Tần suất hút thuốc', dataIndex: 'SmokingFrequency', key: 'SmokingFrequency' },
        ]}
        rowKey="UserID"
      />
    </div>
  );
};

export default QuittingUsers;
