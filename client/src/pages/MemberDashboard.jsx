import React, { useState, useEffect } from 'react';
import {
    Layout,
    Card,
    Typography,
    Row,
    Col,
    message,
    Menu,
    Badge,
    Statistic,
    Table,
    Tag,
    Space,
    Button,
    Empty,
    Spin
} from 'antd';
import {
    CalendarOutlined,
    BarChartOutlined,
    HeartOutlined,
    FireOutlined,
    DollarOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Appointments from '../components/member/Appointments';
import ProgressTracking from '../components/member/ProgressTracking';
import SavingsDisplay from '../components/common/SavingsDisplay';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;

const MemberDashboard = () => {
    const [activeMenu, setActiveMenu] = useState('appointments');
    const [memberInfo, setMemberInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        loadMemberInfo();

        // Check if should open appointments tab from navbar
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('tab') === 'appointments') {
            setActiveMenu('appointments');
        }
    }, []);

    const loadMemberInfo = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('memberToken') || localStorage.getItem('token');
            if (!token) {
                navigate('/auth');
                return;
            }

            // Load real data from API
            try {
                // Get progress summary for smoking stats
                const progressResponse = await axios.get('http://localhost:4000/api/progress/summary', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                // Get streak information
                const streakResponse = await axios.get('http://localhost:4000/api/progress/streak', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                // Get user profile
                const profileResponse = await axios.get('http://localhost:4000/api/users/profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (progressResponse.data.success && profileResponse.data.success) {
                    const progressData = progressResponse.data.data;
                    const streakData = streakResponse.data.success ? streakResponse.data.data : {};
                    const userProfile = profileResponse.data.data.userInfo;

                    setMemberInfo({
                        id: userProfile.id,
                        firstName: userProfile.firstName,
                        lastName: userProfile.lastName,
                        email: userProfile.email,
                        avatar: userProfile.avatar,
                        smokingStatus: {
                            daysSinceQuit: streakData.currentStreak || progressData.SmokeFreeDays || 0,
                            cigarettesAvoided: progressData.CigarettesNotSmoked || 0,
                        }
                    });
                } else {
                    throw new Error('Failed to load progress data');
                }

            } catch (apiError) {
                console.error('Error loading real data:', apiError);
                message.warning('Không thể tải dữ liệu từ server. Hiển thị dữ liệu demo...');

                // Fallback to mock data if API fails (without hardcoded money)
                setMemberInfo({
                    id: 1,
                    firstName: 'Nguyễn',
                    lastName: 'Văn A',
                    email: 'member@example.com',
                    avatar: null,
                    smokingStatus: {
                        daysSinceQuit: 7,
                        cigarettesAvoided: 70,
                    }
                });
            }

        } catch (error) {
            console.error('Error loading member info:', error);
            message.error('Không thể tải thông tin thành viên');
        } finally {
            setLoading(false);
        }
    };

    const menuItems = [
        {
            key: 'appointments',
            icon: <CalendarOutlined />,
            label: 'Lịch hẹn tư vấn',
        },
        {
            key: 'progress',
            icon: <BarChartOutlined />,
            label: 'Tiến trình cai thuốc',
        },
    ];

    const renderContent = () => {
        switch (activeMenu) {
            case 'appointments':
                return <Appointments />;
            case 'progress':
                return <ProgressTracking />;
            default:
                return <Appointments />;
        }
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Layout>
                <Sider
                    width={280}
                    style={{
                        background: '#fff',
                        boxShadow: '2px 0 8px rgba(0,0,0,0.1)'
                    }}
                >
                    {/* Member Stats */}
                    {memberInfo?.smokingStatus && (
                        <Card
                            style={{
                                margin: 16,
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #f6f9fc 0%, #e9f4ff 100%)'
                            }}
                        >
                            <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                <Badge count={memberInfo.smokingStatus.daysSinceQuit} showZero color="#52c41a">
                                    <FireOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                                </Badge>
                                <div style={{ marginTop: 8 }}>
                                    <Text strong>Ngày không hút thuốc</Text>
                                </div>
                            </div>

                            <Row gutter={[8, 8]}>
                                <Col span={24}>
                                    <Statistic
                                        title="Điếu thuốc tránh được"
                                        value={memberInfo.smokingStatus.cigarettesAvoided}
                                        prefix={<HeartOutlined />}
                                        valueStyle={{ color: '#cf1322', fontSize: 16 }}
                                    />
                                </Col>
                                <Col span={24}>
                                    {/* Use unified SavingsDisplay component */}
                                    <SavingsDisplay
                                        title="Tiền tiết kiệm"
                                        showDetails={false}
                                        style={{ textAlign: 'center' }}
                                        valueStyle={{ color: '#389e0d', fontSize: 16 }}
                                        prefix={<DollarOutlined />}
                                        suffix="VNĐ"
                                    />
                                </Col>
                            </Row>
                        </Card>
                    )}

                    <Menu
                        mode="inline"
                        selectedKeys={[activeMenu]}
                        onClick={({ key }) => setActiveMenu(key)}
                        style={{
                            border: 'none',
                            padding: '0 16px'
                        }}
                        items={menuItems}
                    />
                </Sider>

                <Layout style={{ padding: 0, background: '#f0f2f5' }}>
                    <Content style={{ margin: 0, overflow: 'auto' }}>
                        {renderContent()}
                    </Content>
                </Layout>
            </Layout>
        </Layout>
    );
};

export default MemberDashboard; 