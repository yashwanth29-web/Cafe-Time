const nodemailer = require('nodemailer');

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_APP_PASSWORD
  }
});

/**
 * Send an OTP code to a user's email
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit OTP code
 */
const sendOTP = async (email, otp) => {
  const mailOptions = {
    from: `"Cypher's Café" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject: 'Your Cafe Access Verification Code',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background-color: #FAF6F0; border-radius: 12px; border: 1px solid #E6D5C3; color: #4A3E3D;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #6F4E37; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 0.5px;">Cypher's Café</h2>
          <p style="color: #A0826C; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px;">Staff & Owner Access</p>
        </div>
        
        <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(111, 78, 55, 0.05); text-align: center; border: 1px solid #F0E6DC;">
          <p style="font-size: 16px; margin: 0 0 20px 0; color: #5C4D4D;">Use the verification code below to complete your login session. This code is active for <strong>5 minutes</strong>.</p>
          
          <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #6F4E37; background-color: #FDFBF7; border: 2px dashed #D4C3B3; display: inline-block; padding: 12px 30px; border-radius: 8px; margin-bottom: 20px;">
            ${otp}
          </div>
          
          <p style="font-size: 12px; color: #9E8E8E; margin: 0;">If you did not initiate this request, please disregard this email or contact security.</p>
        </div>
        
        <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #A0826C;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} Cypher's Café. All rights reserved.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Verification OTP email sent to ${email}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Error sending OTP email to ${email}:`, error);
    throw new Error('Failed to send verification email. Please try again.');
  }
};

/**
 * Send a welcome email when a new Cafe Owner or Staff account is created
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} role - Account role ('admin' | 'staff')
 * @param {object} details - Additional details (cafeName, cafeId, staffRole)
 */
const sendWelcomeEmail = async (email, name, role, details) => {
  const roleDisplay = role === 'admin' ? 'Cafe Owner' : `Staff (${details.staffRole || 'Member'})`;
  const cafeInfo = details.cafeName 
    ? `<p style="margin: 8px 0; color: #5C4D4D;"><strong>Cafe Name:</strong> ${details.cafeName}</p>` 
    : '';
  const cafeIdInfo = details.cafeId 
    ? `<p style="margin: 8px 0; color: #5C4D4D;"><strong>Cafe ID:</strong> ${details.cafeId}</p>` 
    : '';

  const mailOptions = {
    from: `"Cypher's Café" <${process.env.SMTP_EMAIL}>`,
    to: email,
    subject: 'Welcome to Cypher\'s Café - Account Registered',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background-color: #FAF6F0; border-radius: 12px; border: 1px solid #E6D5C3; color: #4A3E3D;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h2 style="color: #6F4E37; margin: 0; font-size: 28px; font-weight: 700;">Cypher's Café</h2>
          <p style="color: #A0826C; margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px;">Account Registered</p>
        </div>
        
        <div style="background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 4px 6px rgba(111, 78, 55, 0.05); border: 1px solid #F0E6DC;">
          <h3 style="color: #6F4E37; margin-top: 0; font-size: 20px;">Hello ${name},</h3>
          <p style="font-size: 15px; line-height: 1.6; color: #5C4D4D; margin-bottom: 20px;">Your portal account has been successfully registered by your system administrator. Here are your details:</p>
          
          <div style="background-color: #FDFBF7; padding: 15px; border-radius: 6px; border-left: 4px solid #6F4E37; margin-bottom: 20px;">
            <p style="margin: 8px 0; color: #5C4D4D;"><strong>Role:</strong> ${roleDisplay}</p>
            <p style="margin: 8px 0; color: #5C4D4D;"><strong>Email:</strong> ${email}</p>
            ${cafeInfo}
            ${cafeIdInfo}
          </div>
          
          <p style="font-size: 15px; line-height: 1.6; color: #5C4D4D; margin-bottom: 20px;">You can now log in using your email address. We use passwordless email-OTP verification for security—no password required.</p>
          
          <div style="text-align: center; margin-top: 25px;">
            <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/login" style="background-color: #6F4E37; color: #ffffff; text-decoration: none; padding: 12px 30px; font-weight: bold; border-radius: 6px; display: inline-block; box-shadow: 0 3px 6px rgba(111, 78, 55, 0.2);">Go to Login Portal</a>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 25px; font-size: 12px; color: #A0826C;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} Cypher's Café. All rights reserved.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Welcome email sent to ${email}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Error sending welcome email to ${email}:`, error);
    // Log error but don't fail the registration request completely
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOTP,
  sendWelcomeEmail
};
