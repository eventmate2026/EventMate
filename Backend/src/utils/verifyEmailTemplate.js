export default ({ name, otp }) => `
<h2>Hello ${name}</h2>
<p>Your email verification OTP:</p>
<h1>${otp}</h1>
<p>Valid for 10 minutes</p>
`;
