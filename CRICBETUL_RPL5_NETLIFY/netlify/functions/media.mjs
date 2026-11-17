import { getStore } from "@netlify/blobs";

export default async (event) => {
  const key = String(event.queryStringParameters?.key || "");
  if (!/^[a-f0-9-]{36}\.(?:jpg|png|webp)$/.test(key)) {
    return { statusCode: 400, headers: { "Cache-Control": "no-store" }, body: "Invalid media key" };
  }
  try {
    const store = getStore("rpl-season5-media");
    const blob = await store.get(key, { type: "blob" });
    if (!blob) return { statusCode: 404, headers: { "Cache-Control": "no-store" }, body: "Not found" };
    const buffer = Buffer.from(await blob.arrayBuffer());
    return {
      statusCode: 200,
      headers: {
        "Content-Type": blob.type || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
      body: buffer.toString("base64"),
      isBase64Encoded: true,
    };
  } catch {
    return { statusCode: 503, headers: { "Cache-Control": "no-store" }, body: "Media storage unavailable" };
  }
};
