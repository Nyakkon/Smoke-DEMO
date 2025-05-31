// client/src/components/admin/AdminHome.jsx
import React from 'react';
import ExpiringSubscriptions from './ExpiringSubscriptions';
import QuittingUsers from './QuittingUsers';
import UsersNeedingSupport from './UsersNeedingSupport';

export default function AdminHome() {
  return (
    <div style={{ padding: 24 }}>
      {/* 1. Widget Gói sắp hết hạn */}
      <ExpiringSubscriptions />

      {/* 2. Widget QuittingUsers (nếu vẫn muốn giữ) */}
      <QuittingUsers />

      {/* 3. Widget UsersNeedingSupport (nếu muốn vẫn hiển thị) */}
      <UsersNeedingSupport />
    </div>
  );
}
