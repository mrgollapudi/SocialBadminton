
function toAESTDateString(date) {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date).split('/').reverse().join('-');
}


const API_URL = "https://script.google.com/macros/s/AKfycbzDZUIOix1oDXT08j_FxaQy_Z5212A3rZWx_z1KJNL5qCbJZ4hYQHLN52TL_WXJQXOQ/exec";

async function safeFetchJSON(url) {
  const res = await fetch(url);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse JSON from:", url, "\nResponse was:", text);
    return [];
  }
}

function formatMonth(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

async function loadPlayers() {
  return await safeFetchJSON(`${API_URL}?action=getPlayers`);
}

async function loadAttendance() {
  return await safeFetchJSON(`${API_URL}?action=getAttendance`);
}

async function loadFees() {
  return await safeFetchJSON(`${API_URL}?action=getFees`);
}

async function renderPlayerList() {
  const table = document.getElementById("playerListTable");
  table.innerHTML = "";

  // Create table header
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr class="table-primary">
      <th>Player Name</th>
      <th>Mobile</th>
      <th>Action</th>
    </tr>
  `;
  table.appendChild(thead);

  // Load and sort players alphabetically by name
  const players = (await loadPlayers()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Create body
  const tbody = document.createElement("tbody");

  players.forEach(({ name, mobile }) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${name}</td>
      <td>${mobile}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deletePlayer('${name}', '${mobile}')">
          Delete
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
}

async function deletePlayer(name, mobile) {
  if (!confirm(`Delete ${name}?`)) return;
  await fetch(`${API_URL}?action=deletePlayer&name=${encodeURIComponent(name)}&mobile=${encodeURIComponent(mobile)}`);
  await renderPlayerList();
}



async function renderFeesTable() {
  const fees = await loadFees();
  const container = document.getElementById("feesTableContainer");
  container.innerHTML = "";
  const table = document.createElement("table");
  table.className = "table table-bordered table-striped";
  table.innerHTML = `
    <thead>
      <tr><th>Month</th><th>Regular</th><th>Casual</th></tr>
    </thead>
    <tbody>
      ${fees.map(fee => `
        <tr><td>${fee.month}</td><td>${fee.regular}</td><td>${fee.casual}</td></tr>
      `).join("")}
    </tbody>
  `;
  container.appendChild(table);
}

}

async function renderAttendanceTable() {
  const year = document.getElementById("yearSelect").value;
  const month = document.getElementById("monthSelect").value;
  const players = await loadPlayers();
  const attendance = await loadAttendance();
  const tuesdays = getAllTuesdays(parseInt(year), parseInt(month));
  const container = document.getElementById("attendanceTableContainer");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "table table-bordered";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML = "<th>Player</th>";
  tuesdays.forEach(date => {
    headRow.innerHTML += `<th>${date}</th>`;
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  players.forEach(player => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${player.name}</td>`;
    tuesdays.forEach(date => {
      const match = attendance.find(a => a.date === date && a.player === player.name);
      const td = document.createElement("td");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = match?.present === "Yes";
      cb.onchange = () => submitAttendance(date, player.name, cb.checked);
      td.appendChild(cb);
      row.appendChild(td);
    });
    tbody.appendChild(row);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function getAllTuesdays(year, month) {
  year = parseInt(year);
  month = parseInt(month);
  const result = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    if (d.getDay() === 2) {
      const dateStr = toAESTDateString(new Date(d));
      result.push(dateStr);
    }
    d.setDate(d.getDate() + 1);
  }
  return result;
}

async function submitAttendance(date, player, present) {
  await fetch(`${API_URL}?action=markAttendance&date=${date}&player=${player}&present=${present ? "Yes" : "No"}`);
}

async function submitPlayer(name, mobile) {
  await fetch(`${API_URL}?action=addPlayer&name=${encodeURIComponent(name)}&mobile=${encodeURIComponent(mobile)}`);
}


async function generateMonthlyBills() {
  const year = document.getElementById("billingYearSelect").value;
  const month = document.getElementById("billingMonthSelect").value;
  const monthKey = formatMonth(year, String(month).padStart(2, "0"));
  const tuesdays = getAllTuesdays(parseInt(year), parseInt(month));
  const players = await loadPlayers();
  const attendance = await loadAttendance();
  const fees = await loadFees();
  const fee = fees.find(f => f.month === monthKey);
  const rate = parseFloat(fee?.casual || 13);
  const resultList = document.getElementById("billingResultList");
  resultList.innerHTML = "";

  players.forEach(player => {
    const attended = tuesdays.filter(d =>
      attendance.find(a => a.date === d && a.player === player.name && a.present === "Yes")).length;
    const total = attended * rate;
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.textContent = `${player.name}: $ ${total.toFixed(2)} (${attended} × \$${rate})`;
    resultList.appendChild(li);
  });
}

function populateSelectors() {
  const yearSel = document.getElementById("yearSelect");
  const monthSel = document.getElementById("monthSelect");
  const fy = document.getElementById("feeYear");
  const fm = document.getElementById("feeMonth");
  const by = document.getElementById("billingYearSelect");
  const bm = document.getElementById("billingMonthSelect");

  for (let y = 2025; y <= 2027; y++) {
    [yearSel, fy, by].forEach(sel => sel?.appendChild(new Option(y, y)));
  }

  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  months.forEach((m, i) => {
    [monthSel, fm, bm].forEach(sel => sel?.appendChild(new Option(m, i)));
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  if (yearSel) yearSel.value = currentYear;
  if (monthSel) monthSel.value = currentMonth;
  if (fy) fy.value = currentYear;
  if (fm) fm.value = currentMonth;
  if (by) by.value = currentYear;
  if (bm) bm.value = currentMonth;
}

document.addEventListener("DOMContentLoaded", async () => {
  populateSelectors();
  await renderPlayerList();
  await renderFeesTable();
  await renderAttendanceTable();
});

window.renderPlayerList = renderPlayerList;
window.renderAttendanceTable = renderAttendanceTable;
window.renderFeesTable = renderFeesTable;
window.generateMonthlyBills = generateMonthlyBills;
//1:26AM
