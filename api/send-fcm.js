import admin from 'firebase-admin';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { token, title, body } = req.body;

  // تهيئة فايربيس (تعمل مرة واحدة فقط)
  if (!admin.apps.length) {
    admin.initializeApp({
      // هنا سنستخدم متغير البيئة الذي سنضعه في إعدادات Vercel
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
    });
  }

  try {
    await admin.messaging().send({
      token: token,
      notification: { title, body }
    });
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('FCM Error:', error);
    res.status(500).json({ error: error.message });
  }
}
