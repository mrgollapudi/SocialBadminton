
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const db = window.db;
let showPast = true;

function capitalizeName(name) {
  return name.split(" ").map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
}

async function addPlayers() {
  const nameInput = document.getElementById("playerInput").value.trim();
  const mobileInput = document.getElementById("mobileInput").value.trim();
  const names = nameInput.split(",").map(n => capitalizeName(n.trim()));
  const mobiles = mobileInput.split(",").map(m => m.trim());

  if (names.length !== mobiles.length) {
    alert("Please ensure each name has a corresponding mobile number.");
    return;
  }

  const existingSnap = await getDocs(collection(db, "players"));
  const existing = {};
  existingSnap.forEach(doc => {
    existing[doc.id] = doc.data().mobile;
  });

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const mobile = mobiles[i];
    if (existing[name]) {
      alert(`Player "${name}" already exists.`);
      continue;
    }
    if (Object.values(existing).includes(mobile)) {
      alert(`Mobile number "${mobile}" is already in use.`);
      continue;
    }
    await setDoc(doc(db, "players", name), { name, mobile });
    console.log(`Added: ${name} (${mobile})`);
  }

  document.getElementById("playerInput").value = "";
  document.getElementById("mobileInput").value = "";
  renderPlayerList();
  renderAttendanceTable();
}

async function deletePlayer(name) {
  if (confirm("Delete player " + name + "?")) {
    await deleteDoc(doc(db, "players", name));
    renderPlayerList();
    renderAttendanceTable();
  }
}

