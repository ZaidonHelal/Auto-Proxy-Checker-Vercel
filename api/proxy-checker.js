import axios from "axios";
import UserAgent from "user-agents";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";

/**
 * Helper function to set CORS headers on the response.
 * This allows the API to be called from any domain.
 * @param {object} res - The response object from the handler.
 */
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow any origin
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Allow POST and OPTIONS methods
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Allow Content-Type header
};

export default async function handler(req, res) {
  // Set CORS headers for every request
  setCorsHeaders(res);

  // Browsers send a preflight OPTIONS request to check CORS permissions.
  // We need to handle this and send a successful response.
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow POST requests for the actual proxy check
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const proxyDetails = req.body;

  if (!proxyDetails || !proxyDetails.type || !proxyDetails.ip || !proxyDetails.port) {
    return res.status(400).json({ status: "fail", error: "Incomplete proxy details provided" });
  }

  try {
    const userAgent = new UserAgent().toString();

    let authPart = "";
    if (proxyDetails.username) {
      authPart = encodeURIComponent(proxyDetails.username);
      if (proxyDetails.password) {
        authPart += `:${encodeURIComponent(proxyDetails.password)}`;
      }
      authPart += "@";
    }
    const proxyUrlString = `${proxyDetails.type}://${authPart}${proxyDetails.ip}:${proxyDetails.port}`;
    const proxyUrl = new URL(proxyUrlString);

    const axiosConfig = {
      headers: { "User-Agent": userAgent },
      timeout: 15000,
    };

    if (proxyUrl.protocol === "socks4:" || proxyUrl.protocol === "socks5:") {
      const socksAgent = new SocksProxyAgent(proxyUrlString);
      axiosConfig.httpAgent = socksAgent;
      axiosConfig.httpsAgent = socksAgent;
      axiosConfig.proxy = false;
    } else if (proxyUrl.protocol === "http:" || proxyUrl.protocol === "https:") {
      const httpAgent = new HttpsProxyAgent(proxyUrlString);
      axiosConfig.httpAgent = httpAgent;
      axiosConfig.httpsAgent = httpAgent;
      axiosConfig.proxy = false;
    } else {
      return res.status(400).json({ status: "fail", error: "Unsupported proxy protocol" });
    }

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
