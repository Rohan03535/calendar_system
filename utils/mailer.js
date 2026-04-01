const nodemailer = require('nodemailer');

let transporter;

// Initiates a fake SMTP inbox specifically designed for testing purposes without needing real passwords.
async function initMailer() {
    try {
        let testAccount = await nodemailer.createTestAccount();
        
        transporter = nodemailer.createTransport({
            host: "smtp.ethereal.email",
            port: 587,
            secure: false, 
            auth: {
                user: testAccount.user, 
                pass: testAccount.pass, 
            },
        });
        console.log("Mock Email Service Initialized. Emails will generate viewable preview URLs.");
    } catch (err) {
        console.error("Failed to initialize mailer", err);
    }
}
initMailer();

async function sendEmailNotification(to_email, subject, text) {
    if(!transporter) return;
    try {
        let info = await transporter.sendMail({
            from: '"DBS Calendar System" <noreply@university.edu>',
            to: to_email,
            subject: subject,
            text: text,
        });
        
        // This generates a URL where you can literally see the email that was "sent"!
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log(`\n📧 EMAIL SENT TO ${to_email}\nView Email Preview Here: ${previewUrl}\n`);
        return previewUrl;
    } catch(err) {
        console.error("Mailer error:", err);
    }
}

module.exports = { sendEmailNotification };
