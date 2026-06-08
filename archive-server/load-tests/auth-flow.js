/**
 * k6 auth flow test — tests the authentication endpoint specifically.
 * Run: k6 run load-tests/auth-flow.js
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:8787";
const successRate = new Rate("auth_success");

export const options = {
  stages: [
    { duration: "10s", target: 5  },
    { duration: "30s", target: 5  },
    { duration: "10s", target: 0  },
  ],
  thresholds: {
    http_req_duration: ["p(95)<300"],
    "auth_success":    ["rate>0.95"],
  },
};

export default function () {
  // Intentionally wrong password — just tests server handles load
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ username: `user_${Math.floor(Math.random() * 100)}`, password: "test_load_123" }),
    { headers: { "Content-Type": "application/json" } }
  );

  // We're load testing error handling, not success
  const ok = check(res, {
    "auth responds promptly": r => r.timings.duration < 500,
    "auth returns JSON":      r => { try { JSON.parse(r.body); return true; } catch { return false; } },
  });

  successRate.add(ok);
  sleep(1);
}
