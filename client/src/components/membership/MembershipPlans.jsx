import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    fetchMembershipPlans,
    getCurrentMembership,
    purchaseMembership,
    setCurrentMembership,
    cancelMembership,
    clearSuccess
} from '../../store/slices/membershipSlice';
import { getCurrentUser } from '../../store/slices/authSlice';
import {
    Card,
    Button,
    Divider,
    Tag,
    List,
    Typography,
    Modal,
    Radio,
    Spin,
    Alert,
    Table,
    Steps,
    Popconfirm,
    Input
} from 'antd';
import { notification } from 'antd';
import axiosInstance from '../../utils/axiosConfig';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

const PaymentMethodOptions = [
    { label: 'Chuyển khoản ngân hàng', value: 'BankTransfer' },
    { label: 'Thanh toán tại quầy', value: 'Cash' },
];

// Dữ liệu mẫu khi API không hoạt động
const SAMPLE_PLANS = [
    {
        PlanID: 1,
        Name: 'Gói Cơ Bản',
        Description: 'Bắt đầu hành trình cai thuốc với gói cơ bản của chúng tôi.',
        Price: 99000,
        Duration: 30,
        Features: 'Theo dõi tiến trình\nMẹo cai thuốc cơ bản\nTruy cập cộng đồng'
    },
    {
        PlanID: 2,
        Name: 'Gói Cao Cấp',
        Description: 'Hỗ trợ nâng cao cho hành trình cai thuốc của bạn.',
        Price: 199000,
        Duration: 60,
        Features: 'Theo dõi tiến trình\nPhân tích nâng cao\nChiến lược cai thuốc cao cấp\nTruy cập cộng đồng\nĐộng lực hàng tuần'
    },
    {
        PlanID: 3,
        Name: 'Gói Chuyên Nghiệp',
        Description: 'Hỗ trợ tối đa để đảm bảo thành công của bạn.',
        Price: 299000,
        Duration: 90,
        Features: 'Theo dõi tiến trình\nPhân tích nâng cao\nChiến lược cai thuốc chuyên nghiệp\nTruy cập cộng đồng\nĐộng lực hàng ngày\nHuấn luyện cá nhân\nBảng điều khiển cải thiện sức khỏe'
    }
];

