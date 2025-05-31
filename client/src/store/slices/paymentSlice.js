import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async thunk to fetch payment data
export const getPayments = createAsyncThunk('payments/getPayments', async () => {
  const token = localStorage.getItem('token');  // Get the token from localStorage
  console.log('Token:', token);  // Log token
  const response = await axios.get('/api/admin/payments', {
    headers: {
      Authorization: `Bearer ${token}`,  // Attach token in Authorization header
    },
  });
  console.log('Response from API:', response);  // Log full response from API
  
  if (Array.isArray(response.data.data)) {  // Access response.data.data instead of just response.data
    return response.data.data;  // Return the payment array from the response
  } else {
    throw new Error('Dữ liệu trả về không phải là mảng');
  }
});


export const updatePaymentStatus = createAsyncThunk(
  'payments/updatePaymentStatus',
  async ({ paymentId, status }) => {
    const token = localStorage.getItem('token');  // Lấy token từ localStorage
    console.log('Token:', token);  // Log token
    const response = await axios.post('/api/admin/confirm-payment',  // Chỉ sử dụng URL gốc mà không có :paymentId
      { paymentId, status },  // Truyền paymentId và status qua body
      {
        headers: {
          Authorization: `Bearer ${token}`,  // Thêm token vào header
        },
      }
    );
    console.log('Response from update API:', response);  // Log phản hồi từ API
    return response.data;  // Trả về dữ liệu thanh toán đã cập nhật
  }
);


const paymentSlice = createSlice({
  name: 'payment',
  initialState: {
    payments: [],
    loading: false,
    error: null,
  },
  reducers: {
    // Optional: Clear the payments data when necessary (e.g., on logout)
    clearPayments: (state) => {
      state.payments = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(getPayments.pending, (state) => {
        state.loading = true;
      })
      .addCase(getPayments.fulfilled, (state, action) => {
        state.loading = false;

        // Kiểm tra nếu có các PaymentID trùng nhau
        const uniquePayments = new Set();
        action.payload.forEach(payment => {
          if (uniquePayments.has(payment.PaymentID)) {
            console.warn(`Duplicate PaymentID found: ${payment.PaymentID}`);
          } else {
            uniquePayments.add(payment.PaymentID);
          }
        });

        // Lưu dữ liệu thanh toán vào state
        console.log('Payments fetched successfully:', action.payload);  // Log payments data
        state.payments = action.payload;
      })
      .addCase(getPayments.rejected, (state, action) => {
        state.loading = false;
        console.log('Error fetching payments:', action.error.message);  // Log error message
        state.error = action.error.message;  // Save error message in state
      })
      .addCase(updatePaymentStatus.pending, (state) => {
        state.loading = true;  // Show loading while updating status
      })
      .addCase(updatePaymentStatus.fulfilled, (state, action) => {
  state.loading = false;
  console.log('Payment updated successfully:', action.payload);  // Log updated payment data
  const index = state.payments.findIndex(payment => payment.PaymentID === action.payload.PaymentID);
  if (index >= 0) {
    state.payments[index] = action.payload;  // Cập nhật trạng thái thanh toán trong Redux state
  }
})


      .addCase(updatePaymentStatus.rejected, (state, action) => {
        state.loading = false;
        console.log('Error updating payment:', action.error.message);  // Log error message
        state.error = action.error.message;  // Save error message if update fails
      });
  },
});

export const { clearPayments } = paymentSlice.actions;

export default paymentSlice.reducer;

