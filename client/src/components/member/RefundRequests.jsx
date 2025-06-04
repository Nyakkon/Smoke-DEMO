import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Card,
    Table,
    Typography,
    Tag,
    Space,
    Alert,
    Spin,
    Empty,
    Divider,
    Descriptions,
    Button
} from 'antd';
import {
    BankOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined
} from '@ant-design/icons';
import { getRefundRequests } from '../../store/slices/membershipSlice';

const { Title, Text } = Typography;

const RefundRequests = () => {
    const dispatch = useDispatch();
    const { refundRequests, loading, error } = useSelector(state => state.membership);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadRefundRequests();
    }, [dispatch]);

    const loadRefundRequests = async () => {
        try {
            setRefreshing(true);
            await dispatch(getRefundRequests()).unwrap();
        } catch (error) {
            console.error('Error loading refund requests:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const getStatusTag = (status) => {
        const statusConfig = {
            pending: { color: 'orange', icon: <ClockCircleOutlined />, text: 'Đang chờ xử lý' },
            approved: { color: 'blue', icon: <CheckCircleOutlined />, text: 'Đã duyệt' },
            completed: { color: 'green', icon: <CheckCircleOutlined />, text: 'Đã hoàn tiền' },
            rejected: { color: 'red', icon: <CloseCircleOutlined />, text: 'Đã từ chối' }
        };

        const config = statusConfig[status] || statusConfig.pending;
        return (
            <Tag color={config.color} icon={config.icon}>
                {config.text}
            </Tag>
        );
    };

    const columns = [
        {
            title: 'Thời gian yêu cầu',
            dataIndex: 'RequestedAt',
            key: 'requestedAt',
            render: (date) => new Date(date).toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }),
            width: 150
        },
        {
            title: 'Gói dịch vụ',
            dataIndex: 'PlanName',
            key: 'planName',
            width: 150
        },
        {
            title: 'Số tiền hoàn',
            dataIndex: 'RefundAmount',
            key: 'refundAmount',
            render: (amount) => (
                <Text strong style={{ color: '#52c41a' }}>
                    {amount?.toLocaleString()} VNĐ
                </Text>
            ),
            width: 120
        },
        {
            title: 'Trạng thái',
            dataIndex: 'Status',
            key: 'status',
            render: (status) => getStatusTag(status),
            width: 130
        },
        {
            title: 'Ngân hàng',
            key: 'bankInfo',
            render: (_, record) => (
                <div>
                    <div><Text strong>{record.BankName}</Text></div>
                    <div><Text type="secondary">{record.BankAccountNumber}</Text></div>
                </div>
            ),
            width: 150
        },
        {
            title: 'Hoàn tiền',
            key: 'refundInfo',
            render: (_, record) => {
                if (record.RefundStatus === 'completed') {
                    return (
                        <div>
                            <div><Text type="success">✅ Đã chuyển</Text></div>
                            {record.RefundDate && (
                                <div><Text type="secondary" style={{ fontSize: '12px' }}>
                                    {new Date(record.RefundDate).toLocaleDateString('vi-VN')}
                                </Text></div>
                            )}
                        </div>
                    );
                } else if (record.Status === 'approved') {
                    return <Text type="secondary">Đang xử lý chuyển tiền...</Text>;
                } else if (record.Status === 'rejected') {
                    return <Text type="danger">Đã từ chối</Text>;
                } else {
                    return <Text type="secondary">Chờ duyệt</Text>;
                }
            },
            width: 120
        }
    ];

    if (loading && !refreshing) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100vh' }}>
            <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <Title level={3} style={{ margin: 0 }}>
                        <BankOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
                        Lịch sử yêu cầu hoàn tiền
                    </Title>
                    <Button
                        onClick={loadRefundRequests}
                        loading={refreshing}
                        type="primary"
                        ghost
                    >
                        Làm mới
                    </Button>
                </div>

                {error && (
                    <Alert
                        message="Lỗi"
                        description={error}
                        type="error"
                        style={{ marginBottom: '16px' }}
                        showIcon
                    />
                )}

                <Alert
                    message="Thông tin hoàn tiền"
                    description={
                        <div>
                            <p>• Khi hủy gói dịch vụ, bạn sẽ được hoàn lại 50% số tiền đã thanh toán.</p>
                            <p>• Thời gian xử lý hoàn tiền: 3-5 ngày làm việc sau khi được duyệt.</p>
                            <p>• Tiền sẽ được chuyển vào tài khoản ngân hàng mà bạn cung cấp.</p>
                        </div>
                    }
                    type="info"
                    style={{ marginBottom: '24px' }}
                    showIcon
                />

                {refundRequests && refundRequests.length > 0 ? (
                    <Table
                        columns={columns}
                        dataSource={refundRequests}
                        rowKey="RefundRequestID"
                        pagination={{
                            pageSize: 10,
                            showSizeChanger: false,
                            showQuickJumper: true,
                            showTotal: (total, range) =>
                                `${range[0]}-${range[1]} của ${total} yêu cầu`,
                        }}
                        scroll={{ x: 800 }}
                        expandable={{
                            expandedRowRender: (record) => (
                                <Descriptions
                                    size="small"
                                    column={2}
                                    bordered
                                    style={{ background: '#fafafa' }}
                                >
                                    <Descriptions.Item label="Tên chủ tài khoản">
                                        {record.AccountHolderName}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Lý do hoàn tiền">
                                        {record.RefundReason || 'Hủy gói dịch vụ'}
                                    </Descriptions.Item>
                                    {record.ProcessedAt && (
                                        <Descriptions.Item label="Thời gian xử lý">
                                            {new Date(record.ProcessedAt).toLocaleDateString('vi-VN', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </Descriptions.Item>
                                    )}
                                    {record.AdminNotes && (
                                        <Descriptions.Item label="Ghi chú từ admin" span={2}>
                                            {record.AdminNotes}
                                        </Descriptions.Item>
                                    )}
                                    {record.RefundTransactionID && (
                                        <Descriptions.Item label="Mã giao dịch hoàn tiền" span={2}>
                                            <Text code>{record.RefundTransactionID}</Text>
                                        </Descriptions.Item>
                                    )}
                                </Descriptions>
                            ),
                            rowExpandable: (record) => true,
                        }}
                    />
                ) : (
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="Chưa có yêu cầu hoàn tiền nào"
                    />
                )}
            </Card>
        </div>
    );
};

export default RefundRequests; 