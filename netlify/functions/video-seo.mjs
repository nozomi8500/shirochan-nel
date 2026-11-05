const SITE_URL = "https://shirochan-nel.netlify.app";
const SUPABASE_URL = "https://wbcjcpnwgthsnwmwimcq.supabase.co";
const SUPABASE_KEY = "sb_publishable_wI35EBfLjmNSWSfoSdOTOg_yakM_OdI";

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function safeURL(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function getThumbnail(value) {
  const raw = String(value || "").trim();

  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    return safeURL(raw);
  }

  let path = raw.replace(/^\/+/, "");

  if (path.startsWith("thumbnails/")) {
    path = path.slice("thumbnails/".length);
  }

  return (
    `${SUPABASE_URL}/storage/v1/object/public/thumbnails/` +
    path.split("/").map(encodeURIComponent).join("/")
  );
}

function replaceMeta(html, selector, value) {
  const escaped = escapeHTML(value);

  const regex = new RegExp(
    `(<meta\\s+${selector}\\s+content=")[^"]*(")`,
    "i"
  );

  return html.replace(regex, (_, before, after) =>
    before + escaped + after
  );
}

export default async function handler(request, context) {
  const url = new URL(request.url);
  const videoId = url.searchParams.get("video");

  if (!videoId || !/^\d+$/.test(videoId)) {
    return context.next();
  }

  try {
    const endpoint = new URL(`${SUPABASE_URL}/rest/v1/videos`);

    endpoint.searchParams.set(
      "select",
      "id,title,url,thumbnail,actress,tags,description,created_at"
    );
    endpoint.searchParams.set("id", `eq.${videoId}`);
    endpoint.searchParams.set("limit", "1");

    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return context.next();
    }

    const videos = await response.json();
    const video = videos[0];

    if (!video) {
      return context.next();
    }

    const originalResponse = await context.next();

    if (!originalResponse.ok) {
      return originalResponse;
    }

    const contentType =
      originalResponse.headers.get("content-type") || "";

    if (!contentType.includes("text/html")) {
      return originalResponse;
    }

    let html = await originalResponse.text();

    const title = String(video.title || "無題の動画");
    const fullTitle = `${title} | 素人ちゃんねる`;

    const description = String(
      video.description ||
      `${title}。素人ちゃんねるで動画の詳細を確認できます。`
    ).slice(0, 300);

    const pageURL =
      `${SITE_URL}/?video=${encodeURIComponent(String(video.id))}`;

    const thumbnail = getThumbnail(video.thumbnail);

    html = html.replace(
      /<title>[\s\S]*?<\/title>/i,
      `<title>${escapeHTML(fullTitle)}</title>`
    );

    html = replaceMeta(
      html,
      'name="description"',
      description
    );

    html = html.replace(
      /(<link\s+id="canonicalUrl"\s+rel="canonical"\s+href=")[^"]*(")/i,
      (_, before, after) =>
        before + escapeHTML(pageURL) + after
    );

    html = replaceMeta(
      html,
      'property="og:title"',
      fullTitle
    );

    html = replaceMeta(
      html,
      'property="og:description"',
      description
    );

    html = replaceMeta(
      html,
      'property="og:url"',
      pageURL
    );

    html = replaceMeta(
      html,
      'property="og:image"',
      thumbnail
    );

    html = replaceMeta(
      html,
      'property="og:type"',
      "article"
    );

    html = replaceMeta(
      html,
      'name="twitter:title"',
      fullTitle
    );

    html = replaceMeta(
      html,
      'name="twitter:description"',
      description
    );

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: title,
      description,
      url: pageURL,
      uploadDate: video.created_at,
      publisher: {
        "@type": "Organization",
        name: "素人ちゃんねる",
        url: `${SITE_URL}/`
      }
    };

    if (thumbnail) {
      structuredData.thumbnailUrl = [thumbnail];
    }

    const jsonLD = JSON.stringify(structuredData)
      .replace(/</g, "\\u003c");

    html = html.replace(
      /<script\s+id="videoStructuredData"\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
      `<script id="videoStructuredData" type="application/ld+json">${jsonLD}</script>`
    );

    const headers = new Headers(originalResponse.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("cache-control", "public, max-age=60");

    return new Response(html, {
      status: originalResponse.status,
      headers
    });

  } catch (error) {
    console.error("Video SEO Edge Function error:", error);
    return context.next();
  }
}

export const config = {
  path: "/",
  excludedPath: [
    "/.netlify/*",
    "/sitemap.xml",
    "/admin.html"
  ]
};
