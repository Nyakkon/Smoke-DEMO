import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Table, Button, Tag, Modal, notification, Spin } from 'antd';
import { getPayments, updatePaymentStatus } from '../../store/slices/paymentSlice';

const AdminPayments = () => {
  const dispatch = useDispatch();
  const { payments, loading, error } = useSelector(state => state.payment);

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    dispatch(getPayments()); // Gọi action lấy các thanh toán đang chờ
  }, [dispatch]);

  const handleConfirmPayment = (paymentId, status) => {
  console.log('Confirming payment with ID:', paymentId);  // Log paymentId
  setConfirmLoading(true);

  // Cập nhật trạng thái thanh toán
  dispatch(updatePaymentStatus({ paymentId, status }))
    .then(() => {
      notification.success({ message: `Payment ${status} successfully` });

      // Sau khi xác nhận, tải lại danh sách thanh toán từ API để cập nhật dữ liệu
      dispatch(getPayments());  // Lấy lại dữ liệu thanh toán mới nhất

      setConfirmModalVisible(false);
    })
    .catch((error) => {
      notification.error({ message: 'Error confirming payment', description: error.message });
      setConfirmModalVisible(false);
    })
    .finally(() => setConfirmLoading(false));
};

  const columns = [
    {
      title: 'Payment ID',
      dataIndex: 'PaymentID',
      key: 'PaymentID',
    },
    {
      title: 'User ID',
      dataIndex: 'UserID',
      key: 'UserID',
      render: (text, record) => `User ID: ${record.UserID}`, // Hiển thị UserID
    },
    {
      title: 'Amount (USD)',
      dataIndex: 'Amount',
      key: 'Amount',
      render: amount => `$${amount.toFixed(2)}`,
    },
    {
      title: 'Payment Method',
      dataIndex: 'PaymentMethod',
      key: 'PaymentMethod',
    },
    {
      title: 'Status',
      dataIndex: 'Status',
      key: 'Status',
      render: status => {
        let color = status === 'pending' ? 'orange' : status === 'confirmed' ? 'green' : 'red';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (text, record) => (
        <Button
          type="primary"
          onClick={() => {
            setSelectedPayment(record);
            setConfirmModalVisible(true);
          }}
        >
          Confirm Payment
        </Button>
      ),
    },
  ];

  if (loading) {
    return <Spin size="large" style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }} />;
  }

  return (
    <div>
      <Table
  columns={columns}
  dataSource={payments}
  rowKey={(record) => `${record.PaymentID}-${record.UserID}`}  // Kết hợp PaymentID và UserID để đảm bảo uniqueness
  pagination={false}
  bordered
/>


      <Modal
        title="Confirm Payment"
        visible={confirmModalVisible}
        onCancel={() => setConfirmModalVisible(false)}
        footer={[
          <Button key="back" onClick={() => setConfirmModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="confirm"
            type="primary"
            loading={confirmLoading}
            onClick={() => handleConfirmPayment(selectedPayment.PaymentID, 'confirmed')}
          >
            Confirm
          </Button>,
          <Button
            key="reject"
            type="danger"
            loading={confirmLoading}
            onClick={() => handleConfirmPayment(selectedPayment.PaymentID, 'rejected')}
          >
            Reject
          </Button>,
        ]}
      >
        <p><strong>Payment ID:</strong> {selectedPayment?.PaymentID}</p>
        <p><strong>User ID:</strong> {selectedPayment?.UserID}</p>  {/* Hiển thị UserID */}
        <p><strong>Amount (USD):</strong> ${selectedPayment?.Amount}</p>
        <p><strong>Payment Method:</strong> {selectedPayment?.PaymentMethod}</p>
      </Modal>
    </div>
  );
};

export default AdminPayments;
