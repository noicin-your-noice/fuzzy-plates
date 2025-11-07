import { fuzzyMatch } from "./fuzzyPlates.js";

const STORAGE_KEY = "fuzzyPlateData";
const EXPIRY_HOURS = 12;
const VEHICLE_FIELDS = ["color","make","model"];

let firstLoadedAt = null;
let userPlates = new Map();

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString();  // or customize
}

function normalizePlateKey(str) {
  return str.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function extractVehicleSummary(rows) {
  const fieldValues = {
    color: new Set(),
    make: new Set(),
    model: new Set()
  };

  // Title-case helper
  function titleCase(str) {
    return str
      .toLowerCase()
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  for (const row of rows) {
    for (const field of VEHICLE_FIELDS) {
      const matchKey = Object.keys(row.data).find(
        k => k.trim().toLowerCase() === field
      );
      if (!matchKey) continue;

      const raw = row.data[matchKey] ?? "";
      const trimmed = raw.trim();
      if (!trimmed) continue;

      const normalized = titleCase(trimmed);
      fieldValues[field].add(normalized);
    }
  }

  const parts = [];

  if (fieldValues.color.size > 0)
    parts.push([...fieldValues.color].join("/"));

  if (fieldValues.make.size > 0)
    parts.push([...fieldValues.make].join("/"));

  if (fieldValues.model.size > 0)
    parts.push([...fieldValues.model].join("/"));

  return parts.join(" ");
}

function choosePlateColumn(headers) {
  const plateCols = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => /plate/i.test(h));

  // If 0 → default to first column
  if (plateCols.length === 0) {
    return { index: 0, name: headers[0] || "(first column)" };
  }

  // If 1 → auto-select
  if (plateCols.length === 1) {
    return { index: plateCols[0].i, name: plateCols[0].h };
  }

  // If multiple → prompt user
  const opts = plateCols
    .map((p, idx) => `${idx + 1}. ${p.h}`)
    .join("\n");

  const answer = window.prompt(
    `Multiple plate columns found. Which one should be used?\n\n${opts}\n\nEnter 1-${plateCols.length}:`,
    "1"
  );

  if (answer === null) return { index: -1, name: null }; // cancelled

  const n = parseInt(answer, 10);
  if (!Number.isInteger(n) || n < 1 || n > plateCols.length) {
    return { index: -1, name: null }; // invalid → abort
  }

  const pick = plateCols[n - 1];
  return { index: pick.i, name: pick.h };
}

const defaultPlates = [
  "XYZ999",
  "Q0Q-8B8",
  "ABC I23",
  "AB0-123",
  "ABC123",
  "E0CKICF"
];

function currentPlates() {
  if (userPlates.size) {
    return Array.from(userPlates.keys()).reverse();
  }
  return [...defaultPlates].reverse(); // default too
}

function savePlates() {
  if (!userPlates.size) return;

  const payload = {
    savedAt: Date.now(),
    loadedAt: firstLoadedAt,
    entries: [...userPlates.entries()]
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadSaved() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const { savedAt, loadedAt, entries } = JSON.parse(raw);
    if ((Date.now()-savedAt)/36e5 > EXPIRY_HOURS) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    userPlates = new Map(entries);
    firstLoadedAt = loadedAt;
    document.getElementById("loadStatus").textContent =
      `Loaded ${userPlates.size} unique plates, entered at ${formatTimestamp(firstLoadedAt)}`;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function parsePlain(text) {
  const map = new Map();
  text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).forEach((p,i)=>{
    const key = normalizePlateKey(p);
    if (!key) return;
    if (!map.has(key)) map.set(key,{plate:p,rows:[]});
    map.get(key).rows.push({line:i+1,data:{Raw:p}});
  });
  return map;
}

function parseTSV(text, idx = 0) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(/\t/).map(h=>h.trim());
  const rows = lines.slice(1);

  const map = new Map();
  rows.forEach((line,i)=>{
    const cols = line.split(/\t/);
    const raw = cols[idx];
    if (!raw) return;
    const key = normalizePlateKey(raw);
    if (!key) return;
    if (!map.has(key)) map.set(key,{plate:raw,rows:[]});
    const obj={};
    headers.forEach((h,j)=>obj[h]=cols[j]?.trim()||"");
    map.get(key).rows.push({line:i+2,data:obj});
  });

  return map;
}

function loadUserPlates() {
  // Remove blank rows for better user feedback
  let raw = plateInput.value;
  const cleaned = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line !== "")
    .join("\n");

  plateInput.value = cleaned;
  if (!cleaned) return;

  let plates;

  if (cleaned.includes("\t")) {
    // TSV path
    const firstLine = cleaned.split(/\r?\n/)[0];
    const headers = firstLine.split(/\t/).map(h => h.trim());

    const { index: idx, name } = choosePlateColumn(headers);
    if (idx < 0) {
      loadStatus.textContent = "Import cancelled.";
      return;
    }

    plates = parseTSV(cleaned, idx);

  } else {
    // Plain list path
    plates = parsePlain(cleaned);
  }

  userPlates = plates;
  firstLoadedAt = Date.now();
  savePlates();

  loadStatus.textContent =
    `Loaded ${userPlates.size} unique plates, entered at ${formatTimestamp(firstLoadedAt)}`;

  render();
}

clearStoredPlates.addEventListener("click", ()=>{
  localStorage.removeItem(STORAGE_KEY);
  userPlates.clear();
  plateInput.value="";
  loadStatus.textContent="Cleared saved plates";
  firstLoadedAt = null;
  render();
});

function render() {
  let foundAny = false;
  const q = searchInput.value;
  const ul = results;
  ul.innerHTML = "";

  currentPlates().forEach(key=>{
    const r = fuzzyMatch(key,q);
    if (!r.match) return;

    foundAny = true;

    const li=document.createElement("li");
    const info=userPlates.get(key);

    if (!info) {
      li.innerHTML = `<div style="font-family:monospace;font-size:1.4rem;font-weight:bold">${r.rendered}</div>`;
      ul.appendChild(li);
      return;
    }

    const details=document.createElement("details");
    const summary=document.createElement("summary");
    summary.innerHTML = r.rendered;

    const sumLine = extractVehicleSummary(info.rows);
    if (sumLine) {
      const m=document.createElement("div");
      m.className="sum-line";
      m.textContent=sumLine;
      summary.appendChild(m);
    }

    details.appendChild(summary);

    info.rows.forEach(row=>{
      const d=document.createElement("div");
      d.className="details-meta";
      const fields = Object.entries(row.data)
            .filter(([_,v])=>v && v.trim())
            .map(([k,v])=>`${k}=${v}`)
            .join(" | ");
      d.textContent = `Line ${row.line}: ${fields}`;
      details.appendChild(d);
    });

    li.appendChild(details);
    ul.appendChild(li);
  });

  if (!foundAny && q.trim() !== "") {
    const li = document.createElement("li");
    li.textContent = "No matching results";
    li.style.color = "#888";
    li.style.fontSize = "1rem";
    li.style.padding = "8px 0 0 0";
    ul.appendChild(li);
  }  
}

loadBtn.addEventListener("click", loadUserPlates);
searchInput.addEventListener("input", render);

loadSaved();
render();
