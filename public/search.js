const SERVER_ORIGIN = window.location.protocol === "file:"
  ? "http://127.0.0.1:4177"
  : window.location.hostname === "127.0.0.1" && ["4173", "4174", "4175", "4176", "4178"].includes(window.location.port)
    ? "http://127.0.0.1:4177"
    : "";
if (window.location.protocol === "file:") {
  window.location.href = `${SERVER_ORIGIN}/search.html${window.location.search}`;
}

const input = document.querySelector("#search-page-input");
const form = document.querySelector("#search-page-form");
const heading = document.querySelector("#search-heading");
const results = document.querySelector("#search-results");

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

async function runSearch(query) {
  input.value = query;
  heading.textContent = query ? `Search results for "${query}"` : "Search results";
  if (!query) {
    results.textContent = "Type a search term above.";
    return;
  }

  results.textContent = "Searching...";
  try {
    const response = await fetch(`${SERVER_ORIGIN}/api/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
    const data = await response.json();
    const buckets = data.buckets || [];
    const total = buckets.reduce((sum, bucket) => sum + bucket.items.length, 0);
    results.innerHTML = total ? buckets.map((bucket) => `
      <section class="result-bucket">
        <h2>${escapeHtml(bucket.bucket)}</h2>
        ${bucket.items.length ? `
          <ul>
            ${bucket.items.map((item) => `
              <li>
                <a href="${escapeHtml(item.link || "#")}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
                <small>${escapeHtml([item.source, item.bucket, item.summary].filter(Boolean).join(" · "))}</small>
              </li>
            `).join("")}
          </ul>
        ` : `<p>No matches in this bucket.</p>`}
      </section>
    `).join("") : "No matches found.";
  } catch {
    results.textContent = "Search failed. Make sure the local preview server is running.";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();
  if (!query) return;
  const url = new URL(window.location.href);
  url.searchParams.set("q", query);
  window.history.replaceState({}, "", url);
  runSearch(query);
});

runSearch(new URLSearchParams(window.location.search).get("q") || "");
