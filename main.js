import { fuzzyMatch } from "./fuzzyPlates.js";

const VEHICLE_FIELDS = ["color", "make", "model"];
const STORAGE_KEY = "fuzzyPlateData";

let userPlates = new Map();      // Map<string, { plate: string, rows: Array<{line:number, data:object}> }>
let firstLoadedAt = null;

function titleCase(s) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map(w => w ? w[0].toUpperCase() + w.slice(1) : "")
    .join(" ");
}

function extractVehicleSummary(rows) {
  const sets = { color: new Set(), make: new Set(), model: new Set() };

  for (const row of rows) {
    for (const field of VEHICLE_FIELDS) {
      const key = Object.keys(row.data).find(k => k.trim().toLowerCase() === field);
      if (!key) continue;
      const val = (row.data[key] ?? "").trim();
      if (val) sets[field].add(titleCase(val));
    }
  }

  const parts = [];
  if (sets.color.size) parts.push([...sets.color].join("/"));
  if (sets.make.size)  parts.push([...sets.make].join("/"));
  if (sets.model.size) parts.push([...sets.model].join("/"));
  return parts.join(" ");
}

function normalizePlateKey(str) {
  return str.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function formatTimestamp(ms) {
  return new Date(ms).toLocaleString();
}

function choosePlateColumnSimple(headers) {
  const plateCols = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /plate/i.test(h));

  if (plateCols.length === 0)  return { index: 0, name: headers[0] || "(first column)" };
  if (plateCols.length === 1)  return { index: plateCols[0].i, name: plateCols[0].h };

  const menu = plateCols.map((p, n) => `${n + 1}. ${p.h}`).join("\n");
  const answer = window.prompt(
    `Multiple columns contain “plate”. Which one should be used?\n\n${menu}\n\nEnter 1-${plateCols.length}:`,
    "1"
  );
  if (answer === null) return { index: -1, name: null };

  const n = parseInt(answer, 10);
  if (!Number.isInteger(n) || n < 1 || n > plateCols.length) return { index: -1, name: null };

  const pick = plateCols[n - 1];
  return { index: pick.i, name: pick.h };
}

function parsePlain(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const map = new Map();

  lines.forEach((plate, i) => {
    const key = normalizePlateKey(plate);
    if (!key) return;

    if (!map.has(key)) map.set(key, { plate, rows: [] });
    map.get(key).rows.push({ line: i + 1, data: { Source: "Plain", RawPlate: plate } });
  });

  return map;
}

function parseTSV(text, plateIndex) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split("\t").map(h => h.trim());
  const rows = lines.slice(1);
  const map = new Map();

  rows.forEach((line, i) => {
    const cols = line.split("\t");
    const raw = cols[plateIndex]?.trim();
    if (!raw) return;

    const key = normalizePlateKey(raw);
    if (!key) return;

    if (!map.has(key)) map.set(key, { plate: raw, rows: [] });

    const obj = {};
    headers.forEach((h, j) => { obj[h] = cols[j]?.trim() || ""; });

    map.get(key).rows.push({ line: i + 2, data: obj });
  });

  return map;
}

function savePlates() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ savedAt: firstLoadedAt, entries: Array.from(userPlates.entries()) })
  );
}

function loadPlatesFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const { savedAt, entries } = JSON.parse(raw);
    if (!savedAt || !entries) return;
    firstLoadedAt = savedAt;
    userPlates = new Map(entries);
    loadStatus.textContent = `${userPlates.size} unique plates (${formatTimestamp(firstLoadedAt)})`;
    render();
  } catch {
    console.warn("Corrupt saved data");
  }
}

const plateInput = document.getElementById("plateInput");
const loadBtn = document.getElementById("loadBtn");
const clearStoredPlates = document.getElementById("clearStoredPlates");
const loadStatus = document.getElementById("loadStatus");
const searchInput = document.getElementById("searchInput");
const results = document.getElementById("results");
const cidInput = document.getElementById("cidInput");
const loadFromCIDBtn = document.getElementById("loadFromCIDBtn");
const cidStatus = document.getElementById("cidStatus");

