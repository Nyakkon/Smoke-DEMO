import React, { useState, useEffect } from 'react';
import { Statistic, Alert, Spin } from 'antd';
import { DollarOutlined } from '@ant-design/icons';
import axios from 'axios';

const SavingsDisplay = ({
    title = "Tiền tiết kiệm",
    showDetails = false,
    style = {},
    valueStyle = { color: '#52c41a' },
    prefix = <DollarOutlined />,
    suffix = "VNĐ"
}) => {
    const [savingsData, setSavingsData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadSavingsData();
    }, []);

    const loadSavingsData = async () => {
        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem('memberToken') || localStorage.getItem('token');

            let response;

            if (token) {
                try {
                    // Try authenticated endpoint first
                    response = await axios.get('http://localhost:4000/api/progress/summary', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                } catch (authError) {
                    // Fallback to public endpoint if auth fails
                    console.warn('Auth failed, using public endpoint:', authError.response?.status);
                    response = await axios.get('http://localhost:4000/api/progress/public-summary');
                }
            } else {
                // Use public endpoint if no token
                response = await axios.get('http://localhost:4000/api/progress/public-summary');
            }

            if (response.data.success) {
                setSavingsData({
                    totalMoneySaved: response.data.data.TotalMoneySaved || 0,
                    daysTracked: response.data.data.TotalDaysTracked || 0,
                    cigarettesNotSmoked: response.data.data.CigarettesNotSmoked || 0,
                    smokeFreePercentage: response.data.data.SmokeFreePercentage || 0,
                    calculation: response.data.data.calculation,
                    isDemo: response.data.data.calculation?.isDemo || false
                });
            } else {
                throw new Error('API returned unsuccessful response');
            }

        } catch (error) {
            console.error('Error loading savings data:', error);
            setError(error.message);

            // Fallback to realistic demo data
            setSavingsData({
                totalMoneySaved: 105000, // 7 days × 10 cigarettes × 1500 VNĐ
                daysTracked: 7,
                cigarettesNotSmoked: 70,
                smokeFreePercentage: 100,
                calculation: {
                    description: "7 ngày × 10 điếu/ngày × 1,500 VNĐ/điếu (Demo)",
                    isDemo: true
                },
                isDemo: true
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <Spin size="small" />;
    }

    if (error && !savingsData) {
        return (
            <Alert
                message="Lỗi tải dữ liệu"
                type="error"
                size="small"
                showIcon
            />
        );
    }

    const formatValue = (value) => {
        return value.toLocaleString('vi-VN');
    };

    return (
        <div style={style}>
            <Statistic
                title={title}
                value={savingsData.totalMoneySaved}
                prefix={prefix}
                suffix={suffix}
                valueStyle={valueStyle}
                formatter={(value) => formatValue(value)}
            />

            {showDetails && savingsData && (
                <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                    <div>{savingsData.cigarettesNotSmoked} điếu không hút</div>
                    <div>{savingsData.daysTracked} ngày theo dõi</div>
                    {savingsData.calculation?.description && (
                        <div style={{ marginTop: 4, fontStyle: 'italic' }}>
                            {savingsData.calculation.description}
                        </div>
                    )}
                    {savingsData.isDemo && (
                        <div style={{ color: '#faad14', fontWeight: 'bold' }}>
                            (Dữ liệu demo)
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SavingsDisplay; 