async function renderPlayerList() {
  const ul = document.getElementById("playerList");
  if (!ul) return;
  ul.innerHTML = "";
  const snapshot = await getDocs(collection(db, "players"));
  snapshot.forEach(docSnap => {
    const { name, mobile } = docSnap.data();
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";
    li.textContent = `${name} (${mobile})`;
    const btn = document.createElement("button");
    btn.className = "btn btn-sm btn-danger";
    btn.textContent = "Delete";
    btn.onclick = () => deletePlayer(name);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function populateSelectors() {
  const ySel = document.getElementById("feeYear");
  const mSel = document.getElementById("feeMonth");
  const yAttSel = document.getElementById("yearSelect");
  const mAttSel = document.getElementById("monthSelect");

  for (let y = 2025; y <= 2027; y++) {
    [ySel, yAttSel].forEach(sel => sel?.appendChild(new Option(y, y)));
  }

  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  months.forEach((m, i) => {
    [mSel, mAttSel].forEach(sel => sel?.appendChild(new Option(m, i)));
  });
}

function toggleShowPast() {
  showPast = document.getElementById("showPast").checked;
  renderAttendanceTable();
}

function getAllTuesdays(year, month) {
  const dates = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() === 2) dates.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

async function renderAttendanceTable() {
  const year = parseInt(document.getElementById("yearSelect").value);
  const month = parseInt(document.getElementById("monthSelect").value);
  const tuesdays = getAllTuesdays(year, month);
  const today = new Date().toISOString().split("T")[0];
  const container = document.getElementById("attendanceTableContainer");
  container.innerHTML = "";
  const table = document.createElement("table");
  table.className = "table table-bordered";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML = "<th>Player</th>";
  const visibleDates = [];

  tuesdays.forEach(date => {
    const dateStr = date.toISOString().split("T")[0];
    if (showPast || dateStr <= today) {
      headRow.innerHTML += `<th>${dateStr}</th>`;
      visibleDates.push(dateStr);
    }
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const playersSnap = await getDocs(collection(db, "players"));
  for (const playerDoc of playersSnap.docs) {
    const player = playerDoc.id;
    const row = document.createElement("tr");
    row.innerHTML = `<td>${player}</td>`;

    for (const date of visibleDates) {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      const docRef = doc(db, "attendance", date);
      const snap = await getDoc(docRef);
      const data = snap.exists() ? snap.data() : {};
      cb.checked = data[player] || false;
      cb.disabled = new Date(date) > new Date();
      cb.onchange = async () => {
        const updated = snap.exists() ? snap.data() : {};
        updated[player] = cb.checked;
        await setDoc(docRef, updated);
      };
      const td = document.createElement("td");
      td.appendChild(cb);
      row.appendChild(td);
    }
    tbody.appendChild(row);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}

async function applyMonthlyFee() {
  const y = document.getElementById("feeYear").value;
  const m = document.getElementById("feeMonth").value;
  const r = parseFloat(document.getElementById("regularFee").value);
  const c = parseFloat(document.getElementById("casualFee").value);
  if (isNaN(r) || isNaN(c) || r < 0 || c < 0) {
    alert("Please enter valid fees.");
    return;
  }
  await setDoc(doc(db, "monthlyFees", `${y}-${String(m).padStart(2, "0")}`), { regular: r, casual: c });
  alert("Fees updated.");
  renderFeesTable();
}

async function generateBills() {
  const year = document.getElementById("yearSelect").value;
  const month = document.getElementById("monthSelect").value;
  const dateKeys = getAllTuesdays(year, month).map(d => d.toISOString().split("T")[0]);
  const feeSnap = await getDoc(doc(db, "monthlyFees", `${year}-${String(month).padStart(2, "0")}`));
  const casualFee = feeSnap.exists() ? (feeSnap.data().casual || 13) : 13;
  const playerSnap = await getDocs(collection(db, "players"));
  const billList = document.getElementById("billList");
  billList.innerHTML = "";

  for (const playerDoc of playerSnap.docs) {
    const player = playerDoc.id;
    let attended = 0;
    for (const date of dateKeys) {
      const snap = await getDoc(doc(db, "attendance", date));
      if (snap.exists() && snap.data()[player]) attended++;
    }
    const total = attended * casualFee;
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.textContent = `${player}: $${total.toFixed(2)} (${attended} days × $${casualFee})`;
    billList.appendChild(li);
  }
}

async function loadMonthlyFee() {
  const year = document.getElementById("feeYear").value;
  const month = document.getElementById("feeMonth").value;
  const feeSnap = await getDoc(doc(db, "monthlyFees", `${year}-${String(month).padStart(2, "0")}`));
  if (feeSnap.exists()) {
    const { regular, casual } = feeSnap.data();
    document.getElementById("regularFee").value = regular;
    document.getElementById("casualFee").value = casual;
  } else {
    document.getElementById("regularFee").value = 11;
    document.getElementById("casualFee").value = 13;
  }
}

function attachFeeDropdownListeners() {
  const fy = document.getElementById("feeYear");
  const fm = document.getElementById("feeMonth");
  fy?.addEventListener("change", loadMonthlyFee);
  fm?.addEventListener("change", loadMonthlyFee);
}

async function renderDashboard() {
  const container = document.getElementById("dashboardTableContainer");
  const chartCanvas = document.getElementById("attendanceChart");
  container.innerHTML = "";
  if (!chartCanvas) return;

  const attendanceSnap = await getDocs(collection(db, "attendance"));
  const summary = {};
  const monthlySummary = {};

  attendanceSnap.forEach(doc => {
    const date = doc.id;
    const data = doc.data();
    const count = Object.values(data).filter(v => v === true).length;
    summary[date] = count;

    const [year, month] = date.split("-").slice(0, 2);
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    if (!monthlySummary[monthKey]) monthlySummary[monthKey] = 0;
    monthlySummary[monthKey] += count;
  });

  const table = document.createElement("table");
  table.className = "table table-striped";
  table.innerHTML = "<thead><tr><th>Date</th><th>Attendance Count</th></tr></thead>";
  const tbody = document.createElement("tbody");

  Object.keys(summary).sort().forEach(date => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${date}</td><td>${summary[date]}</td>`;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  container.appendChild(table);

  const ctx = chartCanvas.getContext("2d");
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(monthlySummary).sort(),
      datasets: [{
        label: 'Monthly Attendance Count',
        data: Object.values(monthlySummary),
        backgroundColor: 'rgba(54, 162, 235, 0.6)'
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true } }
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  populateSelectors();
  attachFeeDropdownListeners();
  renderPlayerList();
  renderAttendanceTable();
  loadMonthlyFee();
  renderFeesTable();
  renderDashboard();
  populateBillingSelectors();

  const dashboardTab = document.querySelector('a[href="#dashboardTab"]');
  dashboardTab?.addEventListener("click", renderDashboard);
});

async function renderFeesTable() {
  const container = document.getElementById("feesTableContainer");
  container.innerHTML = "";

  const feesSnap = await getDocs(collection(db, "monthlyFees"));
  if (feesSnap.empty) {
    container.textContent = "No fee data available.";
    return;
  }

  const table = document.createElement("table");
  table.className = "table table-striped table-bordered";
  table.innerHTML = "<thead><tr><th>Month</th><th>Regular Fee</th><th>Casual Fee</th><th>Action</th></tr></thead>";
  const tbody = document.createElement("tbody");

  feesSnap.forEach(docSnap => {
    const row = document.createElement("tr");
    const { regular, casual } = docSnap.data();
    const formattedMonth = docSnap.id.split("-").map((v, i) => i === 1 ? v.padStart(2, "0") : v).join("-");
    
row.innerHTML = `<td>${formattedMonth}</td><td>$${regular}</td><td>$${casual}</td><td><button class='btn btn-sm btn-danger' onclick="deleteMonthlyFee('${docSnap.id}')">Delete</button></td>`;

    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

async function generateMonthlyBills() {
  const year = document.getElementById("billingYearSelect").value;
  const month = document.getElementById("billingMonthSelect").value;
  const dateKeys = getAllTuesdays(year, month).map(d => d.toISOString().split("T")[0]);
  const feeSnap = await getDoc(doc(db, "monthlyFees", `${year}-${String(month).padStart(2, "0")}`));
  const casualFee = feeSnap.exists() ? (feeSnap.data().casual || 13) : 13;
  const playerSnap = await getDocs(collection(db, "players"));
  const resultList = document.getElementById("billingResultList");
  resultList.innerHTML = "";

  for (const playerDoc of playerSnap.docs) {
    const player = playerDoc.id;
    let attended = 0;
    for (const date of dateKeys) {
      const snap = await getDoc(doc(db, "attendance", date));
      if (snap.exists() && snap.data()[player]) attended++;
    }
    const total = attended * casualFee;
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.textContent = `${player}: $${total.toFixed(2)} (${attended} Tuesdays × $${casualFee})`;
    resultList.appendChild(li);
  }
}

function populateBillingSelectors() {
  const yearSel = document.getElementById("billingYearSelect");
  const monthSel = document.getElementById("billingMonthSelect");
  for (let y = 2025; y <= 2027; y++) {
    yearSel.appendChild(new Option(y, y));
  }
  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  months.forEach((m, i) => {
    monthSel.appendChild(new Option(m, i));
  });
}

window.addPlayers = addPlayers;
window.deletePlayer = deletePlayer;
window.applyMonthlyFee = applyMonthlyFee;
window.toggleShowPast = toggleShowPast;
window.generateBills = generateBills;
window.renderAttendanceTable = renderAttendanceTable;
window.renderPlayerList = renderPlayerList;
window.renderDashboard = renderDashboard;
window.generateMonthlyBills = generateMonthlyBills;


async function deleteMonthlyFee(key) {
  if (confirm(`Delete fees for ${key}?`)) {
    await deleteDoc(doc(db, "monthlyFees", key));
    alert(`Deleted fees for ${key}`);
    renderFeesTable();
  }
}

window.deleteMonthlyFee = deleteMonthlyFee;
