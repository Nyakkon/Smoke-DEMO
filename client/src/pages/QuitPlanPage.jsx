import React, { useState, useEffect } from 'react';
import {
    Form,
    Input,
    Button,
    Card,
    Typography,
    message,
    Spin,
    DatePicker,
    InputNumber,
    Alert,
    Space,
    Divider,
    Row,
    Col,
    List,
    Tag,
    Tabs,
    Progress,
    Statistic,
    notification,
    Badge
} from 'antd';
import {
    CalendarOutlined,
    HeartOutlined,
    BulbOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    PlusOutlined,
    BookOutlined,
    TrophyOutlined,
    DollarOutlined,
    FireOutlined,
    SmileOutlined,
    SaveOutlined,
    LineChartOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { format, differenceInDays, parseISO } from 'date-fns';
import dayjs from 'dayjs';


const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

// Create axios instance with defaults
const api = axios.create({
    baseURL: 'http://localhost:4000',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    withCredentials: false, // Change to false to avoid CORS issues
    timeout: 10000 // 10 second timeout
});

// Add token to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        console.log('API Request:', config.method?.toUpperCase(), config.url);
        return config;
    },
    (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
    }
);

// Add response interceptor for better error handling
api.interceptors.response.use(
    (response) => {
        console.log('API Response:', response.status, response.config.url);
        return response;
    },
    (error) => {
        console.error('API Error:', {
            url: error.config?.url,
            status: error.response?.status,
            message: error.message,
            data: error.response?.data
        });
        return Promise.reject(error);
    }
);

