import admin from 'firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  let { token, title, body, url } = req.body;

  console.log("Received Data from Worker before cleaning:", { token, title, body, url });

  // التحقق من صحة التوكن
  if (!token || typeof token !== 'string' || token.trim() === '') {
      console.error("FCM Error: Token is missing or invalid.");
      return res.status(400).json({ error: 'Missing or invalid FCM token' });
  }

  // 🔴 الحل الجذري للمشكلة: تنظيف النص من كل المسافات الفارغة الزائدة
  if (typeof body === 'string') {
      // هذا السطر يمسح أي مسافات زائدة في بداية كل سطر
      body = body.replace(/^[ \t]+/gm, '').trim(); 
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
  }

  try {
    const message = {
      token: token,
      notification: { 
          title: String(title || 'Notification'), 
          body: String(body || '') 
      }
    };

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
