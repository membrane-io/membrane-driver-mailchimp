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

// Converts urlencoded data into a JSON format.
export function toJSON(formData: string): Record<string, any> {
  const decodedData: string = decodeURIComponent(formData);
  const keyValuePairs: string[] = decodedData.split("&");
  const json: Record<string, any> = {};

  keyValuePairs.forEach((pair: string) => {
    const [key, value]: string[] = pair.split("=");
    const decodedKey: string = decodeURIComponent(key);
    const decodedValue: string = decodeURIComponent(value.replace(/\+/g, " "));
    let currentObject: Record<string, any> = json;
    const keys: string[] = decodedKey.split("[").map((key) => key.replace("]", ""));
    keys.forEach((key: string, index: number) => {
      if (!currentObject.hasOwnProperty(key)) {
        currentObject[key] = {};
      }
      if (index === keys.length - 1) {
        currentObject[key] = decodedValue;
      } else {
        currentObject = currentObject[key];
      }
    });
  });

  return json;
}
