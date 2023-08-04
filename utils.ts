import { state } from "membrane";

export async function api(method: string, path: string, query?: any, body?: string) {
  if (!state.token || !state.server) {
    throw new Error("You must first invoke the configure action with an API key");
  }
  if (query) {
    Object.keys(query).forEach((key) => (query[key] === undefined ? delete query[key] : {}));
  }
  const querystr = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : "";
  const url = `https://${state.server}.api.mailchimp.com/3.0/${path}${querystr}`;
  const req = {
    method,
    body,
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${state.token}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
  };
  return await fetch(url, req);
}