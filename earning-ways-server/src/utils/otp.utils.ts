import nodemailer from "nodemailer";
import crypto from "crypto";

// Generate OTP (4-digit)
export const generateOtp = (): string => {
  return crypto.randomInt(1000, 10000).toString(); // generates 1000-9999
};

// Send OTP via email using Nodemailer (Professional HTML email)
export const sendOtp = async (email: string, otp: string): Promise<void> => {
  try {
    // Configure transporter (Gmail example)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // your Gmail email from .env
        pass: process.env.EMAIL_APP_PASSWORD, // Gmail app password from .env
      },
    });

    // Professional HTML email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your One-Time Password (OTP) for Verification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e0e0e0; padding: 20px; border-radius: 8px; background-color: #f9f9f9;">
          <h2 style="color: #333;">Hello,</h2>
          <p style="font-size: 16px; color: #555;">
            You requested a One-Time Password (OTP) for verification with <strong>InstantDhaniCredit</strong>. Please use the OTP below to complete your process.
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #1a73e8; letter-spacing: 4px;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #777;">
            This OTP is valid for <strong>5 minutes</strong>. Do not share it with anyone.  
            If you did not request this OTP, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">
            © ${new Date().getFullYear()} InstantDhaniCredit. All rights reserved.
          </p>
        </div>
      `
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    // Never log the code itself: server logs are often shipped to third parties.
    console.log(`OTP email sent to ${email} | Message ID: ${info.messageId}`);
  } catch (error) {
    console.error("Error sending OTP email:", error);
    throw new Error("Failed to send OTP email");
  }
};
