import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Layout,
    Card,
    Row,
    Col,
    Typography,
    Progress,
    Space,
    Tag,
    Button,
    message,
    Spin,
    Empty,
    Tooltip,
    Badge,
    Divider,
    Alert,
    Result
} from 'antd';
import {
    TrophyOutlined,
    StarOutlined,
    CalendarOutlined,
    DollarOutlined,
    ShareAltOutlined,
    CheckCircleOutlined,
    LockOutlined,
    ExclamationCircleOutlined,
    ReloadOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

const { Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const AchievementPage = () => {
    const { user } = useSelector(state => state.auth);
    const [achievements, setAchievements] = useState([]);
    const [earnedAchievements, setEarnedAchievements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [progressData, setProgressData] = useState(null);
    const [databaseError, setDatabaseError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Helper function to render achievement icon
    const renderAchievementIcon = (achievement, actuallyEarned, shouldShowEligible) => {
        const iconUrl = achievement.IconURL;

        // If no IconURL, show default emojis based on status
        if (!iconUrl) {
            return (
                <span style={{ fontSize: '64px' }}>
                    {actuallyEarned ? '🏆' : shouldShowEligible ? '🎯' : '🔒'}
                </span>
            );
        }

        // If IconURL is already an emoji (length <= 4 and not a path)
        if (iconUrl.length <= 4 && !/^\/|^http|\.png|\.jpg|\.gif|\.svg/i.test(iconUrl)) {
            return <span style={{ fontSize: '64px' }}>{iconUrl}</span>;
        }

        // If IconURL looks like an image path, show actual image
        if (/\/images\/|\/api\/images\/|\.png|\.jpg|\.gif|\.svg/i.test(iconUrl)) {
            return (
                <img
                    src={iconUrl}
                    alt={achievement.Name}
                    style={{
                        width: '64px',
                        height: '64px',
                        objectFit: 'contain',
                        filter: actuallyEarned ? 'none' : shouldShowEligible ? 'none' : 'grayscale(100%) opacity(0.5)'
                    }}
                    onError={(e) => {
                        // Fallback to emoji if image fails to load
                        e.target.outerHTML = `<span style="font-size: 64px">${actuallyEarned ? '🏆' : shouldShowEligible ? '🎯' : '🔒'}</span>`;
                    }}
                />
            );
        }

        // Default case - show emoji
        return (
            <span style={{ fontSize: '64px' }}>
                {actuallyEarned ? '🏆' : shouldShowEligible ? '🎯' : '🔒'}
            </span>
        );
    };

    useEffect(() => {
        if (user) {
            fetchAllData();
        }
    }, [user]);

    const fetchAllData = async () => {
        setLoading(true);
        setDatabaseError(false);
        setErrorMessage('');

        try {
            // Try to fetch achievements with enhanced error handling
            let achievementsData = [];
            try {
                // First try authenticated endpoint
                let achievementsRes;
                const token = localStorage.getItem('token');

                if (token) {
                    try {
                        achievementsRes = await axios.get('/api/achievements/', {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                    } catch (authError) {
                        console.warn('Auth achievements failed, trying public endpoint');
                        achievementsRes = await axios.get('/api/achievements/public');
                    }
                } else {
                    achievementsRes = await axios.get('/api/achievements/public');
                }

                if (achievementsRes.data.success) {
                    achievementsData = achievementsRes.data.data;
                    console.log('✅ Achievements loaded:', achievementsData.length);
                } else {
                    throw new Error('API returned success: false');
                }
            } catch (error) {
                console.error('❌ Achievements API error:', error.response?.status, error.response?.data?.message);

                if (error.response?.status === 500) {
                    setDatabaseError(true);
                    setErrorMessage('Hệ thống huy hiệu chưa được thiết lập. Vui lòng liên hệ admin để chạy script setup.');
                    return; // Exit early if database error
                } else {
                    message.warning('Không thể tải danh sách huy hiệu. Sẽ thử lại sau.');
                }
            }

            // Try to fetch earned achievements
            let earnedData = [];
            try {
                const token = localStorage.getItem('token');
                if (token) {
                    const earnedRes = await axios.get('/api/achievements/earned', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (earnedRes.data.success) {
                        earnedData = earnedRes.data.data;
                        console.log('✅ Earned achievements loaded:', earnedData.length);
                    }
                }
            } catch (error) {
                console.warn('⚠️ Earned achievements API error:', error.response?.status);
            }

            // Try to fetch progress data
            let progressInfo = null;
            try {
                const token = localStorage.getItem('token');
                let progressRes;

                if (token) {
                    try {
                        progressRes = await axios.get('/api/progress/summary', {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                    } catch (authError) {
                        console.warn('Auth progress failed, trying public endpoint');
                        progressRes = await axios.get('/api/progress/public-summary');
                    }
                } else {
                    progressRes = await axios.get('/api/progress/public-summary');
                }

                if (progressRes.data.success) {
                    progressInfo = progressRes.data.data;
                    console.log('✅ Progress data loaded');
                }
            } catch (error) {
                console.warn('⚠️ Progress API error:', error.response?.status);
                // Use dummy data if both auth and public fail
                progressInfo = {
                    SmokeFreeDays: 7,
                    TotalMoneySaved: 350000,
                    TotalDaysTracked: 7
                };
            }

            setAchievements(achievementsData);
            setEarnedAchievements(earnedData);
            setProgressData(progressInfo);

        } catch (error) {
            console.error('❌ Error fetching data:', error);
            setErrorMessage('Có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    const shareAchievement = async (achievement) => {
        try {
            const response = await axios.post('/api/community/share-achievement', {
                achievementId: achievement.AchievementID,
                message: `Tôi vừa đạt được huy hiệu "${achievement.Name}"! 🎉`
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.data.success) {
                message.success('Đã chia sẻ thành tích lên cộng đồng!');
            }
        } catch (error) {
            message.error('Lỗi khi chia sẻ thành tích');
        }
    };

    const fixAchievements = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            if (!token) {
                message.error('Vui lòng đăng nhập để kiểm tra huy hiệu');
                return;
            }

            const response = await axios.post('/api/achievements/fix-unlock', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                message.success(response.data.message);

                if (response.data.newAchievements && response.data.newAchievements.length > 0) {
                    // Show notification for new achievements
                    response.data.newAchievements.forEach(achievement => {
                        message.success(`🏆 Mở khóa huy hiệu: ${achievement.Name}`, 5);
                    });
                }

                // Refresh data
                await fetchAllData();
            } else {
                // Handle case where user doesn't have progress data
                if (response.data.needsProgress) {
                    message.warning('Bạn cần ghi nhật ký tiến trình trước khi có thể nhận huy hiệu!');
                } else {
                    message.info(response.data.message || 'Không có huy hiệu mới để mở khóa');
                }

                // Show debug info if available
                if (response.data.debug) {
                    console.log('🔍 Achievement Debug Info:', response.data.debug);
                }
            }
        } catch (error) {
            console.error('Error fixing achievements:', error);

            if (error.response?.data?.message) {
                message.error(error.response.data.message);
            } else {
                message.error('Lỗi khi kiểm tra huy hiệu: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const clearAchievements = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            if (!token) {
                message.error('Vui lòng đăng nhập để xóa huy hiệu');
                return;
            }

            const response = await axios.post('/api/achievements/clear-my-achievements', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                message.success(response.data.message);
                await fetchAllData();
            } else {
                message.error(response.data.message || 'Lỗi khi xóa huy hiệu');
            }
        } catch (error) {
            console.error('Error clearing achievements:', error);
            message.error('Lỗi khi xóa huy hiệu: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const isAchievementEarned = (achievementId) => {
        return earnedAchievements.some(earned => earned.AchievementID === achievementId);
    };

    const isAchievementEligible = (achievement) => {
        // Check if achievement has IsEligible property from API
        if (achievement.hasOwnProperty('IsEligible')) {
            return achievement.IsEligible === 1;
        }

        // Fallback: check eligibility based on progress data
        if (!progressData) return false;

        // For milestone days achievements
        if (achievement.MilestoneDays !== null) {
            const current = progressData.SmokeFreeDays || 0;
            const required = achievement.MilestoneDays;
            return current >= required;
        }

        // For saved money achievements  
        if (achievement.SavedMoney !== null) {
            const current = progressData.TotalMoneySaved || 0;
            const required = achievement.SavedMoney;
            return current >= required;
        }

        // For special achievements (no specific requirements), check earned status
        if (achievement.MilestoneDays === null && achievement.SavedMoney === null) {
            return isAchievementEarned(achievement.AchievementID);
        }

        return false;
    };

    const getProgressToNextAchievement = (achievement) => {
        if (!progressData) return { progress: 0, total: 100, current: 0 };

        if (achievement.MilestoneDays) {
            const current = progressData.SmokeFreeDays || 0;
            return {
                progress: Math.round(Math.min((current / achievement.MilestoneDays) * 100, 100) * 10) / 10,
                total: achievement.MilestoneDays,
                current
            };
        }

        if (achievement.SavedMoney) {
            const current = progressData.TotalMoneySaved || 0;
            return {
                progress: Math.round(Math.min((current / achievement.SavedMoney) * 100, 100) * 10) / 10,
                total: achievement.SavedMoney,
                current
            };
        }

        return { progress: 0, total: 100, current: 0 };
    };

    const getEarnedDate = (achievementId) => {
        const earned = earnedAchievements.find(e => e.AchievementID === achievementId);
        return earned?.EarnedAt;
    };

    if (loading) {
        return (
            <Content style={{ padding: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Spin size="large" tip="Đang tải huy hiệu..." />
            </Content>
        );
    }

    // Handle database error
    if (databaseError) {
        return (
            <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
                <Content style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                    <Result
                        status="500"
                        title="Hệ thống huy hiệu chưa sẵn sàng"
                        subTitle={errorMessage}
                        icon={<ExclamationCircleOutlined style={{ color: '#faad14' }} />}
                        extra={[
                            <Button
                                type="primary"
                                key="retry"
                                icon={<ReloadOutlined />}
                                onClick={fetchAllData}
                            >
                                Thử lại
                            </Button>,
                            <Button key="back" onClick={() => window.history.back()}>
                                Quay lại
                            </Button>
                        ]}
                    >
                        <div style={{ textAlign: 'left', maxWidth: '500px', margin: '0 auto' }}>
                            <Alert
                                message="Hướng dẫn cho Admin"
                                description={
                                    <div>
                                        <p>Để khắc phục lỗi này, admin cần chạy lệnh sau trên server:</p>
                                        <code style={{
                                            background: '#f5f5f5',
                                            padding: '8px',
                                            borderRadius: '4px',
                                            display: 'block',
                                            marginTop: '8px'
                                        }}>
                                            cd server && node fix-achievements-database.js
                                        </code>
                                        <p style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
                                            Hoặc double-click file run-fix.bat trong thư mục server
                                        </p>
                                    </div>
                                }
                                type="warning"
                                showIcon
                                style={{ marginTop: 16 }}
                            />
                        </div>
                    </Result>
                </Content>
            </Layout>
        );
    }

    // Handle general error
    if (errorMessage && !achievements.length) {
        return (
            <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
                <Content style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                    <Result
                        status="error"
                        title="Không thể tải dữ liệu"
                        subTitle={errorMessage}
                        extra={[
                            <Button
                                type="primary"
                                key="retry"
                                icon={<ReloadOutlined />}
                                onClick={fetchAllData}
                            >
                                Thử lại
                            </Button>
                        ]}
                    />
                </Content>
            </Layout>
        );
    }

    return (
        <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
            <Content style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                <div style={{ marginBottom: 24 }}>
                    <Row justify="space-between" align="middle">
                        <Col>
                            <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
                                🏆 Huy hiệu thành tích
                            </Title>
                            <Text type="secondary">
                                Theo dõi và chia sẻ những thành tích trong hành trình cai thuốc
                            </Text>
                        </Col>
                        <Col>
                            <Space>
                                <Button
                                    type="primary"
                                    icon={<ReloadOutlined />}
                                    onClick={fetchAllData}
                                    loading={loading}
                                >
                                    Làm mới
                                </Button>
                                <Button
                                    type="default"
                                    icon={<TrophyOutlined />}
                                    onClick={fixAchievements}
                                    loading={loading}
                                    style={{ backgroundColor: '#faad14', borderColor: '#faad14', color: 'white' }}
                                >
                                    Kiểm tra huy hiệu
                                </Button>
                                <Button
                                    danger
                                    onClick={clearAchievements}
                                    loading={loading}
                                >
                                    Reset huy hiệu
                                </Button>
                            </Space>
                        </Col>
                    </Row>
                </div>

                {/* Summary Stats */}
                {progressData && (
                    <Card style={{ marginBottom: 24 }}>
                        <Row gutter={[16, 16]}>
                            <Col xs={12} sm={6}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '32px', color: '#52c41a' }}>
                                        {achievements.filter(achievement => {
                                            const isEarned = isAchievementEarned(achievement.AchievementID);
                                            const isEligible = isAchievementEligible(achievement);
                                            return isEarned && isEligible; // Only count if both earned AND eligible
                                        }).length}
                                    </div>
                                    <Text>Huy hiệu đã đạt</Text>
                                </div>
                            </Col>
                            <Col xs={12} sm={6}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '32px', color: '#1890ff' }}>
                                        {progressData.SmokeFreeDays || 0}
                                    </div>
                                    <Text>Ngày không hút</Text>
                                </div>
                            </Col>
                            <Col xs={12} sm={6}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '32px', color: '#faad14' }}>
                                        {Math.round((progressData.TotalMoneySaved || 0) / 1000)}K
                                    </div>
                                    <Text>VNĐ tiết kiệm</Text>
                                </div>
                            </Col>
                            <Col xs={12} sm={6}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '32px', color: '#722ed1' }}>
                                        {Math.round(
                                            achievements.length > 0
                                                ? (achievements.filter(achievement => {
                                                    const isEarned = isAchievementEarned(achievement.AchievementID);
                                                    const isEligible = isAchievementEligible(achievement);
                                                    return isEarned && isEligible; // Only count if both earned AND eligible
                                                }).length / achievements.length) * 100
                                                : 0
                                        )}%
                                    </div>
                                    <Text>Hoàn thành</Text>
                                </div>
                            </Col>
                        </Row>
                    </Card>
                )}

                {/* Achievements Grid */}
                <Row gutter={[16, 16]}>
                    {achievements.map((achievement) => {
                        const isEarned = isAchievementEarned(achievement.AchievementID);
                        const isEligible = isAchievementEligible(achievement);
                        const earnedDate = getEarnedDate(achievement.AchievementID);
                        const progressInfo = getProgressToNextAchievement(achievement);

                        // OVERRIDE: Only show as earned if both database says earned AND user is eligible
                        const actuallyEarned = isEarned && isEligible;
                        const shouldShowEligible = !actuallyEarned && isEligible;
                        const isLocked = !actuallyEarned && !isEligible;

                        return (
                            <Col xs={24} sm={12} lg={8} key={achievement.AchievementID}>
                                <Card
                                    hoverable
                                    style={{
                                        position: 'relative',
                                        opacity: actuallyEarned ? 1 : shouldShowEligible ? 0.9 : 0.5,
                                        border: actuallyEarned
                                            ? '2px solid #52c41a'
                                            : shouldShowEligible
                                                ? '2px solid #faad14'
                                                : '1px solid #d9d9d9',
                                        backgroundColor: actuallyEarned
                                            ? '#f6ffed'
                                            : shouldShowEligible
                                                ? '#fffbe6'
                                                : '#fafafa'
                                    }}
                                    actions={actuallyEarned ? [
                                        <Tooltip title="Chia sẻ thành tích">
                                            <Button
                                                type="text"
                                                icon={<ShareAltOutlined />}
                                                onClick={() => shareAchievement(achievement)}
                                            >
                                                Chia sẻ
                                            </Button>
                                        </Tooltip>
                                    ] : shouldShowEligible ? [
                                        <Tooltip title="Bạn đã đủ điều kiện! Nhấn để mở khóa">
                                            <Button
                                                type="primary"
                                                icon={<TrophyOutlined />}
                                                onClick={fixAchievements}
                                                style={{ backgroundColor: '#faad14', borderColor: '#faad14' }}
                                            >
                                                Mở khóa
                                            </Button>
                                        </Tooltip>
                                    ] : []}
                                >
                                    {actuallyEarned && (
                                        <Badge.Ribbon
                                            text="Đã đạt"
                                            color="green"
                                            style={{
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}
                                        />
                                    )}

                                    {shouldShowEligible && (
                                        <Badge.Ribbon
                                            text="Sẵn sàng mở khóa"
                                            color="orange"
                                            style={{
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}
                                        />
                                    )}

                                    {isLocked && (
                                        <Badge.Ribbon
                                            text="Chưa đủ điều kiện"
                                            color="red"
                                            style={{
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}
                                        />
                                    )}

                                    <div style={{ textAlign: 'center', marginBottom: 16 }}>
                                        <div style={{
                                            marginBottom: 8,
                                            lineHeight: 1,
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center'
                                        }}>
                                            {renderAchievementIcon(achievement, actuallyEarned, shouldShowEligible)}
                                        </div>

                                        <Title level={4} style={{
                                            margin: 0,
                                            color: actuallyEarned
                                                ? '#52c41a'
                                                : shouldShowEligible
                                                    ? '#faad14'
                                                    : '#8c8c8c'
                                        }}>
                                            {actuallyEarned
                                                ? <CheckCircleOutlined />
                                                : shouldShowEligible
                                                    ? <TrophyOutlined />
                                                    : <LockOutlined />
                                            }
                                            {' '}{achievement.Name}
                                        </Title>
                                    </div>

                                    <Paragraph style={{ textAlign: 'center', minHeight: 48 }}>
                                        {achievement.Description}
                                    </Paragraph>

                                    {achievement.MilestoneDays && (
                                        <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text type="secondary">
                                                    <CalendarOutlined /> {achievement.MilestoneDays} ngày không hút
                                                </Text>
                                                <Text style={{
                                                    color: progressInfo.current >= achievement.MilestoneDays ? '#52c41a' : '#8c8c8c',
                                                    fontWeight: progressInfo.current >= achievement.MilestoneDays ? 'bold' : 'normal'
                                                }}>
                                                    {progressInfo.current}/{progressInfo.total}
                                                    {progressInfo.current >= achievement.MilestoneDays && !actuallyEarned && ' ✅'}
                                                </Text>
                                            </div>
                                            <Progress
                                                percent={progressInfo.progress}
                                                size="small"
                                                status={actuallyEarned ? 'success' : progressInfo.current >= achievement.MilestoneDays ? 'normal' : 'active'}
                                                showInfo={true}
                                                format={(percent) => `${percent}%`}
                                                strokeColor={progressInfo.current >= achievement.MilestoneDays ? '#faad14' : undefined}
                                            />
                                        </Space>
                                    )}

                                    {achievement.SavedMoney && (
                                        <Space direction="vertical" style={{ width: '100%', marginBottom: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text type="secondary">
                                                    <DollarOutlined /> {achievement.SavedMoney.toLocaleString('vi-VN')} VNĐ
                                                </Text>
                                                <Text style={{
                                                    color: progressInfo.current >= achievement.SavedMoney ? '#52c41a' : '#8c8c8c',
                                                    fontWeight: progressInfo.current >= achievement.SavedMoney ? 'bold' : 'normal'
                                                }}>
                                                    {Math.round(progressInfo.current).toLocaleString('vi-VN')}/{progressInfo.total.toLocaleString('vi-VN')}
                                                    {progressInfo.current >= achievement.SavedMoney && !actuallyEarned && ' ✅'}
                                                </Text>
                                            </div>
                                            <Progress
                                                percent={progressInfo.progress}
                                                size="small"
                                                status={actuallyEarned ? 'success' : progressInfo.current >= achievement.SavedMoney ? 'normal' : 'active'}
                                                showInfo={true}
                                                format={(percent) => `${percent}%`}
                                                strokeColor={progressInfo.current >= achievement.SavedMoney ? '#faad14' : undefined}
                                            />
                                        </Space>
                                    )}

                                    {actuallyEarned && earnedDate && (
                                        <>
                                            <Divider style={{ margin: '12px 0' }} />
                                            <Text type="secondary" style={{ fontSize: '12px' }}>
                                                <StarOutlined /> Đạt được {formatDistanceToNow(new Date(earnedDate), {
                                                    addSuffix: true,
                                                    locale: vi
                                                })}
                                            </Text>
                                        </>
                                    )}

                                    {!actuallyEarned && !shouldShowEligible && (
                                        <>
                                            <Divider style={{ margin: '12px 0' }} />
                                            <Text type="secondary" style={{ fontSize: '12px', textAlign: 'center' }}>
                                                {achievement.MilestoneDays !== null &&
                                                    `Cần thêm ${Math.max(0, achievement.MilestoneDays - (progressInfo.current || 0))} ngày không hút thuốc`
                                                }
                                                {achievement.SavedMoney !== null &&
                                                    `Cần tiết kiệm thêm ${Math.max(0, achievement.SavedMoney - (progressInfo.current || 0)).toLocaleString('vi-VN')} VNĐ`
                                                }
                                                {achievement.MilestoneDays === null && achievement.SavedMoney === null &&
                                                    'Huy hiệu đặc biệt - cần điều kiện đặc biệt'
                                                }
                                            </Text>
                                        </>
                                    )}

                                    {!actuallyEarned && shouldShowEligible && (
                                        <>
                                            <Divider style={{ margin: '12px 0' }} />
                                            <Text style={{ fontSize: '12px', textAlign: 'center', color: '#faad14', fontWeight: 'bold' }}>
                                                🎉 Bạn đã đủ điều kiện! Nhấn "Mở khóa" để nhận huy hiệu
                                            </Text>
                                        </>
                                    )}
                                </Card>
                            </Col>
                        );
                    })}
                </Row>

                {achievements.length === 0 && (
                    <Card>
                        <Empty
                            description="Chưa có huy hiệu nào"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                    </Card>
                )}
            </Content>
        </Layout>
    );
};

export default AchievementPage; 