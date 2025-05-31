/**
 * Middleware kiểm tra role, case‐insensitive.
 * Sử dụng: authorize('admin','coach') → chỉ cho phép các role tương ứng truy cập.
 */
function authorize(...allowedRoles) {
  const allowed = allowedRoles.map(r => String(r).toLowerCase());

  return (req, res, next) => {
    console.log('🔍 Authorize middleware: Checking roles');
    console.log('🔍 Authorize middleware: Allowed roles:', allowed);
    console.log('🔍 Authorize middleware: User object:', req.user);
    
    const userRole = String(req.user?.Role || '').toLowerCase(); // Ensure role is correctly accessed
    console.log('🔍 Authorize middleware: User role (normalized):', userRole);
    
    if (!userRole) {
      console.error('❌ Authorize middleware: No role assigned');
      return res.status(403).json({ 
        success: false,
        message: 'Forbidden: no role assigned' 
      });
    }
    if (!allowed.includes(userRole)) {
      console.error('❌ Authorize middleware: Role not allowed:', userRole, 'Allowed:', allowed);
      return res.status(403).json({ 
        success: false,
        message: `Forbidden: you do not have access. Your role: ${userRole}, Required: ${allowed.join(', ')}` 
      });
    }
    
    console.log('✅ Authorize middleware: Access granted for role:', userRole);
    next();
  };
}

module.exports = authorize;
