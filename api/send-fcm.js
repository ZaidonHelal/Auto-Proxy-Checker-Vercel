import admin from 'firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // 1. استخراج الرابط (url) من الطلب الذي سيأتي من Cloudflare
  const { token, title, body, url } = req.body;

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
  }

  try {
    // 2. تجهيز رسالة الإشعار الأساسية
    const message = {
      token: token,
      notification: { title, body },
    };

    // 3. التعديل السحري: إضافة الرابط لجعل الإشعار قابلاً للضغط
    if (url) {
        message.webpush = {
            fcmOptions: {
                link: url // هذا سيجعل الإشعار يفتح الموقع عند الضغط عليه
            }
        };
    }

    await admin.messaging().send(message);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('FCM Error:', error);
    res.status(500).json({ error: error.message });
  }
}
