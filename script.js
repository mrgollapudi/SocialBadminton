
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const db = window.db;
let showPast = false;

async function addPlayers() {
  const input = document.getElementById("playerInput");
  const names = input.value.split(",").map(n => n.trim()).filter(n => n);
  for (const name of names) {
    await setDoc(doc(db, "players", name), { name });
    console.log(`Player "${name}" added to Firestore.`);
  }
  input.value = "";
  renderPlayerList();
  renderAttendanceTable();
}

async function deletePlayer(name) {
  if (confirm("Delete player " + name + "?")) {
    await deleteDoc(doc(db, "players", name));
    console.log(`Player "${name}" deleted from Firestore.`);
    renderPlayerList();
    renderAttendanceTable();
  }
}

async function renderPlayerList() {
  const ul = document.getElementById("playerList");
  ul.innerHTML = "";
  const snapshot = await getDocs(collection(db, "players"));
  snapshot.forEach(docSnap => {
    const name = docSnap.id;
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
  const playerSnap = await getDocs(collection(db, "players"));
  for (const playerDoc of playerSnap.docs) {
    const player = playerDoc.id;
    const row = document.createElement("tr");
    row.innerHTML = `<td>${player}</td>`;
    for (const date of visibleDates) {
      const cb = document.createElement("input");
      cb.type = "checkbox";
      const docRef = doc(db, "attendance", date);
      const attSnap = await getDoc(docRef);
      const data = attSnap.exists() ? attSnap.data() : {};
      cb.checked = data[player] || false;
      cb.disabled = new Date(date) > new Date();
      cb.onchange = async () => {
        const update = { ...(attSnap.exists() ? attSnap.data() : {}) };
        update[player] = cb.checked;
        await setDoc(docRef, update);
        console.log(`Attendance for ${player} on ${date}: ${cb.checked}`);
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
  console.log(`Monthly fee updated: ${y}-${m} => Regular: $${r}, Casual: $${c}`);
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


window.addPlayers = addPlayers;
window.deletePlayer = deletePlayer;
window.applyMonthlyFee = applyMonthlyFee;
window.toggleShowPast = toggleShowPast;
window.generateBills = generateBills;
window.renderAttendanceTable = renderAttendanceTable;
