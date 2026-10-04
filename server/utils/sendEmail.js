const createTransporter = require('../config/email');

const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = await createTransporter();

    const info = await transporter.sendMail({
      from: `"Pizza Man 🍕" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`📧 Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('Email send error:', error.message);
    throw error;
  }
};

module.exports = sendEmail;
