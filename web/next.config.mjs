/** @type {import('next').NextConfig} */
const API = process.env.CONSOLE_API ?? "http://127.0.0.1:8000";

// Proxy the FastAPI server through Next so the browser only ever talks to one
// origin. CORS is then structurally impossible to hit mid-demo.
const nextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
};

export default nextConfig;
