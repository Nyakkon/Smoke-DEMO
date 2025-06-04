import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axiosInstance, { API_URL } from '../../utils/axiosConfig';

// Async thunks
export const fetchMembershipPlans = createAsyncThunk(
    'membership/fetchPlans',
    async (_, { rejectWithValue }) => {
        try {
            console.log('Fetching plans from:', `${API_URL}/membership/plans`);
            const response = await axiosInstance.get(`/membership/plans`);
            return {
                plans: response.data.data,
                message: response.data.message
            };
        } catch (error) {
            console.error('Error fetching plans:', error);
            return rejectWithValue(error.response?.data || { message: 'Failed to fetch plans' });
        }
    }
);

export const getCurrentMembership = createAsyncThunk(
    'membership/getCurrent',
    async (_, { rejectWithValue }) => {
        try {
            // Check for token first
            const token = localStorage.getItem('token');
            if (!token) {
                console.log('No token available for getCurrentMembership');
                return null;
            }

            console.log('Fetching current membership with token');
            const response = await axiosInstance.get(`/membership/current`);
            console.log('Current membership response:', response.data);

            if (response.data && response.data.data) {
                return response.data.data;
            } else {
                console.log('No current membership found or membership data is null');
                return null;
            }
        } catch (error) {
            console.error('Error in getCurrentMembership:', error);

            if (error.response && error.response.status === 401) {
                console.log('Authentication error in getCurrentMembership - user not logged in or token invalid');
                // Don't consider this a real error, just return null
                return null;
            }

            return rejectWithValue(
                error.response?.data?.message ||
                error.message ||
                'Failed to fetch current membership'
            );
        }
    }
);

export const purchaseMembership = createAsyncThunk(
    'membership/purchase',
    async ({ planId, paymentMethod }, { rejectWithValue }) => {
        try {
            console.log('🚀 Starting purchase request with:', { planId, paymentMethod });

            const response = await axiosInstance.post(
                `/membership/purchase`,
                { planId, paymentMethod },
                {
                    timeout: 10000, // 10 second timeout
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('📨 Raw response received:', {
                status: response.status,
                statusText: response.statusText,
                data: response.data,
                success: response.data?.success
            });

            // Check if we got a successful response
            if (response.status === 201 || response.status === 200) {
                // Even if there's no explicit success field, treat 2xx as success
                if (response.data) {
                    console.log('✅ Purchase completed successfully');
                    return response.data;
                }
            }

            // If we reach here, something went wrong
            console.warn('⚠️ Unexpected response format:', response.data);
            return response.data || { success: true, message: 'Purchase completed' };

        } catch (error) {
            console.error('❌ Purchase error caught:', error);

            // Log detailed error information
            console.error('Error details:', {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                statusText: error.response?.statusText
            });

            // Handle different error scenarios
            if (error.response) {
                // Server responded with error status
                const errorData = error.response.data;
                console.error('Server error response:', errorData);

                return rejectWithValue({
                    message: errorData?.message || `Server error: ${error.response.status}`,
                    status: error.response.status,
                    debug: errorData?.debug
                });
            } else if (error.request) {
                // Request was made but no response received (timeout, network issue)
                console.error('Network/timeout error:', error.request);
                return rejectWithValue({
                    message: 'Network error or timeout. Please check your connection.',
                    status: 'network_error'
                });
            } else {
                // Something else went wrong
                console.error('Unknown error:', error.message);
                return rejectWithValue({
                    message: error.message || 'Unknown error occurred',
                    status: 'unknown_error'
                });
            }
        }
    }
);

export const getMembershipHistory = createAsyncThunk(
    'membership/getHistory',
    async (_, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.get(`/membership/history`);
            return response.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || { message: 'Failed to fetch membership history' });
        }
    }
);

export const cancelMembership = createAsyncThunk(
    'membership/cancel',
    async ({ bankAccountNumber, bankName, accountHolderName }, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.post(`/membership/cancel`, {
                reason: 'User requested cancellation',
                bankAccount: bankAccountNumber || bankName || accountHolderName || 'Bank info provided'
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || { message: 'Failed to cancel membership' });
        }
    }
);

export const getRefundRequests = createAsyncThunk(
    'membership/getRefundRequests',
    async (_, { rejectWithValue }) => {
        try {
            const response = await axiosInstance.get(`/membership/refund-requests`);
            return response.data.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || { message: 'Failed to fetch refund requests' });
        }
    }
);

