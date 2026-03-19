export default({ name, otp }) => `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
    
    <h2 style="color: #111827;">Hi ${name},</h2>
    
    <p>Welcome to <strong>EventMate</strong> 🎉</p>
    
    <p>Your email verification OTP is:</p>

    <div style="
      margin: 24px 0;
      padding: 16px;
      background-color: #f3f4f6;
      text-align: center;
      border-radius: 8px;
    ">
      <h1 style="letter-spacing: 4px; color: #111827;">${otp}</h1>
    </div>

    <p>This OTP is valid for <strong>10 minutes</strong>.</p>

    <p style="color: #6b7280; font-size: 13px;">
      If you did not request this, you can safely ignore this email.
    </p>

  </div>
`;