export default({ name, otp }) => `
  <div style="font-family: Arial, sans-serif; background-color: #f9fafb; padding: 40px 0;">
    
    <div style="max-width: 600px; margin: auto; background: #ffffff; padding: 30px; border-radius: 10px;">

      <h2 style="text-align: center; color: #16a34a;">EventMate</h2>

      <h3 style="color: #111827;">Welcome ${name} 👋</h3>

      <p style="color: #374151;">
        Thanks for joining EventMate! Please verify your email using the OTP below:
      </p>

      <div style="
        margin: 30px 0;
        padding: 20px;
        background-color: #ecfdf5;
        text-align: center;
        border-radius: 8px;
      ">
        <h1 style="letter-spacing: 6px; color: #16a34a; margin: 0;">
          ${otp}
        </h1>
      </div>

      <p style="color: #374151;">
        This OTP is valid for <strong>10 minutes</strong>.
      </p>

      <p style="color: #6b7280; font-size: 13px;">
        If you didn’t create an account, you can ignore this email.
      </p>

      <hr style="margin: 30px 0;" />

      <p style="text-align: center; font-size: 12px; color: #9ca3af;">
        © ${new Date().getFullYear()} EventMate. All rights reserved.
      </p>

    </div>
  </div>
`;