// client/src/components/admin/AdminPlans.jsx
import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Space,
  Tag,
  Card,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const { TextArea } = Input;

export default function AdminPlans() {
  const token = useSelector((s) => s.auth.token);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [form] = Form.useForm();

  // Build axios config with auth header
  const authConfig = () => ({
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/plans', authConfig());
      setPlans(res.data.data);
    } catch {
      message.error('Không tải được danh sách gói.');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (plan = null) => {
    setEditingPlan(plan);
    if (plan) {
      form.setFieldsValue({
        name: plan.Name,
        description: plan.Description,
        price: plan.Price,
        duration: plan.Duration,
        features: plan.Features,
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleOk = () => {
    form
      .validateFields()
      .then(async (values) => {
        try {
          if (editingPlan) {
            await axios.put(
              `/api/admin/plans/${editingPlan.PlanID}`,
              values,
              authConfig()
            );
            message.success('Cập nhật gói thành công');
          } else {
            await axios.post('/api/admin/plans', values, authConfig());
            message.success('Tạo gói mới thành công');
          }
          fetchPlans();
          setModalVisible(false);
        } catch {
          message.error('Lỗi khi lưu gói.');
        }
      })
      .catch(() => {});
  };

  const handleDelete = async (record) => {
    try {
      await axios.delete(
        `/api/admin/plans/${record.PlanID}`,
        authConfig()
      );
      message.success('Xóa gói thành công');
      fetchPlans();
    } catch {
      message.error('Xóa thất bại');
    }
  };

  const columns = [
    { title: 'Tên gói', dataIndex: 'Name', key: 'Name', width: 150 },
    { title: 'Giá (₫)', dataIndex: 'Price', key: 'Price', width: 100 },
    { title: 'Thời hạn (ngày)', dataIndex: 'Duration', key: 'Duration', width: 120 },
    {
      title: 'Tính năng',
      dataIndex: 'Features',
      key: 'Features',
      render: (f) =>
        f.split(',').map((feat, i) => (
          <Tag
            key={i}
            color="blue"
            style={{ marginBottom: 4, display: 'inline-block' }}
          >
            {feat.trim()}
          </Tag>
        )),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => openModal(record)}
          >
            Sửa
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            Xóa
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card style={{ margin: 24, background: '#fff' }}>
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openModal()}
        >
          Tạo gói mới
        </Button>
      </Space>

      <Table
        rowKey="PlanID"
        columns={columns}
        dataSource={plans}
        loading={loading}
        bordered
        scroll={{ x: 700 }}
      />

      <Modal
        title={editingPlan ? 'Chỉnh sửa gói' : 'Tạo gói mới'}
        visible={modalVisible}
        onOk={handleOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="Tên gói"
            rules={[{ required: true, message: 'Vui lòng nhập tên gói' }]}
          >
            <Input placeholder="VD: Basic, Premium..." />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="price"
            label="Giá tiền"
            rules={[
              { required: true, type: 'number', min: 0, message: 'Giá phải ≥ 0' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="duration"
            label="Thời hạn (ngày)"
            rules={[
              { required: true, type: 'number', min: 1, message: 'Phải ≥ 1 ngày' },
            ]}
          >
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="features" label="Tính năng (phân cách dấu phẩy)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
