let players = [];
let showPast = false;
let monthlyFees = {};
let attendanceData = {};

function loadData() {
  players = JSON.parse(localStorage.getItem("players")) || [];
  attendanceData = JSON.parse(localStorage.getItem("attendanceData")) || {};
  monthlyFees = JSON.parse(localStorage.getItem("monthlyFees")) || {};
}

function saveData() {
  localStorage.setItem("players", JSON.stringify(players));
  localStorage.setItem("attendanceData", JSON.stringify(attendanceData));
  localStorage.setItem("monthlyFees", JSON.stringify(monthlyFees));
}

function initMonthlyFees() {
  for (let y = 2025; y <= 2027; y++) {
    for (let m = 0; m < 12; m++) {
      const key = `${y}-${m}`;
      if (!monthlyFees[key]) monthlyFees[key] = { regular: 11, casual: 13 };
    }
  }
}

function populateFeeSelectors() {
  const yearSel = document.getElementById("feeYear");
  const monthSel = document.getElementById("feeMonth");
  if (!yearSel || !monthSel) return;

  for (let y = 2025; y <= 2027; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.text = y;
    yearSel.appendChild(opt);
  }

  const months = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  months.forEach((m, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.text = m;
    monthSel.appendChild(opt);
  });
}

function applyMonthlyFee() {
  const y = document.getElementById("feeYear").value;
  const m = document.getElementById("feeMonth").value;
  const r = parseFloat(document.getElementById("regularFee").value);
  const c = parseFloat(document.getElementById("casualFee").value);
  if (isNaN(r) || isNaN(c) || r < 0 || c < 0) {
    alert("Please enter valid positive numbers for fees.");
    return;
  }
  const key = `${y}-${m}`;
  monthlyFees[key] = { regular: r, casual: c };
  saveData();
  alert(`Fees for ${key} updated: Regular=$${r}, Casual=$${c}`);
}

function addPlayers() {
  const input = document.getElementById("playerInput");
  const names = input.value.split(",").map(n => n.trim()).filter(n => n && !players.includes(n));
  players.push(...names);
  saveData();
  input.value = "";
  renderPlayerList();
  renderAttendanceTable();
}

function deletePlayer(name) {
  if (confirm(`Delete player ${name}?`)) {
    players = players.filter(p => p !== name);
    saveData();
    renderPlayerList();
    renderAttendanceTable();
  }
}

function renderPlayerList() {
  const ul = document.getElementById("playerList");
  ul.innerHTML = "";
  players.forEach(name => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";
    li.textContent = name;
    const btn = document.createElement("button");
    btn.className = "btn btn-sm btn-danger";
    btn.textContent = "Delete";
    btn.onclick = () => deletePlayer(name);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function toggleShowPast() {
  showPast = document.getElementById("showPast").checked;
  renderAttendanceTable();
}

function getAllTuesdays(year, month) {
  const tuesdays = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() === 2) tuesdays.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return tuesdays;
}

function renderAttendanceTable() {
  const year = parseInt(document.getElementById("yearSelect").value);
  const month = parseInt(document.getElementById("monthSelect").value);
  const today = new Date().toISOString().split("T")[0];
  const tuesdays = getAllTuesdays(year, month);
  const table = document.createElement("table");
  table.className = "table table-bordered attendance-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML = "<th>Player</th>";
  tuesdays.forEach(date => {
    const dateStr = date.toISOString().split("T")[0];
    if (showPast || dateStr <= today) {
      headRow.innerHTML += `<th>${dateStr}</th>`;
    }
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  players.forEach(player => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${player}</td>`;
    tuesdays.forEach(date => {
      const dateStr = date.toISOString().split("T")[0];
      const past = dateStr <= today;
      if (showPast || past) {
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.id = `${dateStr}-${player}`;
        cb.checked = attendanceData[dateStr]?.[player] || false;
        cb.disabled = !past;
        cb.onchange = () => {
          if (!attendanceData[dateStr]) attendanceData[dateStr] = {};
          attendanceData[dateStr][player] = cb.checked;
          saveData();
        };
        const td = document.createElement("td");
        td.appendChild(cb);
        row.appendChild(td);
      }
    });
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  const container = document.getElementById("attendanceTableContainer");
  container.innerHTML = "";
  container.appendChild(table);
}

function generateBills() {
  const year = parseInt(document.getElementById("yearSelect").value);
  const month = parseInt(document.getElementById("monthSelect").value);
  const tuesdays = getAllTuesdays(year, month).map(d => d.toISOString().split("T")[0]);
  const key = `${year}-${month}`;
  const regFee = monthlyFees[key]?.regular || 11;
  const casFee = monthlyFees[key]?.casual || 13;
  const billList = document.getElementById("billList");
  billList.innerHTML = "";

  if (players.length === 0 || tuesdays.length === 0) {
    alert("Missing players or dates.");
    return;
  }

  let csv = "Player,Attended,Total Fee\n";
  players.forEach(player => {
    let attended = 0;
    tuesdays.forEach(date => {
      if (attendanceData[date]?.[player]) attended++;
    });
    const fee = attended === tuesdays.length ? regFee : attended * casFee;
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.textContent = `${player}: $${fee.toFixed(2)} (${attended}/${tuesdays.length} days)`;
    billList.appendChild(li);
    csv += `${player},${attended},${fee.toFixed(2)}\n`;
  });

  localStorage.setItem("lastBillCSV", csv);
  saveData();
}

function exportCSV() {
  let csv = "Date,Player,Present\n";
  for (const date in attendanceData) {
    for (const player in attendanceData[date]) {
      csv += `${date},${player},${attendanceData[date][player] ? "Yes" : "No"}\n`;
    }
  }
  downloadFile(csv, "attendance.csv");
}

function exportBillsCSV() {
  const csv = localStorage.getItem("lastBillCSV") || "No bill data available.";
  downloadFile(csv, "monthly_bills.csv");
}

function resetAllData() {
  if (confirm("Are you sure you want to reset all data?")) {
    localStorage.clear();
    players = [];
    attendanceData = {};
    monthlyFees = {};
    location.reload();
  }
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