const QuitPlanPage = () => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [existingPlans, setExistingPlans] = useState([]);
    const [planTemplate, setPlanTemplate] = useState([]);
    const [paymentInfo, setPaymentInfo] = useState(null);
    const [error, setError] = useState(null);
    const [hasAccess, setHasAccess] = useState(false);
    const [userInfo, setUserInfo] = useState(null);
    const [activeTab, setActiveTab] = useState('plan');
    const [justCreatedPlan, setJustCreatedPlan] = useState(false);

    // Check access and load data
    useEffect(() => {
        const checkAccessAndLoadData = async () => {
            try {
                setLoading(true);
                setError(null);

                console.log('🔍 Checking access and loading data...');

                // Check if user is logged in
                const token = localStorage.getItem('token');
                if (!token) {
                    console.log('❌ No token found, trying to test server first...');

                    // Test server connection first
                    try {
                        const testResponse = await api.get('/api/test-user-data');
                        console.log('✅ Server is running, test data:', testResponse.data);

                        // Try to get templates without auth
                        const templatesResponse = await api.get('/api/quit-plan/templates/all');
                        if (templatesResponse.data?.success) {
                            setPlanTemplate(templatesResponse.data.data || []);
                            console.log('✅ Got templates without auth');
                        }
                    } catch (serverError) {
                        console.error('❌ Server test failed:', serverError);
                    }

                    setError('Bạn cần đăng nhập để truy cập trang này. Tuy nhiên server đang chạy và có data.');
                    setLoading(false);
                    return;
                }

                console.log('🔑 Token found, making authenticated request...');

                // Try to get existing quit plans (this will also check access)
                try {
                    const response = await api.get('/api/quit-plan');
                    console.log('✅ Quit plan response:', response.data);

                    setExistingPlans(response.data.data || []);
                    setPlanTemplate(response.data.planTemplate || []);
                    setPaymentInfo(response.data.paymentInfo || null);
                    setHasAccess(true);

                    // 🔍 DEBUG: Log template data
                    console.log('🔍 DEBUG - planTemplate data:', response.data.planTemplate);
                    console.log('🔍 DEBUG - planTemplate length:', response.data.planTemplate?.length);
                    console.log('🔍 DEBUG - paymentInfo:', response.data.paymentInfo);
                    console.log('🔍 DEBUG - Full response:', response.data);

                    // If user has existing plans, populate the form with the latest active plan
                    const activePlans = response.data.data.filter(plan => plan.Status === 'active');
                    if (activePlans.length > 0) {
                        const latestPlan = activePlans[0];
                        form.setFieldsValue({
                            startDate: latestPlan.StartDate ? dayjs(latestPlan.StartDate) : null,
                            targetDate: latestPlan.TargetDate ? dayjs(latestPlan.TargetDate) : null,
                            reason: latestPlan.Reason,
                            motivationLevel: latestPlan.MotivationLevel,
                            detailedPlan: latestPlan.DetailedPlan
                        });
                    } else if (response.data.planTemplate && response.data.planTemplate.length > 0) {
                        // Auto-fill detailed plan with template if no existing plans
                        const templateText = response.data.planTemplate.map((phase, index) =>
                            `${phase.PhaseName || phase.phaseName}:\n${phase.PhaseDescription || phase.phaseDescription}\n`
                        ).join('\n');

                        form.setFieldsValue({
                            detailedPlan: templateText
                        });
                    }
                } catch (planError) {
                    console.error('❌ Error accessing quit plan:', planError);

                    if (planError.response?.status === 403) {
                        setError(planError.response.data.message || 'Bạn không có quyền truy cập tính năng này');
                    } else if (planError.response?.status === 401) {
                        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại');
                        localStorage.removeItem('token');
                    } else {
                        setError('Không thể tải dữ liệu. Vui lòng thử lại sau');
                    }
                    setHasAccess(false);

                    // 🔧 DEBUG: Try to load templates anyway for debugging
                    console.log('🔧 DEBUG: Loading templates without auth for debugging...');
                    try {
                        const fallbackTemplatesResponse = await api.get('/api/quit-plan/templates/all');
                        if (fallbackTemplatesResponse.data?.success && fallbackTemplatesResponse.data.data?.length > 0) {
                            // Find Premium Plan templates
                            const premiumPlan = fallbackTemplatesResponse.data.data.find(plan => plan.planInfo.planName === 'Premium Plan');
                            if (premiumPlan) {
                                setPlanTemplate(premiumPlan.phases);
                                setPaymentInfo({ PlanName: 'Premium Plan (Debug)' });
                                console.log('✅ DEBUG: Loaded Premium Plan templates:', premiumPlan.phases);
                            }
                        }
                    } catch (fallbackError) {
                        console.error('❌ DEBUG: Fallback template loading failed:', fallbackError);
                    }
                }

                setLoading(false);
            } catch (error) {
                console.error('❌ Error in checkAccessAndLoadData:', error);
                setError('Đã có lỗi xảy ra. Vui lòng thử lại sau');
                setLoading(false);
            }
        };

        checkAccessAndLoadData();
    }, [form]);

    const handleUseTemplate = () => {
        // Use hardcoded template data for now
        const templateData = [
            {
                phaseName: "Tuần 1-2: Detox và chuẩn bị",
                phaseDescription: "• Thực hiện detox cơ thể với chế độ ăn uống lành mạnh\n• Bắt đầu chương trình tập luyện thể chất\n• Thiết lập hệ thống hỗ trợ từ gia đình và bạn bè\n• Học các kỹ thuật thư giãn: thiền, yoga\n• Ghi chép chi tiết về triggers và cách đối phó"
            },
            {
                phaseName: "Tuần 3-4: Xây dựng thói quen mới",
                phaseDescription: "• Phát triển hobby mới để thay thế thời gian hút thuốc\n• Tham gia các nhóm hỗ trợ trực tuyến/offline\n• Áp dụng kỹ thuật CBT (Cognitive Behavioral Therapy)\n• Theo dõi cải thiện sức khỏe: huyết áp, nhịp tim\n• Lập kế hoạch tài chính từ tiền tiết kiệm"
            },
            {
                phaseName: "Tuần 5-6: Đối phó với khó khăn",
                phaseDescription: "• Nhận diện và xử lý các tình huống nguy hiểm\n• Phát triển kỹ năng quản lý stress nâng cao\n• Tạo động lực dài hạn với mục tiêu cụ thể\n• Đánh giá tiến bộ và điều chỉnh kế hoạch\n• Chuẩn bị tâm lý cho giai đoạn duy trì"
            },
            {
                phaseName: "Tuần 7-8: Duy trì và phát triển",
                phaseDescription: "• Ổn định lối sống không thuốc lá\n• Mở rộng mạng lưới hỗ trợ xã hội\n• Theo dõi và cải thiện sức khỏe tinh thần\n• Lập kế hoạch phòng ngừa tái phát\n• Chia sẻ kinh nghiệm để giúp người khác"
            }
        ];

        const templateText = templateData.map((phase, index) =>
            `${phase.phaseName}:\n${phase.phaseDescription}\n`
        ).join('\n');

        form.setFieldsValue({
            detailedPlan: templateText
        });

        message.success('Đã áp dụng kế hoạch mẫu Premium Plan vào form! 🎯');
    };

    const handleSubmit = async (values) => {
        try {
            setSubmitting(true);

            console.log('📝 Form values received:', values);

            // Safe date conversion function
            const formatDate = (dateValue) => {
                try {
                    if (!dateValue) return null;

                    console.log('🗓️ Converting date:', dateValue, 'Type:', typeof dateValue);

                    // Handle different date formats from Ant Design DatePicker
                    let date;
                    if (dateValue._isAMomentObject || dateValue.format) {
                        // Moment object
                        console.log('📅 Detected Moment object');
                        date = dateValue.toDate();
                    } else if (dateValue.$d) {
                        // Day.js object  
                        console.log('📅 Detected Day.js object');
                        date = new Date(dateValue.$d);
                    } else if (dateValue instanceof Date) {
                        // Already a Date object
                        console.log('📅 Already a Date object');
                        date = dateValue;
                    } else {
                        // Try to parse as string
                        console.log('📅 Parsing as string/unknown format');
                        date = new Date(dateValue);
                    }

                    // Validate date
                    if (isNaN(date.getTime())) {
                        throw new Error(`Invalid date value: ${dateValue}`);
                    }

                    const formatted = format(date, 'yyyy-MM-dd');
                    console.log('✅ Formatted date:', formatted);
                    return formatted;
                } catch (error) {
                    console.error('❌ Error formatting date:', error);
                    throw new Error(`Không thể chuyển đổi ngày: ${error.message}`);
                }
            };

            const submitData = {
                startDate: formatDate(values.startDate),
                targetDate: formatDate(values.targetDate),
                reason: values.reason,
                motivationLevel: values.motivationLevel,
                detailedPlan: values.detailedPlan || ''
            };

            console.log('📤 Submitting quit plan:', submitData);

            // Validate required fields
            if (!submitData.startDate || !submitData.targetDate) {
                message.error('Vui lòng chọn ngày bắt đầu và ngày mục tiêu');
                setSubmitting(false);
                return;
            }

            // Validate date logic
            const startDate = new Date(submitData.startDate);
            const targetDate = new Date(submitData.targetDate);
            if (targetDate <= startDate) {
                message.error('Ngày mục tiêu phải sau ngày bắt đầu');
                setSubmitting(false);
                return;
            }

            const response = await api.post('/api/quit-plan', submitData);
            console.log('✅ Submit response:', response);

            message.success('Kế hoạch cai thuốc đã được tạo thành công!');

            // Reload data to show new plan
            const updatedPlans = await api.get('/api/quit-plan');
            setExistingPlans(updatedPlans.data.data || []);

            // Mark that a plan was just created successfully
            setJustCreatedPlan(true);

            // Switch to progress tab after creating plan and show encouraging message
            setActiveTab('progress');

            // Show encouraging notification
            setTimeout(() => {
                notification.success({
                    message: '🎉 Kế hoạch đã được tạo!',
                    description: 'Bây giờ hãy bắt đầu ghi nhật ký tiến trình hàng ngày để Coach có thể theo dõi và hỗ trợ bạn tốt nhất.',
                    duration: 6,
                    placement: 'topRight'
                });
            }, 1000);

            setSubmitting(false);
        } catch (error) {
            console.error('❌ Error submitting quit plan:', error);
            message.error(error.response?.data?.message || 'Có lỗi xảy ra khi tạo kế hoạch. Vui lòng thử lại sau.');
            setSubmitting(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'green';
            case 'completed': return 'blue';
            case 'cancelled': return 'red';
            default: return 'default';
        }
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'active': return 'Đang thực hiện';
            case 'completed': return 'Hoàn thành';
            case 'cancelled': return 'Đã hủy';
            default: return 'Không xác định';
        }
    };

    const calculateDaysToTarget = (targetDate) => {
        const target = parseISO(targetDate);
        const today = new Date();
        return differenceInDays(target, today);
    };

    const handleRetry = () => {
        window.location.reload();
    };

    const handleTestLogin = async () => {
        try {
            console.log('🔑 Testing login...');
            const response = await api.post('/api/test-login', {
                email: 'leghenkiz@gmail.com',
                password: 'H12345678@'
            });

            if (response.data?.success && response.data?.token) {
                localStorage.setItem('token', response.data.token);
                console.log('✅ Test login successful');
                message.success('Đăng nhập thành công! Đang tải lại trang...');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        } catch (error) {
            console.error('❌ Test login failed:', error);
            message.error('Đăng nhập thất bại: ' + (error.response?.data?.message || error.message));
        }
    };

    // Progress Logs Component
    const ProgressLogs = ({ hasAccess, existingPlans, setActiveTab }) => {
        const [progressForm] = Form.useForm();
        const [loadingProgress, setLoadingProgress] = useState(false);
        const [submittingProgress, setSubmittingProgress] = useState(false);
        const [todayProgress, setTodayProgress] = useState(null);
        const [progressSummary, setSummary] = useState(null);
        const [progressAdvice, setAdvice] = useState(null);
        const [progressSavings, setSavings] = useState(null);
        const [streakInfo, setStreakInfo] = useState(null);
        const [recentProgress, setRecentProgress] = useState([]);

        useEffect(() => {
            if (hasAccess) {
                loadProgressData();
            }
        }, [hasAccess]);

        const loadProgressData = async () => {
            try {
                setLoadingProgress(true);

                // Load all progress data - Use summary instead of savings for consistency
                const [todayRes, summaryRes, adviceRes, streakRes, recentRes] = await Promise.all([
                    api.get('/api/progress/today').catch(e => ({ data: { success: false } })),
                    api.get('/api/progress/summary').catch(e => ({ data: { success: false } })),
                    api.get('/api/progress/advice').catch(e => ({ data: { success: false } })),
                    api.get('/api/progress/streak').catch(e => ({ data: { success: false } })),
                    api.get('/api/progress/range?startDate=' + dayjs().subtract(7, 'days').format('YYYY-MM-DD') + '&endDate=' + dayjs().format('YYYY-MM-DD')).catch(e => ({ data: { success: false } }))
                ]);

                if (todayRes.data.success) {
                    setTodayProgress(todayRes.data.data);
                    if (todayRes.data.data) {
                        progressForm.setFieldsValue({
                            cigarettesSmoked: todayRes.data.data.CigarettesSmoked,
                            cravingLevel: todayRes.data.data.CravingLevel,
                            emotionNotes: todayRes.data.data.EmotionNotes
                        });
                    }
                }

                if (summaryRes.data.success) {
                    setSummary(summaryRes.data.data);
                    // Use summary data for savings too - this ensures consistency
                    setSavings({
                        totalMoneySaved: summaryRes.data.data.TotalMoneySaved || 0,
                        cigarettesNotSmoked: summaryRes.data.data.CigarettesNotSmoked || 0,
                        daysTracked: summaryRes.data.data.TotalDaysTracked || 0,
                        dailyAverageSavings: summaryRes.data.data.TotalDaysTracked > 0 ?
                            (summaryRes.data.data.TotalMoneySaved || 0) / summaryRes.data.data.TotalDaysTracked : 0
                    });
                }
                if (adviceRes.data.success) setAdvice(adviceRes.data);
                if (streakRes.data.success) setStreakInfo(streakRes.data.data);
                if (recentRes.data.success) setRecentProgress(recentRes.data.data);

            } catch (error) {
                console.error('Error loading progress data:', error);
                message.error('Không thể tải dữ liệu tiến trình');
            } finally {
                setLoadingProgress(false);
            }
        };

        const handleProgressSubmit = async (values) => {
            try {
                setSubmittingProgress(true);
                const today = dayjs().format('YYYY-MM-DD');

                const response = await api.post('/api/progress', {
                    date: today,
                    cigarettesSmoked: values.cigarettesSmoked,
                    cravingLevel: values.cravingLevel,
                    emotionNotes: values.emotionNotes || ''
                });

                if (response.data.success) {
                    message.success('Đã ghi nhận tiến trình hôm nay thành công!');

                    // Show calculations
                    const { calculations } = response.data;
                    if (calculations) {
                        notification.success({
                            message: 'Tiến trình đã được lưu',
                            description: `Tiền tiết kiệm hôm nay: ${calculations.moneySaved?.toLocaleString() || 0} VND. Tổng ngày không hút: ${calculations.daysSmokeFree || 0} ngày.`,
                            duration: 5
                        });
                    }

                    // Reload data
                    await loadProgressData();
                }
            } catch (error) {
                console.error('Error submitting progress:', error);
                if (error.response?.status === 403) {
                    message.error(error.response.data.message || 'Bạn không có quyền truy cập tính năng này');
                } else {
                    message.error('Có lỗi xảy ra khi ghi nhận tiến trình');
                }
            } finally {
                setSubmittingProgress(false);
            }
        };

        if (!hasAccess) {
            return (
                <Card>
                    <div className="text-center py-8">
                        <ExclamationCircleOutlined className="text-4xl text-orange-500 mb-4" />
                        <Title level={4}>Chưa có quyền truy cập</Title>
                        <Text>Bạn cần có gói dịch vụ được xác nhận để sử dụng tính năng ghi nhật ký tiến trình.</Text>
                    </div>
                </Card>
            );
        }

        if (loadingProgress) {
            return (
                <Card>
                    <div className="text-center py-8">
                        <Spin size="large" tip="Đang tải dữ liệu tiến trình..." />
                    </div>
                </Card>
            );
        }

        return (
            <div className="space-y-6">
                {/* Thông báo hướng dẫn nếu chưa có kế hoạch */}
                {(!existingPlans || existingPlans.length === 0) && (
                    <Alert
                        message="🎯 Bạn chưa có kế hoạch cai thuốc!"
                        description={
                            <div>
                                <Text>
                                    Để theo dõi tiến trình hiệu quả, bạn nên tạo kế hoạch cai thuốc trước.
                                    Hãy chuyển sang tab{' '}
                                    <Text strong className="text-green-600">&quot;Kế hoạch&quot;</Text>{' '}
                                    để thiết lập mục tiêu và lộ trình chi tiết.
                                </Text>
                                <div className="mt-2">
                                    <Button
                                        type="link"
                                        size="small"
                                        icon={<PlusOutlined />}
                                        onClick={() => setActiveTab('plan')}
                                        className="p-0 h-auto"
                                    >
                                        Tạo kế hoạch cai thuốc →
                                    </Button>
                                </div>
                            </div>
                        }
                        type="warning"
                        showIcon
                        className="mb-4"
                        style={{
                            borderColor: '#faad14',
                            backgroundColor: '#fffbe6'
                        }}
                    />
                )}

                {/* Today's Progress Entry */}
                <Card title={<><SaveOutlined className="mr-2" />Ghi nhận tiến trình hôm nay</>}>
                    {todayProgress && (
                        <Alert
                            message="Bạn đã ghi nhận tiến trình hôm nay"
                            description="Bạn có thể cập nhật lại thông tin nếu cần."
                            type="info"
                            showIcon
                            className="mb-4"
                        />
                    )}

                    <Form
                        form={progressForm}
                        layout="vertical"
                        onFinish={handleProgressSubmit}
                        className="max-w-md"
                    >
                        <Form.Item
                            label="Số điếu hút hôm nay"
                            name="cigarettesSmoked"
                            rules={[
                                { required: true, message: 'Vui lòng nhập số điếu hút' },
                                { type: 'number', min: 0, message: 'Số điếu không được âm' }
                            ]}
                        >
                            <InputNumber
                                min={0}
                                style={{ width: '100%' }}
                                placeholder="Nhập số điếu hút hôm nay"
                                addonAfter="điếu"
                            />
                        </Form.Item>

                        <Form.Item
                            label="Mức độ thèm thuốc (1-10)"
                            name="cravingLevel"
                            rules={[
                                { required: true, message: 'Vui lòng đánh giá mức độ thèm thuốc' },
                                { type: 'number', min: 1, max: 10, message: 'Mức độ phải từ 1-10' }
                            ]}
                        >
                            <InputNumber
                                min={1}
                                max={10}
                                style={{ width: '100%' }}
                                placeholder="1 = rất thấp, 10 = rất cao"
                            />
                        </Form.Item>

                        <Form.Item
                            label="Ghi chú cảm xúc"
                            name="emotionNotes"
                        >
                            <TextArea
                                rows={3}
                                placeholder="Mô tả cảm xúc, tình trạng tinh thần, các tình huống khó khăn hôm nay..."
                            />
                        </Form.Item>

                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={submittingProgress}
                                icon={<SaveOutlined />}
                                size="large"
                            >
                                Ghi nhận tiến trình
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>

                {/* Progress Summary Cards */}
                <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12} md={6}>
                        <Card className="text-center">
                            <FireOutlined className="text-2xl text-red-500 mb-2" />
                            <Statistic
                                title="Chuỗi ngày không hút"
                                value={streakInfo?.currentStreak || 0}
                                suffix="ngày"
                                valueStyle={{ color: '#f56a00' }}
                            />
                            <Text className="text-sm text-gray-500">
                                Kỷ lục: {streakInfo?.longestStreak || 0} ngày
                            </Text>
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} md={6}>
                        <Card className="text-center">
                            <DollarOutlined className="text-2xl text-green-500 mb-2" />
                            <Statistic
                                title="Tiền tiết kiệm"
                                value={progressSavings?.totalMoneySaved || 0}
                                suffix="VND"
                                valueStyle={{ color: '#52c41a' }}
                            />
                            <Text className="text-sm text-gray-500">
                                {progressSavings?.cigarettesNotSmoked || 0} điếu không hút
                            </Text>
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} md={6}>
                        <Card className="text-center">
                            <TrophyOutlined className="text-2xl text-blue-500 mb-2" />
                            <Statistic
                                title="Ngày không hút"
                                value={progressSummary?.SmokeFreeDays || 0}
                                suffix={`/ ${progressSummary?.TotalDaysTracked || 0}`}
                                valueStyle={{ color: '#1890ff' }}
                            />
                            <Progress
                                percent={progressSummary?.SmokeFreePercentage || 0}
                                size="small"
                                showInfo={false}
                            />
                        </Card>
                    </Col>

                    <Col xs={24} sm={12} md={6}>
                        <Card className="text-center">
                            <SmileOutlined className="text-2xl text-purple-500 mb-2" />
                            <Statistic
                                title="Mức thèm trung bình"
                                value={progressSummary?.AverageCravingLevel || 0}
                                suffix="/ 10"
                                precision={1}
                                valueStyle={{ color: '#722ed1' }}
                            />
                            <Text className="text-sm text-gray-500">
                                {progressSummary?.TotalDaysTracked || 0} ngày theo dõi
                            </Text>
                        </Card>
                    </Col>
                </Row>

                {/* Advice Card */}
                {progressAdvice && (
                    <Card title={<><BulbOutlined className="mr-2" />Lời khuyên dành cho bạn</>}>
                        <Alert
                            message={progressAdvice.advice}
                            type={progressAdvice.type === 'excellent' ? 'success' :
                                progressAdvice.type === 'craving' ? 'warning' : 'info'}
                            showIcon
                            className="mb-4"
                        />
                        {progressAdvice.basedOn && (
                            <Text className="text-sm text-gray-500">
                                Dựa trên: {progressAdvice.basedOn.cigarettesSmoked} điếu hút,
                                mức thèm {progressAdvice.basedOn.cravingLevel}/10
                                {progressAdvice.logDate && ` - ${format(parseISO(progressAdvice.logDate), 'dd/MM/yyyy')}`}
                            </Text>
                        )}
                    </Card>
                )}

                {/* Recent Progress */}
                <Card title={<><LineChartOutlined className="mr-2" />Tiến trình 7 ngày gần đây</>}>
                    {recentProgress.length === 0 ? (
                        <div className="text-center py-8">
                            <Text className="text-gray-500">Chưa có dữ liệu tiến trình</Text>
                        </div>
                    ) : (
                        <List
                            dataSource={recentProgress}
                            renderItem={(item) => (
                                <List.Item>
                                    <Card size="small" className="w-full">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <Text strong>{format(parseISO(item.Date), 'dd/MM/yyyy')}</Text>
                                                <br />
                                                <Space>
                                                    <Tag color={item.CigarettesSmoked === 0 ? 'green' : 'orange'}>
                                                        {item.CigarettesSmoked} điếu
                                                    </Tag>
                                                    <Tag color="blue">
                                                        Thèm: {item.CravingLevel}/10
                                                    </Tag>
                                                    {item.MoneySaved > 0 && (
                                                        <Tag color="gold">
                                                            +{item.MoneySaved?.toLocaleString()} VND
                                                        </Tag>
                                                    )}
                                                </Space>
                                            </div>
                                            {item.CigarettesSmoked === 0 && (
                                                <CheckCircleOutlined className="text-green-500 text-lg" />
                                            )}
                                        </div>
                                        {item.EmotionNotes && (
                                            <Paragraph className="mt-2 mb-0 text-sm" ellipsis={{ rows: 2 }}>
                                                <em>"{item.EmotionNotes}"</em>
                                            </Paragraph>
                                        )}
                                    </Card>
                                </List.Item>
                            )}
                        />
                    )}
                </Card>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Spin size="large" tip="Đang tải thông tin kế hoạch..." />
            </div>
        );
    }

    if (error || !hasAccess) {
        return (
            <div className="container mx-auto py-8 px-4">
                <Card className="shadow-lg rounded-lg max-w-2xl mx-auto">
                    <div className="text-center">
                        <ExclamationCircleOutlined className="text-4xl text-red-500 mb-4" />
                        <Title level={3}>Không thể truy cập</Title>

                        {error && (
                            <Alert
                                message="Lỗi truy cập"
                                description={error}
                                type="error"
                                showIcon
                                className="mb-4"
                            />
                        )}

                        <Paragraph className="text-gray-600 mb-6">
                            Để truy cập tính năng "Lập kế hoạch cai thuốc", bạn cần:
                        </Paragraph>

                        <div className="text-left bg-gray-50 p-4 rounded-lg mb-6">
                            <ul className="list-disc list-inside space-y-2">
                                <li>Đã đăng ký và <strong>thanh toán gói dịch vụ</strong> được xác nhận</li>
                                <li>Hoặc có role <strong>Coach/Admin</strong></li>
                            </ul>
                        </div>

                        <Space>
                            <Button type="primary" onClick={handleRetry}>
                                Thử lại
                            </Button>
                            <Button type="default" onClick={handleTestLogin}>
                                Test Login
                            </Button>
                            <Button onClick={() => window.location.href = '/membership'}>
                                Xem gói dịch vụ
                            </Button>
                        </Space>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4">
            <div className="max-w-6xl mx-auto">
                <Card className="shadow-lg rounded-lg mb-6">
                    <div className="text-center mb-8">
                        <BulbOutlined className="text-4xl text-blue-500 mb-4" />
                        <Title level={2}>Lập Kế Hoạch Cai Thuốc</Title>
                        <Paragraph className="text-gray-600 text-lg">
                            Tạo một kế hoạch chi tiết để hỗ trợ hành trình cai thuốc của bạn
                        </Paragraph>

                        {paymentInfo && (
                            <div className="bg-green-50 p-4 rounded-lg mt-4">
                                <Text className="text-green-700">
                                    🎉 Bạn đã đăng ký gói <strong>{paymentInfo.PlanName}</strong> thành công!
                                    Hãy tận dụng kế hoạch mẫu chuyên nghiệp bên dưới.
                                </Text>
                            </div>
                        )}
                    </div>

                    <Tabs
                        activeKey={activeTab}
                        onChange={(key) => {
                            setActiveTab(key);
                            // Reset justCreatedPlan when switching tabs
                            if (key !== 'plan') {
                                setJustCreatedPlan(false);
                            }
                        }}
                        type="card"
                        size="large"
                        className="custom-tabs"
                    >
                        <TabPane
                            tab={
                                <span>
                                    <PlusOutlined />
                                    Kế hoạch
                                    {existingPlans.length > 0 && (
                                        <Badge
                                            count={existingPlans.length}
                                            size="small"
                                            style={{ marginLeft: 8 }}
                                        />
                                    )}
                                </span>
                            }
                            key="plan"
                        >
                            <Row gutter={[24, 24]}>
                                {/* Form tạo kế hoạch */}
                                <Col xs={24} lg={14}>
                                    <Card title={<><PlusOutlined /> Tạo kế hoạch mới</>} className="h-full">
                                        {planTemplate && planTemplate.length > 0 && (
                                            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <Text strong>Kế hoạch mẫu cho gói {paymentInfo?.PlanName}</Text>
                                                        <br />
                                                        <Text className="text-sm text-gray-600">
                                                            {planTemplate.length} giai đoạn chi tiết
                                                        </Text>
                                                    </div>
                                                    <Button
                                                        type="primary"
                                                        size="small"
                                                        onClick={handleUseTemplate}
                                                    >
                                                        Áp dụng mẫu
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        <Form
                                            form={form}
                                            layout="vertical"
                                            onFinish={handleSubmit}
                                            onFinishFailed={(errorInfo) => {
                                                console.error('❌ Form validation failed:', errorInfo);
                                                message.error('Vui lòng kiểm tra và điền đầy đủ thông tin bắt buộc');
                                            }}
                                            className="space-y-4"
                                        >
                                            <Row gutter={16}>
                                                <Col xs={24} sm={12}>
                                                    <Form.Item
                                                        label={
                                                            <span>
                                                                <CalendarOutlined className="mr-2" />
                                                                Ngày bắt đầu
                                                            </span>
                                                        }
                                                        name="startDate"
                                                        rules={[{ required: true, message: 'Vui lòng chọn ngày bắt đầu' }]}
                                                    >
                                                        <DatePicker
                                                            style={{ width: '100%' }}
                                                            placeholder="Chọn ngày bắt đầu"
                                                            format="DD/MM/YYYY"
                                                            disabledDate={(current) => {
                                                                // Disable dates before today
                                                                return current && current < dayjs().startOf('day');
                                                            }}
                                                        />
                                                    </Form.Item>
                                                </Col>

                                                <Col xs={24} sm={12}>
                                                    <Form.Item
                                                        label={
                                                            <span>
                                                                <CalendarOutlined className="mr-2" />
                                                                Ngày mục tiêu cai hoàn toàn
                                                            </span>
                                                        }
                                                        name="targetDate"
                                                        rules={[{ required: true, message: 'Vui lòng chọn ngày mục tiêu' }]}
                                                    >
                                                        <DatePicker
                                                            style={{ width: '100%' }}
                                                            placeholder="Chọn ngày mục tiêu"
                                                            format="DD/MM/YYYY"
                                                            disabledDate={(current) => {
                                                                // Get start date from form
                                                                const startDate = form.getFieldValue('startDate');
                                                                if (startDate) {
                                                                    // Disable dates before or equal to start date
                                                                    return current && current <= dayjs(startDate).startOf('day');
                                                                }
                                                                // If no start date, disable dates before today
                                                                return current && current < dayjs().startOf('day');
                                                            }}
                                                        />
                                                    </Form.Item>
                                                </Col>
                                            </Row>

                                            <Form.Item
                                                label={
                                                    <span>
                                                        <HeartOutlined className="mr-2" />
                                                        Lý do bỏ thuốc
                                                    </span>
                                                }
                                                name="reason"
                                                rules={[{ required: true, message: 'Vui lòng nhập lý do bỏ thuốc' }]}
                                            >
                                                <TextArea
                                                    rows={3}
                                                    placeholder="Chia sẻ lý do tại sao bạn muốn bỏ thuốc (ví dụ: vì sức khỏe, gia đình, tiết kiệm tiền...)"
                                                />
                                            </Form.Item>

                                            <Form.Item
                                                label="Mức độ động lực (1-10)"
                                                name="motivationLevel"
                                                rules={[
                                                    { required: true, message: 'Vui lòng đánh giá mức độ động lực' },
                                                    { type: 'number', min: 1, max: 10, message: 'Mức độ động lực phải từ 1 đến 10' }
                                                ]}
                                            >
                                                <InputNumber
                                                    min={1}
                                                    max={10}
                                                    style={{ width: '100%' }}
                                                    placeholder="Đánh giá mức độ quyết tâm của bạn (1: thấp, 10: rất cao)"
                                                />
                                            </Form.Item>

                                            <Form.Item
                                                label="Kế hoạch chi tiết từng giai đoạn"
                                                name="detailedPlan"
                                            >
                                                <TextArea
                                                    rows={8}
                                                    placeholder="Mô tả chi tiết kế hoạch từng giai đoạn, các hoạt động thay thế, cách đối phó với cơn thèm... (Có thể sử dụng kế hoạch mẫu ở trên)"
                                                />
                                            </Form.Item>

                                            <Form.Item>
                                                <Button
                                                    type="primary"
                                                    htmlType="submit"
                                                    size="large"
                                                    loading={submitting}
                                                    block
                                                >
                                                    Tạo Kế Hoạch Cai Thuốc
                                                </Button>
                                            </Form.Item>
                                        </Form>

                                        {/* Thông báo hiển thị sau khi tạo kế hoạch thành công */}
                                        {(justCreatedPlan || (existingPlans && existingPlans.length > 0)) && (
                                            <Alert
                                                message="📋 Bước tiếp theo quan trọng!"
                                                description={
                                                    <div>
                                                        <Text>
                                                            {justCreatedPlan ?
                                                                'Kế hoạch đã được tạo thành công! Bây giờ hãy chuyển sang tab ' :
                                                                'Hãy chuyển sang tab '
                                                            }
                                                            <Text strong className="text-blue-600">"Tiến trình"</Text>{' '}
                                                            để ghi nhật ký hàng ngày. Điều này giúp Coach theo dõi và hỗ trợ bạn tốt hơn.
                                                        </Text>
                                                        <div className="mt-2">
                                                            <Button
                                                                type="link"
                                                                size="small"
                                                                icon={<BookOutlined />}
                                                                onClick={() => setActiveTab('progress')}
                                                                className="p-0 h-auto"
                                                            >
                                                                Chuyển đến tab Tiến trình →
                                                            </Button>
                                                        </div>
                                                    </div>
                                                }
                                                type={justCreatedPlan ? "success" : "info"}
                                                showIcon
                                                icon={<BulbOutlined />}
                                                className="mt-4"
                                                style={{
                                                    borderColor: justCreatedPlan ? '#52c41a' : '#1890ff',
                                                    backgroundColor: justCreatedPlan ? '#f6ffed' : '#f0f9ff'
                                                }}
                                            />
                                        )}
                                    </Card>
                                </Col>

                                {/* Kế hoạch mẫu và danh sách hiện có */}
                                <Col xs={24} lg={10}>
                                    {/* 🧪 TEST TEMPLATE SECTION - Always show for testing */}
                                    <Card title="🎯 Kế hoạch mẫu - Premium Plan" className="mb-4" style={{ border: '2px solid #52c41a' }}>
                                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <Text strong className="text-blue-700">
                                                        🏆 Kế hoạch chuyên nghiệp 8 tuần
                                                    </Text>
                                                    <br />
                                                    <Text className="text-sm text-gray-600">
                                                        4 giai đoạn chi tiết được thiết kế bởi chuyên gia
                                                    </Text>
                                                </div>
                                                <Button
                                                    type="primary"
                                                    size="small"
                                                    onClick={handleUseTemplate}
                                                    icon={<BulbOutlined />}
                                                >
                                                    Áp dụng
                                                </Button>
                                            </div>
                                        </div>

                                        <List
                                            dataSource={[
                                                {
                                                    phaseName: "Tuần 1-2: Detox và chuẩn bị",
                                                    phaseDescription: "• Thực hiện detox cơ thể với chế độ ăn uống lành mạnh\n• Bắt đầu chương trình tập luyện thể chất\n• Thiết lập hệ thống hỗ trợ từ gia đình và bạn bè\n• Học các kỹ thuật thư giãn: thiền, yoga\n• Ghi chép chi tiết về triggers và cách đối phó",
                                                    durationDays: 14
                                                },
                                                {
                                                    phaseName: "Tuần 3-4: Xây dựng thói quen mới",
                                                    phaseDescription: "• Phát triển hobby mới để thay thế thời gian hút thuốc\n• Tham gia các nhóm hỗ trợ trực tuyến/offline\n• Áp dụng kỹ thuật CBT (Cognitive Behavioral Therapy)\n• Theo dõi cải thiện sức khỏe: huyết áp, nhịp tim\n• Lập kế hoạch tài chính từ tiền tiết kiệm",
                                                    durationDays: 14
                                                },
                                                {
                                                    phaseName: "Tuần 5-6: Đối phó với khó khăn",
                                                    phaseDescription: "• Nhận diện và xử lý các tình huống nguy hiểm\n• Phát triển kỹ năng quản lý stress nâng cao\n• Tạo động lực dài hạn với mục tiêu cụ thể\n• Đánh giá tiến bộ và điều chỉnh kế hoạch\n• Chuẩn bị tâm lý cho giai đoạn duy trì",
                                                    durationDays: 14
                                                },
                                                {
                                                    phaseName: "Tuần 7-8: Duy trì và phát triển",
                                                    phaseDescription: "• Ổn định lối sống không thuốc lá\n• Mở rộng mạng lưới hỗ trợ xã hội\n• Theo dõi và cải thiện sức khỏe tinh thần\n• Lập kế hoạch phòng ngừa tái phát\n• Chia sẻ kinh nghiệm để giúp người khác",
                                                    durationDays: 14
                                                }
                                            ]}
                                            renderItem={(phase, index) => (
                                                <List.Item>
                                                    <Card size="small" className="w-full shadow-sm hover:shadow-md transition-shadow">
                                                        <div className="flex items-start space-x-3">
                                                            <div className="flex-shrink-0">
                                                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                                    <span className="text-blue-600 font-semibold text-sm">
                                                                        {index + 1}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="flex-1">
                                                                <Title level={5} className="mb-2 text-blue-700">
                                                                    {phase.phaseName}
                                                                </Title>
                                                                <Paragraph className="mb-3 whitespace-pre-line text-sm text-gray-700">
                                                                    {phase.phaseDescription}
                                                                </Paragraph>
                                                                <div className="flex justify-between items-center">
                                                                    <Tag color="blue" className="font-medium">
                                                                        📅 {phase.durationDays} ngày
                                                                    </Tag>
                                                                    <Tag color="green" className="text-xs">
                                                                        Giai đoạn {index + 1}
                                                                    </Tag>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                </List.Item>
                                            )}
                                        />
                                    </Card>

                                    {/* Original template logic for comparison */}
                                    {console.log('🔍 DEBUG - planTemplate state:', planTemplate)}

                                    {/* Hiển thị kế hoạch mẫu từ API */}
                                    {planTemplate && planTemplate.length > 0 && (
                                        <Card title={`🔄 API Templates - ${paymentInfo?.PlanName}`} className="mb-4" style={{ border: '2px solid #1890ff' }}>
                                            <Text className="text-sm text-blue-600 mb-3 block">
                                                Đây là templates từ API (nếu có)
                                            </Text>
                                            <List
                                                dataSource={planTemplate}
                                                renderItem={(phase, index) => (
                                                    <List.Item>
                                                        <Card size="small" className="w-full">
                                                            <Title level={5} className="mb-2">
                                                                {phase.PhaseName || phase.phaseName}
                                                            </Title>
                                                            <Paragraph className="mb-0 whitespace-pre-line text-sm">
                                                                {phase.PhaseDescription || phase.phaseDescription}
                                                            </Paragraph>
                                                            <div className="mt-2">
                                                                <Tag color="blue">
                                                                    {phase.DurationDays || phase.durationDays} ngày
                                                                </Tag>
                                                            </div>
                                                        </Card>
                                                    </List.Item>
                                                )}
                                            />
                                        </Card>
                                    )}

                                    {/* Danh sách kế hoạch hiện có */}
                                    <Card title="Kế hoạch của bạn" className="h-full">
                                        {existingPlans.length === 0 ? (
                                            <div className="text-center py-8">
                                                <ExclamationCircleOutlined className="text-2xl text-gray-400 mb-2" />
                                                <Text className="text-gray-500">
                                                    Bạn chưa có kế hoạch cai thuốc nào
                                                </Text>
                                            </div>
                                        ) : (
                                            <List
                                                dataSource={existingPlans}
                                                renderItem={(plan) => {
                                                    const daysToTarget = calculateDaysToTarget(plan.TargetDate);
                                                    return (
                                                        <List.Item>
                                                            <Card className="w-full" size="small">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <Tag color={getStatusColor(plan.Status)}>
                                                                        {getStatusText(plan.Status)}
                                                                    </Tag>
                                                                    <Text className="text-sm text-gray-500">
                                                                        {format(parseISO(plan.CreatedAt), 'dd/MM/yyyy')}
                                                                    </Text>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <div>
                                                                        <Text strong>Ngày bắt đầu: </Text>
                                                                        <Text>{format(parseISO(plan.StartDate), 'dd/MM/yyyy')}</Text>
                                                                    </div>

                                                                    <div>
                                                                        <Text strong>Ngày mục tiêu: </Text>
                                                                        <Text>{format(parseISO(plan.TargetDate), 'dd/MM/yyyy')}</Text>
                                                                        {plan.Status === 'active' && (
                                                                            <Text className="ml-2 text-sm">
                                                                                ({daysToTarget > 0 ? `còn ${daysToTarget} ngày` : 'đã qua hạn'})
                                                                            </Text>
                                                                        )}
                                                                    </div>

                                                                    <div>
                                                                        <Text strong>Động lực: </Text>
                                                                        <Text>{plan.MotivationLevel}/10</Text>
                                                                    </div>

                                                                    <div>
                                                                        <Text strong>Lý do: </Text>
                                                                        <Paragraph
                                                                            ellipsis={{ rows: 2, expandable: true, symbol: 'xem thêm' }}
                                                                            className="mb-0"
                                                                        >
                                                                            {plan.Reason}
                                                                        </Paragraph>
                                                                    </div>

                                                                    {plan.DetailedPlan && (
                                                                        <div>
                                                                            <Text strong>Kế hoạch chi tiết: </Text>
                                                                            <Paragraph
                                                                                ellipsis={{ rows: 2, expandable: true, symbol: 'xem thêm' }}
                                                                                className="mb-0"
                                                                            >
                                                                                {plan.DetailedPlan}
                                                                            </Paragraph>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </Card>
                                                        </List.Item>
                                                    );
                                                }}
                                            />
                                        )}
                                    </Card>
                                </Col>
                            </Row>
                        </TabPane>
                        <TabPane
                            tab={
                                <span>
                                    <BookOutlined />
                                    Tiến trình
                                    {hasAccess && (
                                        <Badge
                                            status="processing"
                                            style={{ marginLeft: 8 }}
                                        />
                                    )}
                                </span>
                            }
                            key="progress"
                        >
                            <ProgressLogs hasAccess={hasAccess} existingPlans={existingPlans} setActiveTab={setActiveTab} />
                        </TabPane>

                    </Tabs>
                </Card>

                {/* Thông tin hướng dẫn */}
                <Card className="shadow-lg rounded-lg">
                    <Title level={4}>
                        <CheckCircleOutlined className="mr-2 text-green-500" />
                        Lưu ý quan trọng
                    </Title>
                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={8}>
                            <Card size="small" className="h-full bg-blue-50">
                                <Title level={5}>Kế hoạch theo gói</Title>
                                <Text>
                                    Mỗi gói dịch vụ có kế hoạch mẫu chuyên nghiệp được thiết kế riêng để tối ưu hóa hiệu quả cai thuốc.
                                </Text>
                            </Card>
                        </Col>

                        <Col xs={24} md={8}>
                            <Card size="small" className="h-full bg-green-50">
                                <Title level={5}>Tính năng Coach</Title>
                                <Text>
                                    Các coach sẽ có thể can thiệp và chỉnh sửa kế hoạch chi tiết để hỗ trợ bạn tốt hơn.
                                </Text>
                            </Card>
                        </Col>

                        <Col xs={24} md={8}>
                            <Card size="small" className="h-full bg-yellow-50">
                                <Title level={5}>Theo dõi tiến trình</Title>
                                <Text>
                                    Hãy thường xuyên cập nhật tiến trình và điều chỉnh kế hoạch phù hợp với tình hình thực tế.
                                </Text>
                            </Card>
                        </Col>
                    </Row>
                </Card>
            </div>
        </div>
    );
};

export default QuitPlanPage; 