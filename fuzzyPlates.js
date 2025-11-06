const similarPairs = [
  ["D","O"],["M","W"],["P","R"],["7","Z"],["0","D"],["5","S"],
  ["V","W"],["2","Z"],["1","I"],["I","T"],["X","Y"],["7","T"],
  ["0","Q"],["1","L"],["4","L"],["E","F"],["8","B"],["D","Q"],
  ["0","O"],["O","Q"],["0","U"]
];

const similarMap = new Map();
for (const [a,b] of similarPairs) {
  const A = a.toUpperCase(), B = b.toUpperCase();
  if (!similarMap.has(A)) similarMap.set(A, new Set());
  if (!similarMap.has(B)) similarMap.set(B, new Set());
  similarMap.get(A).add(B);
  similarMap.get(B).add(A);
}

function isSimilar(a,b){ return similarMap.has(a) && similarMap.get(a).has(b); }
function normalize(s){ return s.replace(/[-\s]/g,"").toUpperCase(); }

export function fuzzyMatch(plate, query) {
  const cleanQuery = normalize(query);
  if (!cleanQuery) {
    return { match:true, rendered:plate, meta:Array(plate.length).fill("") };
  }

  const pChars = plate.toUpperCase().split("");

  // Single character: highlight all matches
  if (cleanQuery.length === 1) {
    const q = cleanQuery[0];
    const meta = Array(plate.length).fill("");
    let any = false;

    for (let i=0;i<pChars.length;i++){
      const ch = pChars[i];
      if (!/[A-Z0-9]/.test(ch)) { meta[i]="-"; continue; }
      if (ch===q){ meta[i]="E"; any=true; }
      else if (isSimilar(ch,q)){ meta[i]="F"; any=true; }
    }
    if (!any) return { match:false, rendered:null, meta:[] };

    let html="";
    for (let i=0;i<plate.length;i++){
      const c = plate[i], t = meta[i];
      if (t==="E") html+=`<span class="exact-match">${c}</span>`;
      else if (t==="F") html+=`<span class="fuzzy-match">${c}</span>`;
      else html+=c;
    }
    return { match:true, rendered:html, meta };
  }

  // Multi character: fuzzy substring
  const cleanPlate = normalize(plate);
  const qChars = cleanQuery.split("");

  const candidates = [];
  for (let start=0; start<=cleanPlate.length - qChars.length; start++){
    let ok = true;
    const marks = Array(cleanPlate.length).fill(null);
    let exact = 0, fuzzy = 0;

    for (let i=0;i<qChars.length;i++){
      const p = cleanPlate[start+i], q = qChars[i];
      if (p===q){ marks[start+i]="E"; exact++; }
      else if (isSimilar(p,q)){ marks[start+i]="F"; fuzzy++; }
      else { ok=false; break; }
    }

    if (ok) candidates.push({ start, marks, exact, fuzzy });
  }

  if (!candidates.length) return { match:false, rendered:null, meta:[] };

  // More exact > fewer fuzzy > earlier start
  candidates.sort((a,b)=>{
    if (b.exact !== a.exact) return b.exact - a.exact;
    if (a.fuzzy !== b.fuzzy) return a.fuzzy - b.fuzzy;
    return a.start - b.start;
  });

  const best = candidates[0];
  const meta = Array(plate.length).fill("");
  let normIdx = 0;

  for (let i=0;i<plate.length;i++){
    const ch=pChars[i];
    if (!/[A-Z0-9]/.test(ch)){ meta[i]="-"; continue; }
    const t = best.marks[normIdx];
    if (t) meta[i]=t;
    normIdx++;
  }

  let html="";
  for (let i=0;i<plate.length;i++){
    const c = plate[i], t = meta[i];
    if (t==="E") html+=`<span class="exact-match">${c}</span>`;
    else if (t==="F") html+=`<span class="fuzzy-match">${c}</span>`;
    else html+=c;
  }

  return { match:true, rendered:html, meta };
}
