import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, Row, Col, Spin, Alert, List, Statistic } from 'antd';
import { useSelector } from 'react-redux';

const AchievementsProgress = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const token = useSelector(state => state.auth.token);

  useEffect(() => {
    if (!token) {
      setError('Vui lòng đăng nhập');
      setLoading(false);
      return;
    }
    
    axios.get('/api/admin/achievements-progress', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        console.log('Achievements progress data:', res.data);
        setData(res.data.data);
      })
      .catch(err => {
        console.error('Error fetching achievements progress:', err);
        setError(err.response?.data?.message || err.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Spin tip="Loading..." style={{ margin: 50 }} />;
  if (error) return <Alert type="error" message={error} style={{ margin: 50 }} />;

  if (!data) {
    return <Alert type="warning" message="Không có dữ liệu" style={{ margin: 50 }} />;
  }

  return (
    <div style={{ marginTop: 24 }}>
      <h2>Thống kê huy hiệu và tiến trình</h2>
      <Row gutter={16}>
        <Col span={8}>
          <Card title="Thống kê huy hiệu" bordered={false}>
            {data.achievements && data.achievements.length > 0 ? (
              <List
                size="small"
                dataSource={data.achievements}
                renderItem={item => (
                  <List.Item>
                    <div>
                      <strong>{item.AchievementName}</strong>: {item.TimesAwarded} lần
                      {item.Description && <div style={{ fontSize: '12px', color: '#666' }}>{item.Description}</div>}
                    </div>
                  </List.Item>
                )}
              />
            ) : (
              <p>Chưa có huy hiệu nào được trao</p>
            )}
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Thống kê người dùng" bordered={false}>
            <Statistic title="Tổng số người dùng" value={data.users?.TotalUsers || 0} />
            <Statistic title="Người dùng có huy hiệu" value={data.users?.UsersWithAchievements || 0} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="Thống kê tiến trình" bordered={false}>
            <Statistic title="Người dùng theo dõi tiến trình" value={data.progress?.UsersTrackingProgress || 0} />
            <Statistic title="Tổng số bản ghi tiến trình" value={data.progress?.TotalProgressEntries || 0} />
            <div style={{ marginTop: 16 }}>
              <p><strong>Trung bình:</strong></p>
              <p>Điếu thuốc hút: {data.progress?.AvgCigarettesSmoked || 0}</p>
              <p>Ngày không hút: {data.progress?.AvgDaysSmokeFree || 0}</p>
              <p>Tiền tiết kiệm: {data.progress?.AvgMoneySaved || 0}đ</p>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AchievementsProgress;
