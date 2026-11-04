const SITE_URL = "https://shirochan-nel.netlify.app";
const SUPABASE_URL = "https://wbcjcpnwgthsnwmwimcq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_wI35EBfLjmNSWSfoSdOTOg_yakM_OdI";

function xmlEscape(value) {
  return String(value ?? "").replace(/[<>&'\"]/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;"
  })[char]);
}

export default async () => {
  try {
    const endpoint = new URL(`${SUPABASE_URL}/rest/v1/videos`);
    endpoint.searchParams.set("select", "id,created_at");
    endpoint.searchParams.set("order", "created_at.desc");

    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      return new Response("Unable to load video list", {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }

    const videos = await response.json();
    const urls = [
      `<url><loc>${SITE_URL}/</loc></url>`,
      ...videos
        .filter((video) => video && video.id !== undefined && video.id !== null)
        .map((video) => {
          const loc = `${SITE_URL}/?video=${encodeURIComponent(String(video.id))}`;
          const lastmod = video.created_at
            ? `<lastmod>${xmlEscape(new Date(video.created_at).toISOString())}</lastmod>`
            : "";
          return `<url><loc>${xmlEscape(loc)}</loc>${lastmod}</url>`;
        })
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=300",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Sitemap generation failed", error);
    return new Response("Sitemap generation failed", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
