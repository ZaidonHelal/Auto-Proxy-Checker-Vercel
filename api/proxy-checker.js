import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import axios from "axios"; // 1. تم إضافة هذا
import UserAgent from "user-agents"; // 2. تم إضافة هذا

/**
 * Helper function to set CORS headers on the response.
 */
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

export default async function handler(req, res) {
  setCorsHeaders(res);

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
    // التأكد من تهيئة UserAgent بشكل صحيح
    const userAgent = new UserAgent().toString();

    let authPart = "";
    if (proxyDetails.username) {
      authPart = encodeURIComponent(proxyDetails.username);
      if (proxyDetails.password) {
        authPart += `:${encodeURIComponent(proxyDetails.password)}`;
      }
      authPart += "@";
    }

    // التأكد من أن النوع بأحرف صغيرة (http وليس HTTP)
    const protocol = proxyDetails.type.toLowerCase();
    const proxyUrlString = `${protocol}://${authPart}${proxyDetails.ip}:${proxyDetails.port}`;
    
    // إعداد إعدادات الاتصال
    const axiosConfig = {
      headers: { "User-Agent": userAgent },
      timeout: 10000, // تقليل الوقت ليتناسب مع Vercel Free Tier (أحياناً 10 ثواني)
      proxy: false, // مهم جداً عند استخدام agents مخصصة
    };

    if (protocol.startsWith("socks")) {
      const socksAgent = new SocksProxyAgent(proxyUrlString);
      axiosConfig.httpAgent = socksAgent;
      axiosConfig.httpsAgent = socksAgent;
    } else if (protocol.startsWith("http")) {
      // HttpsProxyAgent يعمل عادة للبروتوكولين، لكن يجب الحذر مع HTTP-Only
      const httpAgent = new HttpsProxyAgent(proxyUrlString);
      axiosConfig.httpAgent = httpAgent;
      axiosConfig.httpsAgent = httpAgent;
    } else {
      return res.status(400).json({ status: "fail", error: "Unsupported proxy protocol" });
    }

    // استخدام موقع يدعم HTTP و HTTPS لتجنب مشاكل الشهادات مع البروكسيات الرخيصة
    // ip-api ممتاز ولكنه http فقط في النسخة المجانية، مما قد يسبب مشاكل مع بعض أنواع الـ Agents التي تحاول عمل Tunneling
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
    console.error("Proxy Check Error:", error.message); // تسجيل الخطأ في Vercel Logs

    let errorMessage = error.message;
    if (
      error.code === "ECONNRESET" ||
      error.code === "ECONNABORTED" ||
      error.message.toLowerCase().includes("timeout")
    ) {
      errorMessage = "Proxy connection timed out.";
    } else if (error.code === "ECONNREFUSED") {
      errorMessage = "Proxy connection refused.";
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