const initialState = {
    plans: [],
    currentMembership: null,
    membershipHistory: [],
    refundRequests: [],
    loading: false,
    error: null,
    success: false,
    message: null,
    paymentHistory: [],
};

const membershipSlice = createSlice({
    name: 'membership',
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        clearSuccess: (state) => {
            state.success = false;
        },
        setCurrentMembership: (state, action) => {
            state.currentMembership = action.payload;
            state.success = true;
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Plans
            .addCase(fetchMembershipPlans.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchMembershipPlans.fulfilled, (state, action) => {
                state.loading = false;
                if (action.payload && action.payload.plans) {
                    state.plans = action.payload.plans;
                    state.message = action.payload.message;
                } else {
                    state.plans = [];
                    console.error('Invalid payload structure in fetchMembershipPlans');
                }
            })
            .addCase(fetchMembershipPlans.rejected, (state, action) => {
                state.loading = false;
                // Safely extract the error message
                if (action.payload && typeof action.payload === 'object' && action.payload.message) {
                    state.error = action.payload.message;
                } else if (typeof action.payload === 'string') {
                    state.error = action.payload;
                } else if (action.error && action.error.message) {
                    state.error = action.error.message;
                } else {
                    state.error = 'Failed to fetch plans';
                }
            })

            // Get Current Membership
            .addCase(getCurrentMembership.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(getCurrentMembership.fulfilled, (state, action) => {
                state.loading = false;
                state.currentMembership = action.payload;
                // Don't set success to true here as it would trigger notifications
            })
            .addCase(getCurrentMembership.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message || 'Failed to get current membership';
            })

            // Purchase Membership
            .addCase(purchaseMembership.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
            })
            .addCase(purchaseMembership.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;

                // Log the response to debug
                console.log('✅ Purchase fulfilled with response:', action.payload);

                // Handle the response - be more lenient about success
                if (action.payload) {
                    // If we have data, it means the request went through
                    if (action.payload.data) {
                        // Update current membership with the new data
                        if (action.payload.data.membership) {
                            state.currentMembership = action.payload.data.membership;
                        }

                        // Add to payment history
                        if (action.payload.data.payment) {
                            // Ensure payment history is an array
                            if (!state.paymentHistory) {
                                state.paymentHistory = [];
                            }

                            // Create payment record for history
                            const paymentRecord = {
                                ...action.payload.data.payment,
                                PlanName: action.payload.data.membership?.PlanName || 'Premium Plan',
                                PaymentStatus: action.payload.data.payment.Status || 'pending',
                                StartDate: action.payload.data.payment.StartDate,
                                EndDate: action.payload.data.payment.EndDate
                            };

                            // Add to beginning of array (most recent first)
                            state.paymentHistory.unshift(paymentRecord);
                        }

                        console.log('✅ State updated successfully:', {
                            currentMembership: state.currentMembership,
                            paymentHistoryLength: state.paymentHistory?.length || 0
                        });
                    }

                    // Set success based on whether we actually processed something
                    state.success = true;
                    state.message = action.payload.message || 'Purchase completed successfully';
                } else {
                    console.warn('⚠️ No payload in fulfilled response');
                    state.success = true; // Still mark as success since it fulfilled
                    state.message = 'Purchase completed';
                }
            })
            .addCase(purchaseMembership.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message || 'Failed to purchase membership';
                state.success = false;
            })

            // Get Membership History
            .addCase(getMembershipHistory.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(getMembershipHistory.fulfilled, (state, action) => {
                state.loading = false;
                state.membershipHistory = action.payload;
            })
            .addCase(getMembershipHistory.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message || 'Failed to get membership history';
            })

            // Cancel Membership
            .addCase(cancelMembership.pending, (state) => {
                state.loading = true;
                state.error = null;
                state.success = false;
            })
            .addCase(cancelMembership.fulfilled, (state, action) => {
                state.loading = false;
                state.currentMembership = null;
                state.success = true;
            })
            .addCase(cancelMembership.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message || 'Failed to cancel membership';
                state.success = false;
            })

            // Get Refund Requests
            .addCase(getRefundRequests.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(getRefundRequests.fulfilled, (state, action) => {
                state.loading = false;
                state.refundRequests = action.payload || [];
            })
            .addCase(getRefundRequests.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.message || 'Failed to get refund requests';
            });
    },
});

export const { clearError, clearSuccess, setCurrentMembership } = membershipSlice.actions;
export default membershipSlice.reducer; 