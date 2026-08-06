/**
 * Proxy agent utility for Kener HTTP monitor requests.
 *
 * Respects HTTPS_PROXY, HTTP_PROXY, ALL_PROXY, NO_PROXY environment variables.
 * Uses `proxy-from-env` for correct NO_PROXY matching and
 * `https-proxy-agent` / `http-proxy-agent` for tunnelling.
 */

import { getProxyForUrl } from "proxy-from-env";
import { HttpsProxyAgent } from "https-proxy-agent";
import { HttpProxyAgent } from "http-proxy-agent";
import type { Agent } from "https";

/**
 * Returns the appropriate proxy agent for the given target URL,
 * or `undefined` when no proxy is needed (direct connection or NO_PROXY match).
 *
 * @param targetUrl - The URL that will be requested (e.g. "https://api.example.com/status")
 * @param rejectUnauthorized - Whether to verify TLS certificates on the proxy connection.
 *                             Pass `false` to accept self-signed certs (NODE_TLS_REJECT_UNAUTHORIZED=0).
 */
export function getAgentForUrl(
	targetUrl: string,
	rejectUnauthorized = true,
): HttpsProxyAgent<string> | HttpProxyAgent<string> | undefined {
	const proxyUrl = getProxyForUrl(targetUrl);

	if (!proxyUrl) {
		return undefined;
	}

	const isHttpsTarget = targetUrl.toLowerCase().startsWith("https://");

	if (isHttpsTarget) {
		return new HttpsProxyAgent(proxyUrl, { rejectUnauthorized });
	}

	return new HttpProxyAgent(proxyUrl);
}

/**
 * Returns an object suitable for spreading into an axios config:
 *
 * - `httpsAgent` set when the target URL is HTTPS
 * - `httpAgent`  set when the target URL is HTTP
 * - `proxy: false` always, so axios does NOT try to apply its own proxy logic
 *   on top of the agent (which would cause double-proxying).
 */
export function getAxiosProxyConfig(
	targetUrl: string,
	rejectUnauthorized = true,
): {
	httpsAgent?: Agent;
	httpAgent?: HttpProxyAgent<string>;
	proxy: false;
} {
	const agent = getAgentForUrl(targetUrl, rejectUnauthorized);
	const isHttps = targetUrl.toLowerCase().startsWith("https://");

	return {
		...(agent && isHttps ? { httpsAgent: agent as unknown as Agent } : {}),
		...(agent && !isHttps ? { httpAgent: agent as HttpProxyAgent<string> } : {}),
		proxy: false, // disable axios built-in proxy handling
	};
}