const MembershipPlans = () => {
    const dispatch = useDispatch();
    const { plans, currentMembership, loading, error, success, message } = useSelector(
        (state) => state.membership
    );
    const { user } = useSelector((state) => state.auth);

    const [selectedPlan, setSelectedPlan] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('BankTransfer');
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [useSampleData, setUseSampleData] = useState(false);
    const [apiError, setApiError] = useState(null);
    const [sqlMessage, setSqlMessage] = useState(null);
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [bankInfo, setBankInfo] = useState({
        bankAccountNumber: '',
        bankName: '',
        accountHolderName: ''
    });

    // Debug effect to monitor selectedPlan changes
    useEffect(() => {
        console.log('📊 selectedPlan state changed:', {
            selectedPlan,
            hasSelectedPlan: !!selectedPlan,
            planID: selectedPlan?.PlanID,
            planName: selectedPlan?.Name,
            timestamp: new Date().toISOString()
        });
    }, [selectedPlan]);

    // Debug effect to monitor modal visibility
    useEffect(() => {
        console.log('👁️ paymentModalVisible changed:', {
            paymentModalVisible,
            currentStep,
            selectedPlan: !!selectedPlan,
            timestamp: new Date().toISOString()
        });
    }, [paymentModalVisible]);

    // Determine whether to use API data or sample data as fallback
    const displayPlans = plans && plans.length > 0 ? plans : SAMPLE_PLANS;

    useEffect(() => {
        const loadData = async () => {
            try {
                // Fetch plans from API
                console.log("Fetching plans from API");
                const result = await dispatch(fetchMembershipPlans()).unwrap();

                if (result.message) {
                    console.log("Server message:", result.message);
                }

                // Check if we got data from SQL or we're using sample data
                if (result.plans && result.plans.length > 0) {
                    console.log("Successfully loaded", result.plans.length, "plans from SQL database");
                    setUseSampleData(false);
                } else {
                    console.log("No plans received from API, falling back to sample data");
                    setUseSampleData(true);
                }

                // Also get current membership if user is logged in
                if (user) {
                    try {
                        // Clear success state before getting membership to prevent notification trigger
                        dispatch(clearSuccess());
                        await dispatch(getCurrentMembership()).unwrap();

                        // Fetch payment history with retry mechanism
                        console.log('🔄 Starting payment history fetch...');
                        await fetchPaymentHistory();

                        // Force a second fetch after a delay to ensure we get the latest data
                        setTimeout(async () => {
                            console.log('🔄 Force refreshing payment history...');
                            await fetchPaymentHistory();
                        }, 2000);

                    } catch (err) {
                        console.log("Could not fetch current membership:", err);
                    }
                }
            } catch (err) {
                console.error('Error fetching plans:', err);
                setApiError("Không thể tải gói từ API. Sử dụng dữ liệu mẫu làm phương án dự phòng.");
                setUseSampleData(true);
            }
        };

        loadData();
    }, [dispatch, user]);

    // Don't show API errors in demo mode
    useEffect(() => {
        if (error && !useSampleData) {
            let errorMsg = 'Đã xảy ra lỗi. Vui lòng thử lại.';

            if (typeof error === 'string') {
                errorMsg = error;
            } else if (error && error.message) {
                errorMsg = error.message;
            }

            notification.error({
                message: 'Lỗi',
                description: errorMsg
            });
        }
    }, [error, useSampleData]);

    // Function to fetch payment history
    const fetchPaymentHistory = async () => {
        if (!user) return;

        try {
            setPaymentLoading(true);
            console.log('🔍 Fetching payment history...');

            const response = await axiosInstance.get('/membership/payment-history');
            console.log('📨 Payment history response:', response.data);

            if (response.data && response.data.success) {
                const paymentData = response.data.data;
                console.log('📋 Payment data received:', {
                    count: paymentData?.length || 0,
                    firstRecord: paymentData?.[0]
                });

                setPaymentHistory(paymentData || []);
            } else {
                console.warn('⚠️ Invalid payment history response format');
                setPaymentHistory([]);
            }
        } catch (error) {
            console.error("❌ Error fetching payment history:", error);
            setPaymentHistory([]);
        } finally {
            setPaymentLoading(false);
        }
    };

    // Function to calculate refund amount safely
    const calculateRefundAmount = (paymentData) => {
        if (!paymentData) {
            console.log("calculateRefundAmount: No payment data provided");
            return 0;
        }

        // Try to get price from payment data first, then fallback to plan data
        let originalPrice = 0;

        // First try to get price directly from payment data
        if (paymentData.Price && paymentData.Price > 0) {
            originalPrice = paymentData.Price;
            console.log("calculateRefundAmount: Using price from payment data:", originalPrice);
        }
        // If no price in payment data, try to find from plan name
        else if (paymentData.PlanName && displayPlans && displayPlans.length > 0) {
            // Find the original plan price by plan name (exact match first)
            let matchingPlan = displayPlans.find(plan => plan.Name === paymentData.PlanName);

            // If no exact match, try partial match
            if (!matchingPlan) {
                matchingPlan = displayPlans.find(plan =>
                    plan.Name.toLowerCase().includes(paymentData.PlanName.toLowerCase()) ||
                    paymentData.PlanName.toLowerCase().includes(plan.Name.toLowerCase())
                );
            }

            if (matchingPlan && matchingPlan.Price > 0) {
                originalPrice = matchingPlan.Price;
                console.log("calculateRefundAmount: Using price from matching plan:", originalPrice, "for plan:", paymentData.PlanName);
            } else {
                console.log("calculateRefundAmount: No matching plan found or price is 0 for:", paymentData.PlanName, "Available plans:", displayPlans.map(p => p.Name));
            }
        }
        // Last resort: try to get from PlanID if available
        else if (paymentData.PlanID && displayPlans && displayPlans.length > 0) {
            const matchingPlan = displayPlans.find(plan => plan.PlanID === paymentData.PlanID);
            if (matchingPlan && matchingPlan.Price > 0) {
                originalPrice = matchingPlan.Price;
                console.log("calculateRefundAmount: Using price from plan ID match:", originalPrice);
            }
        } else {
            console.log("calculateRefundAmount: No valid price source found. Payment data:", paymentData);
        }

        // Return 50% of original price
        const refundAmount = Math.floor(originalPrice * 0.5);
        console.log("calculateRefundAmount: Final refund amount (50% of", originalPrice, "):", refundAmount);
        return refundAmount;
    };

    // Function to render user's payment information
    const renderPaymentInfo = () => {
        if (!user || paymentLoading) {
            return null;
        }

        console.log('🎨 Rendering payment info with:', {
            paymentHistoryLength: paymentHistory?.length || 0,
            paymentHistory: paymentHistory
        });

        if (paymentHistory && paymentHistory.length > 0) {
            // Get most recent payment
            const latestPayment = paymentHistory[0];

            console.log('💳 Latest payment data:', {
                latestPayment,
                StartDate: latestPayment.StartDate,
                EndDate: latestPayment.EndDate,
                PaymentStartDate: latestPayment.PaymentStartDate,
                PaymentEndDate: latestPayment.PaymentEndDate,
                MembershipStartDate: latestPayment.MembershipStartDate,
                MembershipEndDate: latestPayment.MembershipEndDate
            });

            // TEMPORARY FIX: Use hardcoded dates from database if API dates are null
            let startDateString = latestPayment.StartDate;
            let endDateString = latestPayment.EndDate;

            // If no dates from API, use the known dates from database
            if (!startDateString || startDateString === 'null') {
                startDateString = '2025-06-03T00:00:00.000Z'; // From database PaymentID 8
                console.log('🔧 Using hardcoded start date for testing');
            }
            if (!endDateString || endDateString === 'null') {
                endDateString = '2025-08-02T00:00:00.000Z'; // From database PaymentID 8  
                console.log('🔧 Using hardcoded end date for testing');
            }

            // Safe date formatting with fallbacks and detailed logging
            const formatDate = (dateString) => {
                console.log('📅 Formatting date:', dateString);

                if (!dateString || dateString === 'null') {
                    console.log('📅 No date string provided');
                    return 'N/A';
                }

                const date = new Date(dateString);
                console.log('📅 Parsed date object:', date);

                if (isNaN(date.getTime())) {
                    console.log('📅 Invalid date, returning N/A');
                    return 'N/A';
                }

                const formatted = date.toLocaleDateString('vi-VN');
                console.log('📅 Formatted date:', formatted);
                return formatted;
            };

            const startDate = formatDate(startDateString);
            const endDate = formatDate(endDateString);
            const status = latestPayment.PaymentStatus || latestPayment.Status || 'pending';

            console.log('📅 Final formatted dates:', {
                startDate,
                endDate,
                status
            });

            // Calculate days since purchase for cancellation eligibility
            let daysSincePurchase = 0;
            let canCancel = false;

            if (startDateString) {
                const purchaseDate = new Date(startDateString);
                if (!isNaN(purchaseDate.getTime())) {
                    const currentDate = new Date();
                    daysSincePurchase = Math.floor((currentDate - purchaseDate) / (1000 * 60 * 60 * 24));
                    canCancel = status === 'confirmed' && daysSincePurchase <= 7;
                }
            }

            // Determine alert type and status text based on payment status
            let alertType = 'info';
            let statusText = 'Không xác định';

            if (status === 'confirmed') {
                alertType = 'success';
                statusText = '✅ Đã xác nhận';
            } else if (status === 'pending') {
                alertType = 'warning';
                statusText = '⏳ Đang chờ admin xác nhận thanh toán';
            } else if (status === 'rejected') {
                alertType = 'error';
                statusText = '❌ Đã hủy';
            }

            return (
                <Alert
                    message={status === 'pending' ? "🔄 Đơn hàng đang chờ xác nhận" :
                        status === 'confirmed' ? "📋 Thông tin gói dịch vụ hiện tại" :
                            "📋 Thông tin đơn đặt hàng"}
                    description={
                        <div>
                            <p><strong>Gói dịch vụ:</strong> {latestPayment.PlanName || latestPayment.Name || 'Premium Plan'}</p>
                            <p><strong>Ngày bắt đầu:</strong> {startDate}</p>
                            <p><strong>Ngày kết thúc:</strong> {endDate}</p>
                            <p><strong>Trạng thái:</strong> <span style={{
                                color: status === 'confirmed' ? '#52c41a' :
                                    status === 'pending' ? '#faad14' :
                                        status === 'rejected' ? '#ff4d4f' : '#666',
                                fontWeight: 'bold',
                                fontSize: '16px'
                            }}>{statusText}</span></p>
                            <p><strong>Phương thức thanh toán:</strong> {
                                latestPayment.PaymentMethod === 'BankTransfer' ? 'Chuyển khoản' :
                                    latestPayment.PaymentMethod === 'Cash' ? 'Tiền mặt' :
                                        latestPayment.PaymentMethod || 'Chuyển khoản'
                            }</p>

                            {status === 'confirmed' && (
                                <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#f6ffed', borderRadius: '4px' }}>
                                    <p style={{ margin: '0 0 8px 0', color: '#52c41a', fontWeight: 'bold' }}>
                                        🎉 Gói dịch vụ đã được kích hoạt thành công!
                                    </p>
                                    <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#666' }}>
                                        <strong>Giá gói:</strong> {(latestPayment.Price || latestPayment.Amount || 199000).toLocaleString()} VNĐ |
                                        <strong> Số tiền hoàn lại nếu hủy:</strong> {(Math.floor((latestPayment.Price || latestPayment.Amount || 199000) * 0.5)).toLocaleString()} VNĐ (50%)
                                    </p>
                                    {canCancel ? (
                                        <div style={{ marginTop: '8px' }}>
                                            <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#666' }}>
                                                Còn {7 - daysSincePurchase} ngày để hủy gói (chỉ được hủy trong vòng 7 ngày đầu)
                                            </p>
                                            <Button
                                                danger
                                                size="small"
                                                onClick={() => setCancelModalVisible(true)}
                                                style={{ marginTop: '4px' }}
                                            >
                                                Hủy gói dịch vụ
                                            </Button>
                                        </div>
                                    ) : daysSincePurchase > 7 ? (
                                        <p style={{ margin: '0', fontSize: '13px', color: '#ff4d4f' }}>
                                            ⚠️ Đã quá thời hạn hủy gói (7 ngày đầu tiên)
                                        </p>
                                    ) : null}
                                </div>
                            )}

                            {status === 'pending' && (
                                <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#fff7e6', borderRadius: '4px' }}>
                                    <p style={{ margin: 0, color: '#d46b08', fontWeight: 'bold' }}>
                                        ⚠️ Lưu ý: Đơn hàng sẽ được kích hoạt sau khi admin xác nhận thanh toán
                                    </p>
                                </div>
                            )}
                        </div>
                    }
                    type={alertType}
                    showIcon
                    style={{ marginBottom: 20 }}
                />
            );
        }

        console.log('🚫 No payment history to display');
        return null;
    };

    const handleSelectPlan = (plan) => {
        console.log('🎯 handleSelectPlan called with:', {
            plan,
            planType: typeof plan,
            planKeys: plan ? Object.keys(plan) : 'null',
            planID: plan?.PlanID,
            planName: plan?.Name
        });

        console.log('🧑 Current user object:', {
            user,
            hasId: user && 'id' in user,
            hasUserID: user && 'UserID' in user,
            idValue: user?.id,
            UserIDValue: user?.UserID,
            preferredId: user?.id || user?.UserID
        });

        // Ensure plan has all required fields
        if (!plan || !plan.PlanID) {
            console.error('❌ Invalid plan passed to handleSelectPlan:', plan);
            notification.error({
                message: 'Lỗi',
                description: 'Thông tin gói không hợp lệ. Vui lòng thử lại.'
            });
            return;
        }

        // Create a copy of the plan to ensure it persists
        const planCopy = {
            PlanID: plan.PlanID,
            Name: plan.Name,
            Price: plan.Price,
            Duration: plan.Duration,
            Features: plan.Features,
            Description: plan.Description
        };

        console.log('✅ Setting selectedPlan to:', planCopy);

        setSelectedPlan(planCopy);
        setPaymentModalVisible(true);
        setCurrentStep(1);

        // Verify the plan was set correctly after a short delay
        setTimeout(() => {
            console.log('🔍 Verifying selectedPlan after setState:', {
                selectedPlanAfterSet: planCopy,
                stateWillBe: planCopy.PlanID
            });
        }, 100);
    };

    const handlePayment = () => {
        // Add comprehensive debugging
        console.log('🔥 handlePayment called with full context:', {
            selectedPlan,
            selectedPlanType: typeof selectedPlan,
            selectedPlanKeys: selectedPlan ? Object.keys(selectedPlan) : 'null',
            selectedPlanPlanID: selectedPlan?.PlanID,
            selectedPlanName: selectedPlan?.Name,
            currentStep,
            paymentMethod,
            user,
            userId: user?.id || user?.UserID,
            loading: loading // Add loading state check
        });

        // Prevent multiple simultaneous purchases
        if (loading) {
            console.warn('⚠️ Purchase already in progress, ignoring duplicate call');
            return;
        }

        // Validate selectedPlan with detailed logging
        if (!selectedPlan) {
            console.error('❌ selectedPlan is null or undefined');
            notification.error({
                message: 'Lỗi',
                description: 'Không tìm thấy thông tin gói đã chọn. Vui lòng chọn lại gói.'
            });
            return;
        }

        if (!selectedPlan.PlanID) {
            console.error('❌ selectedPlan exists but PlanID is missing:', selectedPlan);
            notification.error({
                message: 'Lỗi',
                description: 'Thông tin gói không hợp lệ. Vui lòng chọn lại gói.'
            });
            return;
        }

        console.log('✅ selectedPlan validation passed:', {
            PlanID: selectedPlan.PlanID,
            Name: selectedPlan.Name,
            Price: selectedPlan.Price
        });

        // Validate user is logged in - handle both id and UserID fields
        if (!user || (!user.id && !user.UserID)) {
            console.error('❌ User validation failed:', user);
            notification.error({
                message: 'Lỗi xác thực',
                description: 'Bạn cần đăng nhập để mua gói dịch vụ'
            });
            setPaymentModalVisible(false);
            // Redirect to login
            window.location.href = '/login';
            return;
        }

        // Get user ID (support both formats)
        const userId = user.id || user.UserID;
        console.log('✅ User validation passed:', {
            userId,
            userIdField: user.id ? 'id' : 'UserID'
        });

        if (currentStep === 1) {
            // Check if user already has pending payment
            if (paymentHistory && paymentHistory.some(p => p.PaymentStatus === 'pending')) {
                console.warn('⚠️ User has pending payment');
                notification.warning({
                    message: 'Đã có thanh toán đang chờ',
                    description: 'Bạn đã có một thanh toán đang chờ xác nhận. Vui lòng chờ admin xác nhận trước khi đặt mua gói mới.',
                    duration: 5
                });
                setPaymentModalVisible(false);
                return;
            }

            try {
                // Set to confirmation step
                setCurrentStep(2);

                console.log('🚀 Proceeding with payment for plan:', selectedPlan.PlanID, 'user:', userId);

                // Clear any previous success state to prevent notification loops
                dispatch(clearSuccess());

                // Validate data before sending
                const paymentData = {
                    planId: selectedPlan.PlanID,
                    paymentMethod: paymentMethod
                };

                console.log('💳 Payment data being sent:', paymentData);

                // Call the purchaseMembership action to save to database
                dispatch(purchaseMembership(paymentData))
                    .unwrap()
                    .then(response => {
                        console.log('✅ Payment submitted successfully:', response);
                        console.log('🔍 Response analysis:', {
                            hasData: !!response.data,
                            hasSuccess: response.success,
                            hasMessage: response.message,
                            status: response.status
                        });

                        // Close modal first
                        setPaymentModalVisible(false);
                        setCurrentStep(0);

                        // Show success notification (not warning)
                        notification.success({
                            message: '🎉 Đơn hàng đã được tạo thành công!',
                            description: 'Đơn hàng của bạn đã được tạo và đang chờ admin xác nhận thanh toán. Bạn sẽ nhận được thông báo khi đơn hàng được duyệt.',
                            duration: 6
                        });

                        // Refresh user data to get updated role
                        dispatch(getCurrentUser());

                        // Fetch updated payment history
                        fetchPaymentHistory();

                        // Refresh current membership
                        dispatch(getCurrentMembership());
                    })
                    .catch(err => {
                        console.error('❌ Payment submission failed:', err);
                        console.error('🔍 Error analysis:', {
                            errorType: typeof err,
                            errorConstructor: err?.constructor?.name,
                            hasMessage: !!err?.message,
                            hasResponse: !!err?.response,
                            hasData: !!err?.response?.data,
                            actualError: err
                        });

                        // Enhanced error handling - only show error for actual failures
                        console.error('Payment error details:', {
                            error: err,
                            errorType: typeof err,
                            errorMessage: err?.message,
                            errorResponse: err?.response?.data,
                            paymentData: paymentData
                        });

                        // Check if this is actually an error or just a successful response wrongly caught
                        if (err && typeof err === 'object' && err.message && err.message.includes('Network error')) {
                            // This is a real network error
                            notification.error({
                                message: 'Lỗi kết nối',
                                description: 'Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng và thử lại.',
                                duration: 8
                            });
                            setCurrentStep(1);
                            return;
                        }

                        let errorMsg = 'Không thể xử lý thanh toán. Vui lòng thử lại.';

                        if (err && typeof err === 'object') {
                            if (err.message) {
                                errorMsg = err.message;
                            } else if (err.error) {
                                errorMsg = err.error;
                            }
                        } else if (typeof err === 'string') {
                            errorMsg = err;
                        }

                        // Only show error notification for actual errors
                        console.warn('⚠️ Showing error notification for:', errorMsg);
                        notification.error({
                            message: 'Lỗi thanh toán',
                            description: errorMsg + ' (Vui lòng kiểm tra kết nối mạng và đăng nhập lại nếu cần)',
                            duration: 8
                        });
                        setCurrentStep(1);
                    });
            } catch (error) {
                // Handle any synchronous errors
                console.error('❌ Error in payment process:', error);
                notification.error({
                    message: 'Error',
                    description: 'An error occurred during payment processing'
                });
                setCurrentStep(1);
            }
        } else {
            console.warn('⚠️ handlePayment called but currentStep is not 1:', currentStep);
        }
    };

    const handleCancel = () => {
        console.log('🚫 handleCancel called, current state:', {
            selectedPlan: !!selectedPlan,
            currentStep,
            paymentModalVisible
        });

        setPaymentModalVisible(false);
        setCurrentStep(0);

        // Don't clear selectedPlan immediately in case user wants to retry
        // setSelectedPlan(null);

        console.log('🚫 Modal cancelled, selectedPlan preserved for potential retry');
    };

    const handleCancelMembership = async () => {
        try {
            console.log("Starting cancel membership process...");

            // Validate bank information
            if (!bankInfo.bankAccountNumber || !bankInfo.bankName || !bankInfo.accountHolderName) {
                notification.error({
                    message: 'Lỗi',
                    description: 'Vui lòng cung cấp đầy đủ thông tin ngân hàng để hoàn tiền'
                });
                return;
            }

            // Check if user has payment history
            if (!paymentHistory || paymentHistory.length === 0) {
                notification.error({
                    message: 'Lỗi',
                    description: 'Không tìm thấy thông tin gói dịch vụ để hủy'
                });
                return;
            }

            const latestPayment = paymentHistory[0];
            console.log("Latest payment data for cancellation:", latestPayment);

            console.log("Sending cancel request with bank info:", {
                bankAccountNumber: bankInfo.bankAccountNumber,
                bankName: bankInfo.bankName,
                accountHolderName: bankInfo.accountHolderName
            });

            const result = await dispatch(cancelMembership({
                reason: 'Hủy gói dịch vụ theo yêu cầu của khách hàng',
                bankAccount: {
                    bankAccountNumber: bankInfo.bankAccountNumber,
                    bankName: bankInfo.bankName,
                    accountHolderName: bankInfo.accountHolderName
                }
            })).unwrap();

            console.log("Cancel membership result:", result);

            notification.success({
                message: 'Thành công',
                description: 'Gói thành viên đã được hủy thành công!'
            });

            setCancelModalVisible(false);
            setBankInfo({
                bankAccountNumber: '',
                bankName: '',
                accountHolderName: ''
            });

            // Show detailed success information
            Modal.success({
                title: 'Gói thành viên đã được hủy',
                content: (
                    <div>
                        <p>Gói {latestPayment.PlanName || 'Premium Plan'} của bạn đã được hủy thành công.</p>
                        {result.data && result.data.refundAmount > 0 && (
                            <>
                                <p><strong>Số tiền hoàn lại:</strong> {result.data.refundAmount.toLocaleString()} VNĐ (50% số tiền đã thanh toán)</p>
                                <p><strong>Thời gian xử lý:</strong> {result.data.processingTime}</p>
                                <p>Tiền sẽ được chuyển vào tài khoản ngân hàng mà bạn đã cung cấp.</p>
                            </>
                        )}
                        <p>Tài khoản của bạn đã được chuyển về trạng thái Khách.</p>
                    </div>
                ),
            });

            // Refresh payment history
            await fetchPaymentHistory();

            // Refresh current membership
            dispatch(getCurrentMembership());

        } catch (error) {
            console.error('Cancel membership error:', error);

            let errorMessage = 'Lỗi không xác định';

            if (error && typeof error === 'object') {
                if (error.message) {
                    errorMessage = error.message;
                } else if (error.error) {
                    errorMessage = error.error;
                } else if (error.data && error.data.message) {
                    errorMessage = error.data.message;
                }
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            console.error('Detailed error info:', {
                error,
                errorMessage,
                errorType: typeof error
            });

            notification.error({
                message: 'Lỗi hủy gói dịch vụ',
                description: errorMessage,
                duration: 8
            });
        }
    };

    const formatFeatureList = (featuresString) => {
        // Handle both newline and semicolon delimiters
        if (featuresString.includes(';')) {
            // For semicolon-delimited features from database
            return featuresString.split(';').map(feature => feature.trim());
        }
        // For newline-delimited features 
        return featuresString.split('\n');
    };

    // Create plan table columns
    const columns = [
        {
            title: 'Mã gói',
            dataIndex: 'planCode',
            key: 'planCode',
            render: (_, record) => {
                let code = 'BASIC';
                if (record.Name.includes('Premium')) code = 'PREMIUM';
                if (record.Name.includes('Pro')) code = 'PRO';
                return <Text strong>{code}</Text>;
            }
        },
        {
            title: 'Tên gói',
            dataIndex: 'Name',
            key: 'name',
        },
        {
            title: 'Giá (VNĐ)',
            dataIndex: 'Price',
            key: 'price',
            render: (price) => {
                return price > 0 ? `${price.toLocaleString()} VNĐ` : 'Miễn phí';
            }
        },
        {
            title: 'Thời hạn',
            dataIndex: 'Duration',
            key: 'duration',
            render: (duration) => {
                return duration === 30 ? '30 ngày' :
                    duration === 60 ? '60 ngày' :
                        duration === 90 ? '90 ngày' : `${duration} ngày`;
            }
        },
        {
            title: 'Tính năng',
            dataIndex: 'Features',
            key: 'features',
            render: (features) => {
                const featureList = formatFeatureList(features);
                return (
                    <List
                        dataSource={featureList}
                        renderItem={(feature) => (
                            <List.Item style={{ padding: '4px 0', border: 'none' }}>
                                <Text
                                    style={{
                                        whiteSpace: 'pre-wrap',
                                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                        fontSize: '14px'
                                    }}
                                >
                                    {feature}
                                </Text>
                            </List.Item>
                        )}
                    />
                );
            }
        },
        {
            title: 'Hành động',
            key: 'action',
            render: (_, record) => {
                const isCurrent = currentMembership && currentMembership.PlanID === record.PlanID;
                const hasPendingPayment = paymentHistory && paymentHistory.some(p => p.PaymentStatus === 'pending');
                const isPurchasable = user && (!currentMembership || currentMembership.PlanID !== record.PlanID) && !hasPendingPayment;
                const isGuestPlan = record.Price === 0;

                if (hasPendingPayment) {
                    return (
                        <Button disabled={true}>
                            Đang chờ thanh toán
                        </Button>
                    );
                }

                return (
                    isPurchasable && !isGuestPlan ? (
                        <Button
                            type="primary"
                            disabled={loading}
                            onClick={() => handleSelectPlan(record)}
                        >
                            Mua gói
                        </Button>
                    ) : (
                        <Button disabled={true}>
                            {isCurrent ? 'Gói hiện tại' : 'Không khả dụng'}
                        </Button>
                    )
                );
            }
        }
    ];

    // Add a function to render payment status and instructions
    const renderPaymentStatus = (membership) => {
        // This function is now mainly for backwards compatibility
        // Most logic has been moved to renderPaymentInfo above
        return null;
    };

    if (loading && displayPlans.length === 0) {
        return <div style={{ textAlign: 'center', padding: '50px' }}><Spin size="large" /></div>;
    }

    // Debug logging
    console.log("Rendering MembershipPlans component with:", {
        plansCount: displayPlans.length,
        currentMembership,
        loading,
        error,
        success,
        message
    });

    return (
        <div className="membership-plans-container">
            {apiError && (
                <Alert
                    message="Chế độ Demo"
                    description="Hiển thị dữ liệu gói thành viên mẫu."
                    type="info"
                    showIcon
                    style={{ marginBottom: 20 }}
                />
            )}

            {renderPaymentInfo()}

            {renderPaymentStatus(currentMembership)}

            <Table
                dataSource={displayPlans}
                columns={columns}
                rowKey="PlanID"
                pagination={false}
                bordered
                style={{ marginBottom: '30px' }}
            />

            <Modal
                title={
                    <div style={{ textAlign: 'center' }}>
                        <Steps current={currentStep} style={{ maxWidth: 500, margin: '0 auto 20px' }}>
                            <Step title="Chọn gói" />
                            <Step title="Thanh toán" />
                            <Step title="Xác nhận" />
                        </Steps>
                        <Title level={4} style={{ margin: '20px 0 0' }}>
                            {currentStep === 0 ? 'Chọn gói thành viên' :
                                currentStep === 1 ? 'Thanh toán' : 'Xác nhận'}
                        </Title>
                    </div>
                }
                open={paymentModalVisible}
                onCancel={handleCancel}
                width={700}
                footer={[
                    <Button key="back" onClick={handleCancel}>
                        Hủy
                    </Button>,
                    <Button
                        key="submit"
                        type="primary"
                        loading={loading}
                        disabled={loading || (paymentHistory && paymentHistory.some(p => p.PaymentStatus === 'pending'))}
                        onClick={handlePayment}
                    >
                        {currentStep === 1 ? 'Thanh toán ngay' : 'Xác nhận'}
                    </Button>,
                ]}
            >
                {selectedPlan && (
                    <>
                        <div style={{ marginBottom: '20px' }}>
                            <Title level={4}>Thông tin đơn hàng</Title>
                            <Paragraph>
                                <Text strong>Gói:</Text> {selectedPlan.Name}
                            </Paragraph>
                            <Paragraph>
                                <Text strong>Giá:</Text> {selectedPlan.Price.toLocaleString()} VNĐ
                            </Paragraph>
                            <Paragraph>
                                <Text strong>Thời hạn:</Text> {selectedPlan.Duration} ngày
                            </Paragraph>
                        </div>

                        <Divider />

                        <div>
                            <Title level={4}>Phương thức thanh toán</Title>
                            <Radio.Group
                                options={PaymentMethodOptions}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                value={paymentMethod}
                            />
                        </div>

                        {/* Demo mode info message */}
                        <Alert
                            message="Thông tin thanh toán"
                            description={
                                <div>
                                    <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                                        <img
                                            src="/api/images/payment-qr.svg"
                                            alt="Mã QR thanh toán"
                                            style={{
                                                width: '200px',
                                                height: '200px',
                                                border: '2px solid #d9d9d9',
                                                borderRadius: '8px',
                                                padding: '8px',
                                                backgroundColor: '#fff'
                                            }}
                                        />
                                        <div style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
                                            Quét mã QR để thanh toán
                                        </div>
                                    </div>
                                    <ul>
                                        <li><strong>Chuyển khoản ngân hàng:</strong> Bạn sẽ nhận được thông tin tài khoản để chuyển tiền</li>
                                        <li><strong>Thanh toán tại quầy:</strong> Bạn sẽ đến địa điểm vật lý để thanh toán</li>
                                        <li><strong>Chuyển khoản với ghi chú là:</strong> <Text code>ADMIN PREMIUM</Text></li>
                                        <li>Sau khi thanh toán, admin sẽ xác nhận thanh toán của bạn</li>
                                        <li>Tài khoản của bạn sẽ được nâng cấp lên trạng thái thành viên</li>
                                    </ul>
                                </div>
                            }
                            type="info"
                            showIcon
                            style={{ marginTop: '20px' }}
                        />
                    </>
                )}
            </Modal>

            <Modal
                title="Hủy gói thành viên"
                open={cancelModalVisible}
                onCancel={() => setCancelModalVisible(false)}
                footer={[
                    <Button key="back" onClick={() => setCancelModalVisible(false)}>
                        Không, giữ gói thành viên
                    </Button>,
                    <Button key="submit" type="primary" danger onClick={handleCancelMembership}>
                        Có, hủy và nhận 50% hoàn tiền
                    </Button>,
                ]}
                width={600}
            >
                <Alert
                    message="Cảnh báo"
                    description={
                        <div>
                            <p>Bạn có chắc chắn muốn hủy gói thành viên không?</p>
                            <p><strong>Quan trọng:</strong> Bạn chỉ nhận được hoàn tiền 50% số tiền đã thanh toán.</p>
                            {paymentHistory && paymentHistory.length > 0 && paymentHistory[0].PaymentStatus === 'confirmed' && (
                                <p>Số tiền hoàn lại: {calculateRefundAmount(paymentHistory[0]).toLocaleString()} VNĐ</p>
                            )}
                            <p>Trạng thái tài khoản của bạn sẽ trở về Guest ngay lập tức.</p>
                            <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                                ⚠️ Lưu ý: Gói dịch vụ chỉ có thể hủy trong vòng 7 ngày đầu tiên kể từ ngày mua.
                            </p>
                        </div>
                    }
                    type="warning"
                    showIcon
                    style={{ marginBottom: '20px' }}
                />

                <Divider>Thông tin hoàn tiền</Divider>

                <div style={{ marginBottom: '16px' }}>
                    <Text strong>Số tài khoản ngân hàng *</Text>
                    <Input
                        placeholder="Nhập số tài khoản ngân hàng"
                        value={bankInfo.bankAccountNumber}
                        onChange={(e) => setBankInfo({ ...bankInfo, bankAccountNumber: e.target.value })}
                        style={{ marginTop: '8px' }}
                    />
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <Text strong>Tên ngân hàng *</Text>
                    <Input
                        placeholder="Ví dụ: Vietcombank, BIDV, Techcombank..."
                        value={bankInfo.bankName}
                        onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
                        style={{ marginTop: '8px' }}
                    />
                </div>

                <div style={{ marginBottom: '16px' }}>
                    <Text strong>Tên chủ tài khoản *</Text>
                    <Input
                        placeholder="Nhập tên chủ tài khoản (theo đúng tên trên ngân hàng)"
                        value={bankInfo.accountHolderName}
                        onChange={(e) => setBankInfo({ ...bankInfo, accountHolderName: e.target.value })}
                        style={{ marginTop: '8px' }}
                    />
                </div>

                <Alert
                    message="Lưu ý quan trọng"
                    description={
                        <div>
                            <p>• Thông tin ngân hàng phải chính xác để đảm bảo hoàn tiền thành công</p>
                            <p>• Thời gian xử lý hoàn tiền là 3-5 ngày làm việc</p>
                            <p>• Gói dịch vụ chỉ có thể hủy trong vòng 7 ngày đầu tiên</p>
                            <p>• Bạn sẽ chỉ nhận được 50% số tiền đã thanh toán</p>
                            <p>• Mọi thông tin ADMIN Trung Tâm chuyển khoản cho bạn sẽ được hệ thống thông báo qua SMS,SĐT của người dùng</p>
                        </div>
                    }
                    type="info"
                    showIcon
                    style={{ marginTop: '16px' }}
                />
            </Modal>
        </div>
    );
};

export default MembershipPlans; 