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
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  UserAddOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

export default function AdminCoaches() {
  const token = useSelector((s) => s.auth.token);

  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(false);

  const [assigning, setAssigning] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentCoach, setCurrentCoach] = useState(null);

  // members list + selection
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  // Axios auth header
  const authConfig = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  // Load coaches once
  useEffect(() => {
    fetchCoaches();
  }, []);

  const fetchCoaches = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/coaches', authConfig());
      setCoaches(res.data.data);
    } catch {
      message.error('Không tải được danh sách coach.');
    } finally {
      setLoading(false);
    }
  };

  // Khi mở modal assign
  const openAssignModal = (coach) => {
    setCurrentCoach(coach);
    setSelectedMemberIds([]);       // reset selection
    fetchMembers();                 // load all members
    setModalVisible(true);
  };

  const fetchMembers = async () => {
    setMembersLoading(true);
    try {
      const res = await axios.get('/api/admin/members', authConfig());
      setMembers(res.data.data);
    } catch {
      message.error('Không tải được danh sách members.');
    } finally {
      setMembersLoading(false);
    }
  };

  const handleAssignConfirm = async () => {
    if (selectedMemberIds.length === 0) return;
    setAssigning(true);
    try {
      await axios.post(
        `/api/admin/coaches/${currentCoach.CoachID}/assign`,
        { memberIds: selectedMemberIds },
        authConfig()
      );
      message.success('Phân công thành công');
      setModalVisible(false);
      fetchCoaches(); // Reload coaches list to reflect the changes
    } catch {
      message.error('Phân công thất bại');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeleteCoach = async (coachId) => {
    try {
      await axios.delete(`/api/admin/coaches/${coachId}`, authConfig());
      message.success('Coach đã bị deactivate');
      fetchCoaches();
    } catch {
      message.error('Xử lý thất bại');
    }
  };

  // Định nghĩa hàm handleActivateCoach
  const handleActivateCoach = async (coachId) => {
    try {
      await axios.put(`/api/admin/coaches/${coachId}/activate`, {}, authConfig());
      message.success('Huấn luyện viên đã được mở lại.');
      fetchCoaches(); // Tải lại danh sách huấn luyện viên sau khi kích hoạt
    } catch (error) {
      message.error('Không thể mở lại huấn luyện viên.');
      console.error(error);
    }
  };

  const coachColumns = [
    { title: 'Email', dataIndex: 'Email', key: 'Email', width: 200 },
    { title: 'Tên', dataIndex: 'FirstName', key: 'FirstName', width: 120 },
    {
      title: 'Active',
      dataIndex: 'IsActive',
      key: 'IsActive',
      width: 100,
      render: v =>
        v ? <CheckOutlined style={{ color: 'green' }} /> :
          <CloseOutlined style={{ color: 'red' }} />
    },
    {
      title: 'Assigned',
      dataIndex: 'AssignedUsers',
      key: 'AssignedUsers',
      width: 120,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            icon={<UserAddOutlined />}
            onClick={() => openAssignModal(record)}
            disabled={!record.IsActive}  // Không cho phép phân công nếu không hoạt động
          >
            Assign
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteCoach(record.CoachID)}
          >
            Deactivate
          </Button>
          {/* Nút để mở lại huấn luyện viên */}
          {!record.IsActive && (
            <Button
              type="primary"
              onClick={() => handleActivateCoach(record.CoachID)}
            >
              Re-activate
            </Button>
          )}
        </Space>
      )
    }
  ];

  const memberColumns = [
    { title: 'Member ID', dataIndex: 'UserID', key: 'UserID', width: 100 },
    { title: 'Email', dataIndex: 'Email', key: 'Email', width: 200 },
    { title: 'Tên', dataIndex: 'FirstName', key: 'FirstName', width: 120 },
    { title: 'Họ', dataIndex: 'LastName', key: 'LastName', width: 120 },
  ];

  return (
    <Card style={{ margin: 24, background: '#fff' }}>
      <Table
        rowKey="CoachID"
        columns={coachColumns}
        dataSource={coaches}
        loading={loading}
        bordered
        scroll={{ x: true }}
      />

      <Modal
        title={`Assign members to ${currentCoach?.FirstName || ''}`}
        visible={modalVisible}
        onOk={handleAssignConfirm}
        confirmLoading={assigning}
        okButtonProps={{ disabled: selectedMemberIds.length === 0 }}
        onCancel={() => setModalVisible(false)}
        width={800}
      >
        {membersLoading ? (
          <Spin style={{ width: '100%', margin: '40px 0' }} />
        ) : (
          <Table
            rowKey="UserID"
            columns={memberColumns}
            dataSource={members}
            pagination={{ pageSize: 10 }}
            rowSelection={{
              selectedRowKeys: selectedMemberIds,
              onChange: setSelectedMemberIds,
            }}
            scroll={{ y: 300 }}
          />
        )}
      </Modal>
    </Card>
  );
}
