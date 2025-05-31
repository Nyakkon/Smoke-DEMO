// client/src/components/admin/AdminAchievements.jsx
import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Space, Card } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { useSelector } from 'react-redux';

export default function AdminAchievements() {
  const token = useSelector(s => s.auth.token);
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [current, setCurrent] = useState(null); // achievement đang edit
  const [submitting, setSubmitting] = useState(false);

  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/achievements', authHeader);
      setData(res.data.data);
    } catch (e) {
      message.error('Không tải được danh sách Achievements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openModal = record => {
    setCurrent(record || null);
    form.resetFields();
    if (record) form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async id => {
    try {
      await axios.delete(`/api/admin/achievements/${id}`, authHeader);
      message.success('Xóa thành công');
      fetchData();
    } catch {
      message.error('Xóa thất bại');
    }
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (current) {
        await axios.put(
          `/api/admin/achievements/${current.AchievementID}`,
          values,
          authHeader
        );
        message.success('Cập nhật thành công');
      } else {
        await axios.post('/api/admin/achievements', values, authHeader);
        message.success('Tạo mới thành công');
      }
      setModalVisible(false);
      fetchData();
    } catch {
      message.error('Lưu thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Tên huy hiệu',
      dataIndex: 'Name',
      key: 'Name'
    },
    {
      title: 'Mô tả',
      dataIndex: 'Description',
      key: 'Description'
    },
    {
      title: 'Điều kiện',
      key: 'Criteria',
      render: (_, r) => {
        if (r.MilestoneDays)
          return `Đạt ${r.MilestoneDays} ngày không hút`;
        if (r.SavedMoney)
          return `Tiết kiệm ${r.SavedMoney.toLocaleString()}₫`;
        return '-';
      }
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 160,
      render: (_, r) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => openModal(r)}
          >
            Sửa
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(r.AchievementID)}
          >
            Xóa
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Card style={{ margin: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openModal(null)}
        >
          Tạo huy hiệu mới
        </Button>
      </Space>

      <Table
        rowKey="AchievementID"
        columns={columns}
        dataSource={data}
        loading={loading}
        bordered
        scroll={{ x: true }}
      />

      <Modal
        title={
          current 
            ? `Chỉnh sửa huy hiệu "${current.Name}"` 
            : 'Tạo huy hiệu mới'
        }
        visible={modalVisible}
        onOk={handleOk}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="Name"
            label="Tên huy hiệu"
            rules={[{ required: true, message: 'Nhập tên huy hiệu' }]}
          >
            <Input placeholder="Ví dụ: 7 ngày không hút" />
          </Form.Item>
          <Form.Item
            name="Description"
            label="Mô tả"
            rules={[{ required: true, message: 'Nhập mô tả' }]}
          >
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="MilestoneDays"
            label="Số ngày hoàn thành (nếu có)"
            rules={[
              {
                validator: (_, v) => {
                  if (!v || (v > 0 && Number.isInteger(v))) return Promise.resolve();
                  return Promise.reject('Phải là số nguyên dương');
                }
              }
            ]}
          >
            <Input type="number" placeholder="Nhập số ngày, để trống nếu không dùng" />
          </Form.Item>
          <Form.Item
            name="SavedMoney"
            label="Số tiền tiết kiệm (nếu có)"
            rules={[
              {
                validator: (_, v) => {
                  if (!v || (v > 0 && Number.isInteger(v))) return Promise.resolve();
                  return Promise.reject('Phải là số nguyên dương');
                }
              }
            ]}
          >
            <Input type="number" placeholder="Nhập số tiền, để trống nếu không dùng" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
