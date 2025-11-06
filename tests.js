import { fuzzyMatch } from './fuzzyPlates.js';

const testPlates = [
  "ABC123",
  "ABC I23",
  "AB0-123",
  "XYZ999",
  "W1-5T5",
  "Q0Q-8B8",
  "AB01123",
  "FP 31395",
  "FP31395",
  "31395",
  "ZBGYY5NL"
];

const tests = [
  {
    name: "Full exact match",
    query: "XYZ999",
    expectedPlates: ["XYZ999"],
    expectedMeta: {
      "XYZ999": ["E","E","E","E","E","E"],
    }
  },
  {
    name: "Exact match, ignoring dash in match",
    query: "W15T5",
    expectedPlates: ["W1-5T5"],
    expectedMeta: {
      "W1-5T5": ["E","E","-","E","E","E"],
    }
  },
  {
    name: "Exact match, ignoring space in query",
    query: "XYZ 999",
    expectedPlates: ["XYZ999"],
    expectedMeta: {
      "XYZ999": ["E","E","E","E","E","E"],
    }
  },
  {
    name: "Single character matches correct plates, with correct highlighting",
    query: "B",
    expectedPlates: ["ABC123","ABC I23","AB0-123","Q0Q-8B8","AB01123","ZBGYY5NL"],
    expectedMeta: {
      "ABC123": ["","E","","","",""],
      "Q0Q-8B8": ["","","","-","F","E","F"]
    }
  },
  {
    name: "Match substring across dash",
    query: "01",
    expectedPlates: ["AB0-123","AB01123"],
    expectedMeta: {
      "AB0-123": ["","","E","-","E","",""]
    }
  },
  {
    name: "I23 should match plates with 123",
    query: "I23",
    expectedPlates: ["ABC123","ABC I23","AB0-123","AB01123"],
    expectedMeta: {
      "ABC123":  ["","","","F","E","E"],
      "ABC I23": ["","","","-","E","E","E"],
      "AB0-123": ["","","","-","F","E","E"]
    }
  },
  {
    name: "Prefers exact over fuzzy with overlapping substrings",
    query: "0Q",
    expectedPlates: ["Q0Q-8B8"],
    expectedMeta: {
      "Q0Q-8B8": ["","E","E","-","","",""]
    }
  }
];

function runTests() {
  let out = "";
  for (const t of tests) {
    const {query, expectedPlates, expectedMeta} = t;

    const matched = [];
    for (const p of testPlates) {
      const m = fuzzyMatch(p, query);
      if (m.match) matched.push(p);
    }

    const got = [...matched].sort();
    const exp = [...expectedPlates].sort();
    let pass = JSON.stringify(got) === JSON.stringify(exp);

    if (!pass) {
      out += `FAIL: ${t.name}\n  Expected plates: ${exp.join(",")}\n  Got: ${got.join(",")}\n\n`;
      continue;
    }

    for (const plate in expectedMeta || {}) {
      const m = fuzzyMatch(plate, query);
      const a = m.meta, e = expectedMeta[plate];
      if (JSON.stringify(a) !== JSON.stringify(e)) {
        pass = false;
        out += `FAIL: ${t.name}\n  Plate: ${plate}\n  Expected meta: ${e}\n  Got:        ${a}\n\n`;
      }
    }

    if (pass) out += `PASS: ${t.name}\n`;
  }

  const el = document.getElementById("testOutput");
  if (out.includes("FAIL")) {
    el.textContent = out;
    el.style.color = "black";
    el.style.padding = "1em";
    el.style.border = "1px solid darkred";
    el.style.background = "#ffe5e5";
  } else {
    el.textContent = "Tests passing.";
    el.style.color = "green";
    el.style.background = "transparent";
  }
}

window.addEventListener("DOMContentLoaded", runTests);
