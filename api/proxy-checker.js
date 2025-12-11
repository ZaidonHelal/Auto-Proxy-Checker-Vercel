import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent"; // نبقيها احتياطاً
import axios from "axios"; // تم الإضافة: ضروري جداً
import UserAgent from "user-agents"; // تم الإضافة: ضروري جداً

/**
 * Helper function to set CORS headers on the response.
 */
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

export default async function handler(req, res) {
  // Set CORS headers for every request
  setCorsHeaders(res);

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const proxyDetails = req.body;

  if (!proxyDetails || !proxyDetails.type || !proxyDetails.ip || !proxyDetails.port) {
    return res.status(400).json({ status: "fail", error: "Incomplete proxy details provided" });
  }

  try {
    // 1. توليد User Agent عشوائي
    const userAgent = new UserAgent().toString();

    // 2. تجهيز التوثيق (Username/Password)
    let authObj = null;
    let authPart = "";
    
    if (proxyDetails.username && proxyDetails.password) {
      authObj = {
        username: proxyDetails.username,
        password: proxyDetails.password
      };
      // تجهيز الرابط النصي للـ Socks
      authPart = `${encodeURIComponent(proxyDetails.username)}:${encodeURIComponent(proxyDetails.password)}@`;
    }

    const protocol = proxyDetails.type.toLowerCase();
    const proxyUrlString = `${protocol}://${authPart}${proxyDetails.ip}:${proxyDetails.port}`;
    
    // 3. إعدادات Axios الأساسية
    const axiosConfig = {
      headers: { "User-Agent": userAgent },
      timeout: 10000, // تقليل الوقت لـ 10 ثواني لتفادي توقف Vercel المفاجئ
    };

    // 4. منطق اختيار البروكسي (السر في هذا الجزء)
    if (protocol.startsWith("socks")) {
      // SOCKS يحتاج إلى Agent خاص دائماً
      const socksAgent = new SocksProxyAgent(proxyUrlString);
      axiosConfig.httpAgent = socksAgent;
      axiosConfig.httpsAgent = socksAgent;
      axiosConfig.proxy = false; // نلغي بروكسي Axios الأصلي
    } else {
      // HTTP/HTTPS Proxy
      // الحل لمشكلة stream aborted: نستخدم دعم Axios الأصلي للبروكسي بدلاً من Agent خارجي
      // هذا يسمح لـ Axios بالتعامل بذكاء مع اتصالات HTTP العادية دون محاولة عمل Tunnel خاطئ
      axiosConfig.proxy = {
        protocol: 'http', // Axios غالباً يحتاج البروتوكول http للاتصال بالبروكسي نفسه
        host: proxyDetails.ip,
        port: parseInt(proxyDetails.port),
        auth: authObj // تمرير التوثيق هنا مباشرة
      };
      
      // نتأكد من عدم وجود Agents لتجنب التعارض
      axiosConfig.httpAgent = undefined;
      axiosConfig.httpsAgent = undefined;
    }

    // الهدف: ip-api (http)
    const targetUrl = "http://ip-api.com/json";

    const response = await axios.get(targetUrl, axiosConfig);

    if (response.data.status === "fail") {
      throw new Error(`IP-API check failed: ${response.data.message}`);
    }

    res.status(200).json({
      status: "success",
      isWorking: true,
      data: {
        up: true,
        internet: true,
        ip: response.data.query,
        country: response.data.country,
        isp: response.data.isp,
        city: response.data.city,
        regionName: response.data.regionName,
      },
    });

  } catch (error) {
    console.error("Proxy Check Error:", error.message);

    let errorMessage = error.message;
    if (
      error.code === "ECONNRESET" ||
      error.code === "ECONNABORTED" ||
      error.message.toLowerCase().includes("timeout")
    ) {
      errorMessage = "Proxy connection timed out.";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage = "Proxy connection refused.";
    } else if (errorMessage.includes("stream has been aborted")) {
        errorMessage = "Connection reset by proxy (Protocol mismatch).";
    }

    res.status(500).json({
      status: "fail",
      isWorking: false,
      data: {
        up: false,
        reason: errorMessage,
      },
    });
  }
}
