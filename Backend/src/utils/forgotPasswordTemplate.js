export default({ name, otp }) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
    
    <h2 style="color: #111827;">Hi ${name},</h2>
    
    <p>You requested to reset your password for <strong>EventMate</strong>.</p>
    
    <p>Your OTP is:</p>

    <div style="
      margin: 24px 0;
      padding: 16px;
      background-color: #fef2f2;
      text-align: center;
      border-radius: 8px;
    ">
      <h1 style="letter-spacing: 4px; color: #dc2626;">${otp}</h1>
    </div>

    <p>This OTP is valid for <strong>5 minutes</strong>.</p>

    <p style="color: #6b7280; font-size: 13px;">
      If you did not request a password reset, please ignore this email.
    </p>

  </div>
`;