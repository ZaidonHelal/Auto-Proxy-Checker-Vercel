import admin from 'firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // 1. استخراج المتغيرات
  const { token, title, body, url } = req.body;

  // 🔴 سطر جديد لطباعة ما يصل إلى Vercel في الـ Logs لاكتشاف الخلل
  console.log("Received Data from Worker:", { token, title, body, url });

  // 🔴 إضافة تحقق صارم: إذا كان التوكن مفقوداً أو فارغاً، أوقف العملية فوراً
  if (!token || typeof token !== 'string' || token.trim() === '') {
      console.error("FCM Error: Token is missing or invalid.");
      return res.status(400).json({ error: 'Missing or invalid FCM token' });
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
  }

  try {
    // 2. تجهيز رسالة الإشعار الأساسية (مع التأكد من تحويل العناوين لنصوص صريحة)
    const message = {
      token: token,
      notification: { 
          title: String(title || 'Notification'), 
          body: String(body || '') 
      },
    };

    // 3. إضافة الرابط لجعل الإشعار قابلاً للضغط
    if (url) {
        message.webpush = {
            fcmOptions: {
                link: url 
            }
        };
    }

    await admin.messaging().send(message);
    console.log("FCM Notification sent successfully!");
    res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('FCM Error Details:', error);
    res.status(500).json({ error: error.message });
  }
}
