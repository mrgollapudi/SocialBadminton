import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const db = window.db;
let showPast = false;

function capitalizeName(name) {
  return name
    .split(" ")
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
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
    const opt1 = new Option(y, y);
    const opt2 = new Option(y, y);
    ySel.appendChild(opt1);
    yAttSel.appendChild(opt2);
  }

  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  months.forEach((m, i) => {
    const opt1 = new Option(m, i);
    const opt2 = new Option(m, i);
    mSel.appendChild(opt1);
    mAttSel.appendChild(opt2);
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
  await setDoc(doc(db, "monthlyFees", `${y}-${m}`), { regular: r, casual: c });
  alert("Fees updated.");
}

async function generateBills() {
  const year = document.getElementById("yearSelect").value;
  const month = document.getElementById("monthSelect").value;
  const dateKeys = getAllTuesdays(year, month).map(d => d.toISOString().split("T")[0]);
  const feeSnap = await getDoc(doc(db, "monthlyFees", `${year}-${month}`));
  const fees = feeSnap.exists() ? feeSnap.data() : { regular: 11, casual: 13 };
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
    const isRegular = attended === dateKeys.length;
    const total = isRegular ? fees.regular : attended * fees.casual;
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.textContent = `${player}: $${total.toFixed(2)} (${attended}/${dateKeys.length})`;
    billList.appendChild(li);
  }
}

// Run setup when page loads
populateSelectors();
window.addPlayers = addPlayers;
window.deletePlayer = deletePlayer;
window.applyMonthlyFee = applyMonthlyFee;
window.toggleShowPast = toggleShowPast;
window.generateBills = generateBills;
window.renderAttendanceTable = renderAttendanceTable;
window.renderPlayerList = renderPlayerList;


async function loadMonthlyFee() {
  const year = document.getElementById("feeYear").value;
  const month = document.getElementById("feeMonth").value;
  const feeSnap = await getDoc(doc(db, "monthlyFees", `${year}-${month}`));
  if (feeSnap.exists()) {
    const { regular, casual } = feeSnap.data();
    document.getElementById("regularFee").value = regular;
    document.getElementById("casualFee").value = casual;
  } else {
    document.getElementById("regularFee").value = 11;
    document.getElementById("casualFee").value = 13;
  }
}

// Add listeners to dropdowns to load fees
function attachFeeDropdownListeners() {
  const fy = document.getElementById("feeYear");
  const fm = document.getElementById("feeMonth");
  fy?.addEventListener("change", loadMonthlyFee);
  fm?.addEventListener("change", loadMonthlyFee);
}

// Final load logic after DOM is ready
window.addEventListener("DOMContentLoaded", () => {
  populateSelectors();
  attachFeeDropdownListeners();
  renderPlayerList();
  renderAttendanceTable();
  loadMonthlyFee();
});

async function renderDashboard() {
  const dashboardContainer = document.getElementById("dashboardTableContainer");
  const chartCanvas = document.getElementById("attendanceChart");
  dashboardContainer.innerHTML = "";
  chartCanvas?.getContext("2d").clearRect(0, 0, chartCanvas.width, chartCanvas.height);

  const attendanceSnap = await getDocs(collection(db, "attendance"));
  const summary = {};

  attendanceSnap.forEach(doc => {
    const date = doc.id;
    const data = doc.data();
    summary[date] = Object.values(data).filter(v => v === true).length;
  });

  const table = document.createElement("table");
  table.className = "table table-striped";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Date</th><th>Players Present</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  const dates = Object.keys(summary).sort();
  const counts = [];

  dates.forEach(date => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${date}</td><td>${summary[date]}</td>`;
    tbody.appendChild(tr);
    counts.push(summary[date]);
  });

  table.appendChild(tbody);
  dashboardContainer.appendChild(table);

  new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [{
        label: 'Players Present',
        data: counts,
        backgroundColor: 'rgba(54, 162, 235, 0.6)'
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          precision: 0
        }
      }
    }
  });
}


document.addEventListener('DOMContentLoaded', () => {
  const dashboardTab = document.querySelector('a[href="#dashboardTab"]');
  if (dashboardTab) {
    dashboardTab.addEventListener("click", () => {
      renderDashboard();
    });
  }
});
