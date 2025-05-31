import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  Table,
  Button,
  Modal,
  message,
  Space,
  Card,
  Spin,
  Radio,
  Drawer,
  Descriptions,
  Divider,
  List,
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';

export default function AdminMembers() {
  const token = useSelector((s) => s.auth.token);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [assigning, setAssigning] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);

  // danh sách coach để phân công
  const [coaches, setCoaches] = useState([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState(null);

  // drawer chi tiết thành viên
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);

  // cấu hình axios với token
  const authConfig = () => ({ headers: { Authorization: `Bearer ${token}` } });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/members-assignments', authConfig());
      setMembers(res.data.data);
    } catch (err) {
      message.error('Không tải được danh sách thành viên.');
    } finally {
      setLoading(false);
    }
  };

  // mở modal phân công coach
  const openAssignModal = (member) => {
    setCurrentMember(member);
    setSelectedCoachId(member.CoachID || null);
    fetchCoaches();
    setModalVisible(true);
  };

  const fetchCoaches = async () => {
    setCoachesLoading(true);
    try {
      const res = await axios.get('/api/admin/coaches', authConfig());
      setCoaches(res.data.data);
    } catch {
      message.error('Không tải được danh sách huấn luyện viên.');
    } finally {
      setCoachesLoading(false);
    }
  };

  const handleAssignConfirm = async () => {
  if (!selectedCoachId) {
    message.warning('Vui lòng chọn huấn luyện viên.');
    return;
  }
  setAssigning(true);

  try {
    // Fetch current assignments for the selected coach
    const res = await axios.get(`/api/admin/coaches/${selectedCoachId}/assignments`, authConfig());

    const maxMembersPerCoach = 5; // Giới hạn số lượng thành viên một huấn luyện viên có thể huấn luyện
    const assignedCount = res.data.data.length;

    if (assignedCount >= maxMembersPerCoach) {
      message.warning('Huấn luyện viên này đã có tối đa 5 thành viên. Vui lòng chọn huấn luyện viên khác.');
      setAssigning(false);
      return;
    }

    // Check if the member is already assigned to this coach
    if (currentMember.CoachID === selectedCoachId) {
      message.warning('Thành viên này đã được phân công cho huấn luyện viên này.');
      setAssigning(false);
      return;
    }

    // If the member already has a coach, we are essentially switching coaches
    await axios.post(
      `/api/admin/coaches/${selectedCoachId}/assign`,
      { memberIds: [currentMember.MemberID] },
      authConfig()
    );

    message.success('Phân công thành công');
    setModalVisible(false);
    fetchMembers();  // Tải lại danh sách thành viên sau khi phân công
  } catch (error) {
    message.error('Phân công thất bại');
    setAssigning(false);
  }
};


  // Define the openDetailDrawer function
  const openDetailDrawer = async (userId) => {
    setDetailLoading(true); // Set loading to true while fetching the detail
    setDetailVisible(true); // Open the Drawer
    try {
      const res = await axios.get(`/api/admin/members/${userId}/detail`, authConfig());
      setDetailData(res.data.data); // Set the fetched detail data
    } catch (error) {
      message.error('Không tải được chi tiết thành viên.');
      setDetailVisible(false); // Close the Drawer if there's an error
    } finally {
      setDetailLoading(false); // Set loading to false once the request completes
    }
  };

  const memberColumns = [
    { title: 'Email', dataIndex: 'Email', key: 'Email', width: 200 },
    { title: 'Họ', dataIndex: 'MemberFirstName', key: 'MemberFirstName', width: 120 },
    { title: 'Tên', dataIndex: 'MemberLastName', key: 'MemberLastName', width: 120 },
    {
      title: 'Trạng thái',
      dataIndex: 'IsActive',
      key: 'IsActive',
      width: 100,
      render: v => v ? <CheckOutlined style={{ color: 'green' }} /> : <CloseOutlined style={{ color: 'red' }} />
    },
    {
      title: 'Huấn luyện viên',
      key: 'coach',
      render: (_, record) => record.CoachID ? `${record.CoachFirstName} ${record.CoachLastName}` : '—',
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button onClick={() => openDetailDrawer(record.MemberID)}>
            Xem chi tiết
          </Button>
          <Button icon={<TeamOutlined />} onClick={() => openAssignModal(record)}>
            Phân công
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Card style={{ margin: 24, background: '#fff' }}>
      <Table
        rowKey="MemberID"
        columns={memberColumns}
        dataSource={members}
        loading={loading}
        bordered
        scroll={{ x: true }}
      />

      {/* Modal phân công */}
      <Modal
        title={`Phân công huấn luyện viên cho ${currentMember?.MemberFirstName || ''}`}
        open={modalVisible}
        onOk={handleAssignConfirm}
        confirmLoading={assigning}
        okButtonProps={{ disabled: !selectedCoachId }}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        {coachesLoading ? (
          <Spin style={{ width: '100%', margin: '40px 0' }} />
        ) : (
          <Radio.Group
            onChange={e => setSelectedCoachId(e.target.value)}
            value={selectedCoachId}
          >
            <Space direction="vertical">
              {coaches.map(c => (
                <Radio key={c.CoachID} value={c.CoachID}>
                  {c.FirstName} {c.LastName} ({c.Email})
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        )}
      </Modal>

      {/* Drawer chi tiết */}
      <Drawer
        width={720}
        title="Thông tin thành viên"
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
      >
        {detailLoading ? (
          <Spin />
        ) : detailData && (
          <>
            <Descriptions title="Hồ sơ" bordered size="small">
              <Descriptions.Item label="Họ tên">
                {detailData.profile.FirstName} {detailData.profile.LastName}
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {detailData.profile.Email}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày tham gia">
                {new Date(detailData.profile.CreatedAt).toLocaleDateString()}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions title="Tình trạng hút thuốc" bordered size="small">
              <Descriptions.Item label="Điếu/ngày">
                {detailData.status?.CigarettesPerDay ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Tần suất">
                {detailData.status?.SmokingFrequency ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Cập nhật lần cuối">
                {new Date(detailData.status?.LastUpdated).toLocaleDateString()}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <Descriptions title="Kế hoạch cai" bordered size="small">
              <Descriptions.Item label="Động lực">
                {detailData.plan?.MotivationLevel ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                {detailData.plan?.Status ?? '—'}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <List
              header={<strong>Tiến độ gần đây</strong>}
              dataSource={detailData.progress}
              renderItem={p => (
                <List.Item>
                  {new Date(p.Date).toLocaleDateString()} – đã hút {p.CigarettesSmoked} điếu
                </List.Item>
              )}
            />

            <Divider />

            <List
              header={<strong>Thành tựu</strong>}
              dataSource={detailData.achievements}
              renderItem={a => (
                <List.Item>
                  {a.AchievementName}
                </List.Item>
              )}
            />
          </>
        )}
      </Drawer>
    </Card>
  );
}
