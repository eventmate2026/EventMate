export default ({ name, otp }) => `
<h2>Hello ${name}</h2>
<p>Password reset OTP:</p>
<h1>${otp}</h1>
<p>Valid for 5 minutes</p>
`;
