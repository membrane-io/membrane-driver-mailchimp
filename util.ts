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