function loadUserPlates() {
  const cleaned = plateInput.value
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .join("\n");

  plateInput.value = cleaned;
  if (!cleaned) return;

  if (!cleaned.includes("\t")) {
    userPlates = parsePlain(cleaned);
  } else {
    const headers = cleaned.split(/\r?\n/)[0].split("\t").map(h => h.trim());
    const choice = choosePlateColumnSimple(headers);
    if (choice.index < 0) {
      loadStatus.textContent = "Import cancelled.";
      return;
    }
    userPlates = parseTSV(cleaned, choice.index);
  }

  firstLoadedAt = Date.now();
  savePlates();
  loadStatus.textContent = `${userPlates.size} unique plates (entered ${formatTimestamp(firstLoadedAt)})`;
  render();
}

async function loadFromCID() {
  const cid = cidInput.value.trim();
  if (!cid) {
    cidStatus.textContent = "Enter a CID first.";
    return;
  }

  const url = "https://dweb.link/ipfs/" + cid;
  cidStatus.textContent = "Fetching…";

  try {
    const r = await fetch(url);
    if (!r.ok) {
      cidStatus.textContent = `Fetch failed: ${r.status}`;
      return;
    }
    const text = await r.text();
    if (!text.trim()) {
      cidStatus.textContent = "File was empty.";
      return;
    }
    plateInput.value = text;
    loadUserPlates();
    cidStatus.textContent = "Successfully loaded from IPFS";
    plateInput.value = "";
  } catch (err) {
    cidStatus.textContent = "Error loading from IPFS";
    console.error(err);
  }
}

function currentPlates() {
  return userPlates.size
    ? Array.from(userPlates.keys()).reverse()
    : ["ABC123", "ABC I23", "AB0-123", "XYZ999", "Q0Q-8B8"];
}

function render() {
  const q = searchInput.value;
  results.innerHTML = "";

  let shown = 0;

  currentPlates().forEach(key => {
    const match = fuzzyMatch(key, q);
    if (!match.match) return;

    shown++;

    const li = document.createElement("li");
    const info = userPlates.get(key);

    if (!info) {
      li.innerHTML = `<div style="font-family:monospace;font-size:1.4rem;font-weight:bold">${match.rendered}</div>`;
      results.appendChild(li);
      return;
    }

    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.innerHTML = match.rendered;

    const summaryLine = extractVehicleSummary(info.rows);
    if (summaryLine) {
      const m = document.createElement("div");
      m.className = "sum-line";
      m.textContent = summaryLine;
      summary.appendChild(m);
    }

    details.appendChild(summary);

    info.rows.forEach(row => {
      const d = document.createElement("div");
      d.className = "details-meta";
      const fields = Object.entries(row.data)
        .filter(([, v]) => v && v.trim())
        .map(([k, v]) => `${k}=${v}`)
        .join(" | ");
      d.textContent = `Line ${row.line}: ${fields}`;
      details.appendChild(d);
    });

    li.appendChild(details);
    results.appendChild(li);
  });

  if (shown === 0) {
    const msg = document.createElement("div");
    msg.textContent = "No matching results.";
    msg.style.padding = "10px";
    msg.style.fontStyle = "italic";
    results.appendChild(msg);
  }
}

searchInput.addEventListener("input", render);
loadBtn.addEventListener("click", loadUserPlates);
clearStoredPlates.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  userPlates = new Map();
  firstLoadedAt = null;
  searchInput.value = "";
  plateInput.value = "";
  cidInput.value = "";
  loadStatus.textContent = "Using sample data";
  cidStatus.textContent = "";
  render();
  searchInput.focus();
});
loadFromCIDBtn.addEventListener("click", loadFromCID);

loadPlatesFromStorage();
render();
