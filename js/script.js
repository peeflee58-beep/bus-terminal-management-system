// =========================================================
// FIREBASE IMPORTS FOR SCRIPT.JS (BUS SECTION)
// =========================================================
import { db } from "./firebase-config.js";
import { 
    collection, getDocs, addDoc, deleteDoc, doc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// =========================================================
// GLOBAL NAVIGATION HELPER
// =========================================================
window.goBack = function() {
    if (window.history.length > 1) {
        window.history.back();
    } else {
        window.location.href = "dashboard.html";
    }
};

// =========================================================
// GLOBAL HELPER FUNCTIONS
// =========================================================

function to12Hour(timeStr) {
    if (!timeStr) return "";
    try {
        let [hours, minutes] = timeStr.split(":");
        if (!hours || !minutes) return timeStr;
        let h = parseInt(hours, 10);
        let ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        return `${h}:${minutes} ${ampm}`;
    } catch (e) {
        return timeStr;
    }
}

function getStatusWithEmoji(status) {
    switch ((status || "").toLowerCase()) {
        case "active": return "🟢 Active";
        case "scheduled": return "📅 Scheduled";
        case "boarding": return "🚶 Boarding";
        case "delayed": return "⏳ Delayed";
        case "departed": return "🚀 Departed";
        case "cancelled": return "❌ Cancelled";
        default: return status || "Active";
    }
}

// =========================================================
// BUS MANAGEMENT SECTION (FIRESTORE)
// =========================================================

const scheduleStateElem = document.getElementById("scheduleState");
if (scheduleStateElem) {
    scheduleStateElem.addEventListener("change", () => {
        loadScheduleBuses();
    });
}

let editBusId = null;

document.addEventListener("DOMContentLoaded", () => {
    const busForm = document.getElementById("busForm");
    if (!busForm) return;

    const busStateInput = document.getElementById("busState");
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (currentUser && currentUser.role === "staff" && busStateInput) {
        busStateInput.value = currentUser.state || "";
        busStateInput.readOnly = true;
    }

    loadBuses();

    busForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const busNumber = document.getElementById("busNumber").value.trim();
        const busType = document.getElementById("busType").value.trim();
        const capacity = document.getElementById("capacity").value.trim();
        let busState = document.getElementById("busState").value.trim();

        if (currentUser && currentUser.role === "staff") {
            const assignedState = String(currentUser.state || "").trim();
            if (!assignedState) {
                alert("Your account has no assigned state. Please contact the administrator.");
                return;
            }
            busState = assignedState;
            document.getElementById("busState").value = assignedState;
        }

        try {
            const busData = {
                state: busState,
                busNumber: busNumber,
                busType: busType,
                capacity: capacity,
                createdAt: editBusId ? document.getElementById("busCreatedAt")?.value || new Date().toLocaleString() : new Date().toLocaleString()
            };

            if (!editBusId) {
                await addDoc(collection(db, "buses"), busData);
                alert("Bus Added Successfully!");
            } else {
                const busRef = doc(db, "buses", editBusId);
                await updateDoc(busRef, busData);
                editBusId = null;
                document.querySelector("#busForm button").innerHTML = '<i class="fa-solid fa-plus"></i><span>Add Bus</span>';
                alert("Bus Updated Successfully!");
            }

            busForm.reset();

            if (currentUser && currentUser.role === "staff" && busStateInput) {
                busStateInput.value = currentUser.state || "";
                busStateInput.readOnly = true;
            }

            loadBuses();
            loadSystemAnalytics();
        } catch (error) {
            console.error("Error saving bus to Firestore:", error);
            alert("Failed to save bus: " + error.message);
        }
    });

    const searchInput = document.getElementById("searchBus");
    if (searchInput) {
        searchInput.addEventListener("input", loadBuses);
    }
});


// =========================================================
// LOAD BUSES FROM FIRESTORE
// =========================================================

async function loadBuses() {
    const tableBody = document.getElementById("busTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Loading buses from cloud...</td></tr>`;

    try {
        const querySnapshot = await getDocs(collection(db, "buses"));
        let buses = [];
        querySnapshot.forEach((document) => {
            buses.push({ id: document.id, ...document.data() });
        });

        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        let visibleBuses = buses;
        if (currentUser && currentUser.role === "staff") {
            const assignedState = String(currentUser.state || "").trim().toLowerCase();
            visibleBuses = buses.filter(b => String(b.state || "").trim().toLowerCase() === assignedState);
        }

        const totalBuses = document.getElementById("totalBuses");
        if (totalBuses) {
            totalBuses.textContent = visibleBuses.length;
        }

        const searchValue = document.getElementById("searchBus")?.value.toLowerCase().trim() || "";
        const filteredBuses = visibleBuses.filter(bus => 
            String(bus.busNumber || "").toLowerCase().includes(searchValue)
        );

        tableBody.innerHTML = "";

        if (filteredBuses.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No buses available</td></tr>`;
            return;
        }

        filteredBuses.forEach((bus) => {
            tableBody.innerHTML += `
                <tr>
                    <td data-label="State">${bus.state || "Not Assigned"}</td>
                    <td data-label="Bus Number">${bus.busNumber}</td>
                    <td data-label="Bus Type">${bus.busType}</td>
                    <td data-label="Capacity">${bus.capacity}</td>
                    <td data-label="Date Time">${bus.createdAt || "N/A"}</td>
                    <td>
                        <button onclick="editBus('${bus.id}')" class="edit-btn">Edit</button>
                        <button onclick="deleteBus('${bus.id}')" class="delete-btn">Delete</button>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Error loading buses:", error);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Error loading buses.</td></tr>`;
    }
}


// =========================================================
// DELETE BUS FROM FIRESTORE
// =========================================================

window.deleteBus = async function(busId) {
    if (!confirm("Are you sure you want to delete this bus?")) return;

    try {
        await deleteDoc(doc(db, "buses", busId));
        alert("Bus deleted successfully.");
        loadBuses();
        loadSystemAnalytics();
    } catch (error) {
        console.error("Error deleting bus:", error);
        alert("Failed to delete bus from database.");
    }
};


// =========================================================
// EDIT BUS SETUP
// =========================================================

window.editBus = async function(busId) {
    try {
        const querySnapshot = await getDocs(collection(db, "buses"));
        const targetDoc = querySnapshot.docs.find(d => d.id === busId);

        if (!targetDoc) {
            alert("Bus record not found.");
            return;
        }

        const bus = targetDoc.data();
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));

        if (currentUser && currentUser.role === "staff") {
            const assignedState = String(currentUser.state || "").trim().toLowerCase();
            const busState = String(bus.state || "").trim().toLowerCase();
            if (busState !== assignedState) {
                alert("Access Denied! You can only edit buses assigned to your terminal.");
                return;
            }
        }

        document.getElementById("busState").value = bus.state || "";
        document.getElementById("busNumber").value = bus.busNumber;
        document.getElementById("busType").value = bus.busType;
        document.getElementById("capacity").value = bus.capacity;

        if (currentUser && currentUser.role === "staff") {
            document.getElementById("busState").readOnly = true;
        }

        editBusId = busId;
        document.querySelector("#busForm button").innerHTML = '<i class="fa-solid fa-pen-to-square"></i><span>Update Bus</span>';
    } catch (error) {
        console.error("Error setting up bus edit:", error);
    }
};


// =========================================================
// ROUTE MANAGEMENT SECTION (FIRESTORE)
// =========================================================

let routeEditId = null;

async function loadStateForRoute() {
    const routeState = document.getElementById("routeState");
    const originInput = document.getElementById("origin");
    if (!routeState) return;

    try {
        const querySnapshot = await getDocs(collection(db, "buses"));
        let buses = [];
        querySnapshot.forEach((doc) => buses.push(doc.data()));

        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        let states = [...new Set(buses.map(bus => bus.state).filter(state => state))];

        if (currentUser && currentUser.role === "staff") {
            const assignedState = String(currentUser.state || "").trim();
            states = states.filter(state => String(state).trim().toLowerCase() === assignedState.toLowerCase());

            routeState.innerHTML = `<option value="${assignedState}">${assignedState}</option>`;
            routeState.value = assignedState;
            routeState.disabled = true;

            if (originInput) {
                originInput.value = assignedState;
                originInput.readOnly = true;
            }
        } else {
            routeState.disabled = false;
            routeState.innerHTML = '<option value="">Select State</option>';
            states.forEach(state => {
                routeState.innerHTML += `<option value="${state}">${state}</option>`;
            });
            if (originInput) {
                originInput.readOnly = false;
            }
        }
    } catch (error) {
        console.error("Error loading states for route:", error);
    }
}

async function loadRouteBuses() {
    const busSelect = document.getElementById("routeBusType");
    if (!busSelect) return;

    try {
        const querySnapshot = await getDocs(collection(db, "buses"));
        let buses = [];
        querySnapshot.forEach((doc) => buses.push(doc.data()));

        const routeState = document.getElementById("routeState");
        const selectedState = routeState?.value || "";
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));

        let visibleBuses = buses;
        if (currentUser && currentUser.role === "staff") {
            const assignedState = String(currentUser.state || "").trim().toLowerCase();
            visibleBuses = buses.filter(bus => String(bus.state || "").trim().toLowerCase() === assignedState);
        } else if (selectedState) {
            visibleBuses = buses.filter(bus => String(bus.state || "").trim().toLowerCase() === selectedState.trim().toLowerCase());
        }

        busSelect.innerHTML = `<option value="">Select Bus</option>`;
        visibleBuses.forEach(bus => {
            busSelect.innerHTML += `
                <option value="${bus.busNumber} - ${bus.busType}">
                    ${bus.busNumber} - ${bus.busType}
                </option>
            `;
        });
    } catch (error) {
        console.error("Error loading route buses:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadStateForRoute();
    loadRouteBuses();

    const routeForm = document.getElementById("routeForm");
    if (!routeForm) return;

    loadRoutes();

    const routeState = document.getElementById("routeState");
    if (routeState) {
        routeState.addEventListener("change", function () {
            loadRouteBuses();
            const busSelect = document.getElementById("routeBusType");
            if (busSelect) busSelect.value = "";
        });
    }

    const searchRoute = document.getElementById("searchRoute");
    if (searchRoute) {
        searchRoute.addEventListener("input", loadRoutes);
    }

    routeForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        const routeName = document.getElementById("routeName").value.trim();
        const origin = document.getElementById("origin").value.trim();
        const destination = document.getElementById("destination").value.trim();
        let state = document.getElementById("routeState").value.trim();
        const routeBusType = document.getElementById("routeBusType").value;
        const fare = Number(document.getElementById("routeFare").value);

        if (currentUser && currentUser.role === "staff") {
            state = String(currentUser.state || "").trim();
            if (!state) {
                alert("Your account does not have an assigned state.");
                return;
            }
        }

        const normalizedRouteName = routeName.replace(/\s+/g, "").replace(/[–—]/g, "-").toLowerCase();
        const normalizedOrigin = origin.replace(/\s+/g, "").toLowerCase();
        const normalizedDestination = destination.replace(/\s+/g, "").toLowerCase();
        const validRouteName = `${normalizedOrigin}-${normalizedDestination}`;

        if (normalizedRouteName !== validRouteName) {
            alert("Invalid Route Name! The route name must match the selected Origin and Destination. Example: Lagos-Abuja.");
            return;
        }

        try {
            const busQuery = await getDocs(collection(db, "buses"));
            let selectedBus = null;
            busQuery.forEach((d) => {
                const b = d.data();
                if (`${b.busNumber} - ${b.busType}` === routeBusType) {
                    selectedBus = b;
                }
            });

            if (!selectedBus) {
                alert("Please select a valid bus.");
                return;
            }

            const routeData = {
                state,
                routeName,
                origin,
                destination,
                busType: routeBusType,
                fare,
                createdAt: routeEditId ? document.getElementById("routeCreatedAt")?.value || new Date().toLocaleString() : new Date().toLocaleString()
            };

            if (!routeEditId) {
                await addDoc(collection(db, "routes"), routeData);
                alert("Route Added Successfully!");
            } else {
                const routeRef = doc(db, "routes", routeEditId);
                await updateDoc(routeRef, routeData);
                routeEditId = null;
                document.querySelector("#routeForm button").innerHTML = `<i class="fa-solid fa-plus"></i> Add Route`;
                alert("Route Updated Successfully!");
            }

            routeForm.reset();
            loadStateForRoute();
            loadRouteBuses();
            loadRoutes();
            loadSystemAnalytics();

        } catch (error) {
            console.error("Error saving route to Firestore:", error);
            alert("Failed to save route: " + error.message);
        }
    });
});

async function loadRoutes() {
    const tableBody = document.getElementById("routeTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Loading routes...</td></tr>`;

    try {
        const querySnapshot = await getDocs(collection(db, "routes"));
        let routes = [];
        querySnapshot.forEach((doc) => {
            routes.push({ id: doc.id, ...doc.data() });
        });

        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        let visibleRoutes = routes;

        if (currentUser && currentUser.role === "staff") {
            const assignedState = String(currentUser.state || "").trim().toLowerCase();
            visibleRoutes = routes.filter(item => String(item.state || "").trim().toLowerCase() === assignedState);
        }

        const totalRoutes = document.getElementById("totalRoutes");
        if (totalRoutes) {
            totalRoutes.textContent = visibleRoutes.length;
        }

        const searchValue = document.getElementById("searchRoute")?.value.toLowerCase().trim() || "";
        const filteredRoutes = visibleRoutes.filter(route =>
            String(route.routeName || "").toLowerCase().includes(searchValue) ||
            String(route.origin || "").toLowerCase().includes(searchValue) ||
            String(route.destination || "").toLowerCase().includes(searchValue) ||
            String(route.busType || "").toLowerCase().includes(searchValue) ||
            String(route.state || "").toLowerCase().includes(searchValue)
        );

        tableBody.innerHTML = "";

        if (filteredRoutes.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No routes available</td></tr>`;
            return;
        }

        filteredRoutes.forEach((route) => {
            tableBody.innerHTML += `
                <tr>
                    <td data-label="State">${route.state || "Not Assigned"}</td>
                    <td data-label="Route">${route.routeName}</td>
                    <td data-label="Origin">${route.origin}</td>
                    <td data-label="Destination">${route.destination}</td>
                    <td data-label="Bus Type">${route.busType}</td>
                    <td data-label="Ticket Price">₦${Number(route.fare || 0).toLocaleString()}</td>
                    <td data-label="Date Time">${route.createdAt || "N/A"}</td>
                    <td>
                        <button onclick="editRoute('${route.id}')" class="edit-btn">Edit</button>
                        <button onclick="deleteRoute('${route.id}')" class="delete-btn">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error loading routes:", error);
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Error loading routes from cloud.</td></tr>`;
    }
}

window.deleteRoute = async function(routeId) {
    if (!confirm("Are you sure you want to delete this route?")) return;

    try {
        await deleteDoc(doc(db, "routes", routeId));
        alert("Route deleted successfully.");
        loadRoutes();
        loadSystemAnalytics();
    } catch (error) {
        console.error("Error deleting route:", error);
        alert("Failed to delete route.");
    }
};

window.editRoute = async function(routeId) {
    try {
        const querySnapshot = await getDocs(collection(db, "routes"));
        const targetDoc = querySnapshot.docs.find(d => d.id === routeId);

        if (!targetDoc) return;
        const route = targetDoc.data();

        document.getElementById("routeName").value = route.routeName;
        document.getElementById("origin").value = route.origin;
        document.getElementById("destination").value = route.destination;
        document.getElementById("routeState").value = route.state;

        await loadRouteBuses();

        document.getElementById("routeBusType").value = route.busType;
        document.getElementById("routeFare").value = route.fare;

        routeEditId = routeId;
        document.querySelector("#routeForm button").innerHTML = `<i class="fa-solid fa-pen"></i> Update Route`;
    } catch (error) {
        console.error("Error setting up route edit:", error);
    }
};


// =========================================================
// SCHEDULE MANAGEMENT SECTION (FIRESTORE)
// =========================================================

let scheduleEditId = null;

async function loadScheduleState() {
    const stateSelect = document.getElementById("scheduleState") || document.getElementById("routeState");
    if (!stateSelect) return;

    try {
        const querySnapshot = await getDocs(collection(db, "buses"));
        let states = [];
        querySnapshot.forEach(docSnap => {
            const bus = docSnap.data();
            if (bus.state) states.push(bus.state);
        });

        const uniqueStates = [...new Set(states)];
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));

        stateSelect.innerHTML = `<option value="">Select State</option>`;

        if (currentUser && currentUser.role === "staff") {
            const assignedState = String(currentUser.state || "").trim();
            stateSelect.innerHTML = `<option value="${assignedState}">${assignedState}</option>`;
            stateSelect.value = assignedState;
            stateSelect.disabled = true;
        } else {
            uniqueStates.forEach(st => {
                stateSelect.innerHTML += `<option value="${st}">${st}</option>`;
            });
        }
    } catch (error) {
        console.error("Error loading schedule states:", error);
    }
}

function updateSchedulingStatus() {}

async function loadSchedules() {
    const tableBody = document.getElementById("scheduleTableBody") || document.getElementById("availableSchedulesBody");
    const totalSchedulesElem = document.getElementById("totalSchedules");

    try {
        const querySnapshot = await getDocs(collection(db, "schedules"));
        
        if (totalSchedulesElem) {
            totalSchedulesElem.textContent = querySnapshot.size;
        }

        if (!tableBody) return;
        tableBody.innerHTML = "";

        if (querySnapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No schedules available</td></tr>`;
            return;
        }

        querySnapshot.forEach(docSnap => {
            const sch = docSnap.data();
            const state = sch.state || "N/A";
            const busNumber = sch.busNumber || sch.bus || "N/A";
            const route = sch.routeName || sch.route || "N/A";
            const departureDate = sch.departureDate || "N/A";
            const departureTime = sch.departureTime || "N/A";
            const expectedArrival = sch.expectedArrivalDate ? `${sch.expectedArrivalDate} ${sch.expectedArrivalTime || ''}` : "N/A";
            const status = sch.status || "Active";

            tableBody.innerHTML += `
                <tr>
                    <td>${state}</td>
                    <td>${busNumber}</td>
                    <td>${route}</td>
                    <td>${departureDate}</td>
                    <td>${departureTime}</td>
                    <td>${expectedArrival}</td>
                    <td><span class="badge active">${status}</span></td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Error loading schedules:", error);
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Error loading schedules from cloud</td></tr>`;
        }
    }
}

async function loadScheduleBuses() {
    const busSelect = document.getElementById("busNumber");
    const stateSelect = document.getElementById("scheduleState");
    
    if (!busSelect) return;

    try {
        const selectedState = stateSelect ? stateSelect.value.trim().toLowerCase() : "";
        const querySnapshot = await getDocs(collection(db, "buses"));
        
        busSelect.innerHTML = '<option value="">Select Bus</option>';

        querySnapshot.forEach((docSnap) => {
            const bus = docSnap.data();
            const busState = (bus.state || "").trim().toLowerCase();
            const busNum = bus.busNumber || bus.number;

            if (!selectedState || busState === selectedState) {
                if (busNum) {
                    const displayVal = `${busNum} - ${bus.busType || 'Standard'}`;
                    busSelect.innerHTML += `<option value="${displayVal}">${displayVal}</option>`;
                }
            }
        });
    } catch (error) {
        console.error("Error loading schedule buses:", error);
    }
}

async function loadScheduleRoutes() {
    const routeSelect = document.getElementById("routeName") || document.getElementById("routeSelect");
    const busSelect = document.getElementById("busNumber");
    const stateSelect = document.getElementById("scheduleState");

    if (!routeSelect) return;

    try {
        const selectedBus = busSelect ? busSelect.value : "";
        const selectedState = stateSelect ? stateSelect.value.trim().toLowerCase() : "";

        const querySnapshot = await getDocs(collection(db, "routes"));
        routeSelect.innerHTML = `<option value="">Select Route</option>`;

        querySnapshot.forEach(docSnap => {
            const route = docSnap.data();
            const routeState = String(route.state || "").trim().toLowerCase();
            const routeBus = route.busType || "";

            const stateMatches = !selectedState || routeState === selectedState;
            const busMatches = !selectedBus || routeBus === selectedBus;

            if (stateMatches && busMatches) {
                const rName = route.routeName || `${route.origin}-${route.destination}`;
                routeSelect.innerHTML += `<option value="${rName}">${rName} (₦${Number(route.fare || 0).toLocaleString()})</option>`;
            }
        });
    } catch (error) {
        console.error("Error loading schedule routes:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const scheduleForm = document.getElementById("scheduleForm");
    if (!scheduleForm) return;

    loadScheduleState();
    loadScheduleBuses();
    loadScheduleRoutes();
    loadSchedules();

    const scheduleState = document.getElementById("scheduleState");
    if (scheduleState) {
        scheduleState.addEventListener("change", function () {
            loadScheduleBuses();
            loadScheduleRoutes();
            const busSelect = document.getElementById("busNumber");
            const routeSelect = document.getElementById("routeName");
            if (busSelect) busSelect.value = "";
            if (routeSelect) routeSelect.innerHTML = '<option value="">Select Route</option>';
        });
    }

    const busNumber = document.getElementById("busNumber");
    if (busNumber) {
        busNumber.addEventListener("change", function () {
            loadScheduleRoutes();
        });
    }

    const searchSchedule = document.getElementById("searchSchedule");
    if (searchSchedule) {
        searchSchedule.addEventListener("input", loadSchedules);
    }

    scheduleForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        let scheduleState = document.getElementById("scheduleState").value.trim();
        const busNumber = document.getElementById("busNumber").value;
        const routeName = document.getElementById("routeName").value;
        const departureDate = document.getElementById("departureDate").value;
        const departureTime = document.getElementById("departureTime").value;
        const expectedArrivalDate = document.getElementById("expectedArrivalDate").value;
        const expectedArrivalTime = document.getElementById("expectedArrivalTime").value;

        if (currentUser && currentUser.role === "staff") {
            scheduleState = String(currentUser.state || "").trim();
            if (!scheduleState) {
                alert("Your account does not have an assigned state.");
                return;
            }
        }

        try {
            const busQuery = await getDocs(collection(db, "buses"));
            let selectedBus = null;
            busQuery.forEach((doc) => {
                const b = doc.data();
                if (`${b.busNumber} - ${b.busType}` === busNumber) selectedBus = b;
            });

            if (!selectedBus) {
                alert("Please select a valid bus.");
                return;
            }

            const scheduleData = {
                state: scheduleState,
                busNumber,
                routeName,
                departureDate,
                departureTime,
                expectedArrivalDate,
                expectedArrivalTime,
                status: "Scheduled",
                manualStatus: false,
                createdAt: scheduleEditId ? document.getElementById("scheduleCreatedAt")?.value || new Date().toLocaleString() : new Date().toLocaleString()
            };

            if (!scheduleEditId) {
                await addDoc(collection(db, "schedules"), scheduleData);
                alert("Schedule Added Successfully!");
            } else {
                const scheduleRef = doc(db, "schedules", scheduleEditId);
                await updateDoc(scheduleRef, scheduleData);
                scheduleEditId = null;
                document.querySelector("#scheduleForm button").innerHTML = `<i class="fa-solid fa-calendar-plus"></i> Add Schedule`;
                alert("Schedule Updated Successfully!");
            }

            scheduleForm.reset();
            loadScheduleState();
            loadScheduleBuses();
            loadScheduleRoutes();
            loadSchedules();
            loadSystemAnalytics();

        } catch (error) {
            console.error("Error saving schedule to Firestore:", error);
            alert("Failed to save schedule: " + error.message);
        }
    });
});

window.editSchedules = async function(scheduleId) {
    try {
        const querySnapshot = await getDocs(collection(db, "schedules"));
        const targetDoc = querySnapshot.docs.find(d => d.id === scheduleId);
        if (!targetDoc) return;

        const schedule = targetDoc.data();
        document.getElementById("scheduleState").value = schedule.state;
        await loadScheduleBuses();
        document.getElementById("busNumber").value = schedule.busNumber;
        await loadScheduleRoutes();
        document.getElementById("routeName").value = schedule.routeName;
        document.getElementById("departureDate").value = schedule.departureDate;
        document.getElementById("departureTime").value = schedule.departureTime;
        document.getElementById("expectedArrivalDate").value = schedule.expectedArrivalDate || "";
        document.getElementById("expectedArrivalTime").value = schedule.expectedArrivalTime || "";

        scheduleEditId = scheduleId;
        document.querySelector("#scheduleForm button").innerHTML = `<i class="fa-solid fa-pen"></i> Update Schedule`;
    } catch (error) {
        console.error("Error setting up schedule edit:", error);
    }
};

window.cancelSchedules = async function(scheduleId) {
    if (!confirm("Cancel this schedule?")) return;

    try {
        const scheduleRef = doc(db, "schedules", scheduleId);
        await updateDoc(scheduleRef, {
            status: "Cancelled",
            manualStatus: true
        });
        alert("Schedule cancelled successfully.");
        loadSchedules();
        loadSystemAnalytics();
    } catch (error) {
        console.error("Error cancelling schedule:", error);
    }
};


// =========================================================
// AVAILABLE SCHEDULES & PASSENGER SELECTION (FIRESTORE)
// =========================================================

let selectedSchedule = null;
let renderedAvailableSchedules = [];

async function loadAvailableSchedules() {
    const tableBody = document.getElementById("availableScheduleBody");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Loading available schedules...</td></tr>`;

    try {
        const scheduleSnap = await getDocs(collection(db, "schedules"));
        let schedules = [];
        scheduleSnap.forEach(doc => schedules.push({ id: doc.id, ...doc.data() }));

        const routeSnap = await getDocs(collection(db, "routes"));
        let routes = [];
        routeSnap.forEach(doc => routes.push(doc.data()));

        const bookingSnap = await getDocs(collection(db, "bookings"));
        let bookings = [];
        bookingSnap.forEach(doc => bookings.push(doc.data()));

        const driverSnap = await getDocs(collection(db, "drivers"));
        let drivers = [];
        driverSnap.forEach(doc => drivers.push(doc.data()));

        const busSnap = await getDocs(collection(db, "buses"));
        let buses = [];
        busSnap.forEach(doc => buses.push(doc.data()));

        const searchInput = document.getElementById("searchAvailableSchedule");
        const search = searchInput ? searchInput.value.toLowerCase().trim() : "";

        renderedAvailableSchedules = schedules.filter(schedule => {
            if (schedule.status === "Cancelled" || schedule.status === "Departed") {
                return false;
            }

            const scheduleBus = String(schedule.busNumber || "").replace(/\s+/g, "").toLowerCase();
            const bus = buses.find(b => `${b.busNumber}-${b.busType}`.replace(/\s+/g, "").toLowerCase() === scheduleBus);

            if (!bus) return false;

            return (
                String(schedule.state || "").toLowerCase().includes(search) ||
                String(schedule.routeName || "").toLowerCase().includes(search) ||
                String(schedule.busNumber || "").toLowerCase().includes(search)
            );
        });

        tableBody.innerHTML = "";

        if (renderedAvailableSchedules.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No available schedules.</td></tr>`;
            return;
        }

        renderedAvailableSchedules.forEach((schedule, index) => {
            const scheduleBus = String(schedule.busNumber || "").replace(/\s+/g, "").toLowerCase();
            const driver = drivers.find(d => String(d.busNumber || "").replace(/\s+/g, "").toLowerCase() === scheduleBus);
            const bus = buses.find(b => `${b.busNumber}-${b.busType}`.replace(/\s+/g, "").toLowerCase() === scheduleBus);

            const bookedSeats = bookings.filter(booking => {
                if (booking.bookingStatus === "Cancelled" || booking.bookingStatus === "Expired" || booking.bookingStatus === "Departed") return false;
                const bookingBus = booking.selectedBus || (booking.busNumber && booking.busType ? `${booking.busNumber}-${booking.busType}` : booking.busNumber);
                if (!bookingBus) return false;
                return String(bookingBus).replace(/\s+/g, "").toLowerCase() === scheduleBus;
            }).length;

            const capacity = bus ? Number(bus.capacity) : 0;
            const seatsLeft = Math.max(capacity - bookedSeats, 0);

            const route = routes.find(r => r.routeName === schedule.routeName && r.busType === schedule.busNumber);

            tableBody.innerHTML += `
                <tr id="scheduleRow${index}" onclick="selectSchedule(${index})" style="cursor:pointer;">
                    <td>${schedule.state || "N/A"}</td>
                    <td>${schedule.routeName}</td>
                    <td>${schedule.busNumber}</td>
                    <td>${driver ? driver.driverName : "Not Assigned"}</td>
                    <td>${schedule.departureDate}</td>
                    <td>${to12Hour(schedule.departureTime)}</td>
                    <td>₦${route ? Number(route.fare || 0).toLocaleString() : "0"}</td>
                    <td>${seatsLeft}</td>
                    <td>${getStatusWithEmoji(schedule.status)}</td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Error loading available schedules:", error);
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Error loading schedules from cloud.</td></tr>`;
    }
}

window.selectSchedule = function(index) {
    selectedSchedule = renderedAvailableSchedules[index];
    if (!selectedSchedule) return;

    document.querySelectorAll("#availableScheduleBody tr").forEach(row => {
        row.classList.remove("selectedSchedule");
    });

    const selectedRow = document.getElementById(`scheduleRow${index}`);
    if (selectedRow) {
        selectedRow.classList.add("selectedSchedule");
    }

    const tripDetails = document.getElementById("tripDetails");
    if (tripDetails) {
        tripDetails.innerHTML = `
            <h3>Trip Details</h3>
            <p><strong>State:</strong> ${selectedSchedule.state}</p>
            <p><strong>Route:</strong> ${selectedSchedule.routeName}</p>
            <p><strong>Bus:</strong> ${selectedSchedule.busNumber}</p>
            <p><strong>Departure Date:</strong> ${selectedSchedule.departureDate}</p>
            <p><strong>Departure Time:</strong> ${to12Hour(selectedSchedule.departureTime)}</p>
            <p><strong>Status:</strong> ${selectedSchedule.status}</p>
        `;
    }

    const bookButton = document.getElementById("bookTicketBtn");
    if (bookButton) {
        bookButton.disabled = false;
    }
};

window.bookSelectedTicket = function() {
    if (!selectedSchedule) {
        alert("Please select a schedule first.");
        return;
    }
    localStorage.setItem("selectedSchedule", JSON.stringify(selectedSchedule));
    window.location.href = "bookings.html";
};

document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("searchAvailableSchedule");
    if (searchInput) {
        searchInput.addEventListener("input", loadAvailableSchedules);
    }
    if (document.getElementById("availableScheduleBody")) {
        loadAvailableSchedules();
    }
});

// =========================================================
// DASHBOARD ANALYTICS & REAL-TIME STATS (FIRESTORE)
// =========================================================

async function loadSystemAnalytics() {
    try {
        const [bookingsSnap, busesSnap, schedulesSnap, staffSnap, driversSnap, routesSnap, baysSnap] = await Promise.all([
            getDocs(collection(db, "bookings")),
            getDocs(collection(db, "buses")),
            getDocs(collection(db, "schedules")),
            getDocs(collection(db, "staffs")),
            getDocs(collection(db, "drivers")),
            getDocs(collection(db, "routes")),
            getDocs(collection(db, "bays"))
        ]);

        let bookings = [];
        bookingsSnap.forEach(doc => bookings.push(doc.data()));

        let activeBookings = bookings.filter(b => 
            b.bookingStatus !== "Cancelled" && b.bookingStatus !== "Expired"
        );

        let totalRevenue = activeBookings.reduce((sum, b) => {
            return sum + Number(b.ticketPrice || 0);
        }, 0);

        let bays = [];
        baysSnap.forEach(doc => bays.push(doc.data()));
        let availableBaysCount = bays.filter(b => (b.status || "").toLowerCase() === "available").length;
        let occupiedBaysCount = bays.filter(b => (b.status || "").toLowerCase() === "occupied").length;
        let assignedBaysCount = bays.filter(b => b.assignedBus && b.assignedBus !== "None" && b.assignedBus !== "").length;

        // Update Dashboard Elements by ID
        const totalBusesElem = document.getElementById("totalBuses");
        const totalRoutesElem = document.getElementById("totalRoutes");
        const totalSchedulesElem = document.getElementById("totalSchedules");
        const totalBookingsElem = document.getElementById("totalBookings");
        const totalRevenueElem = document.getElementById("totalRevenue");

        if (totalBusesElem) totalBusesElem.textContent = busesSnap.size;
        if (totalRoutesElem) totalRoutesElem.textContent = routesSnap.size;
        if (totalSchedulesElem) totalSchedulesElem.textContent = schedulesSnap.size;
        if (totalBookingsElem) totalBookingsElem.textContent = activeBookings.length;
        if (totalRevenueElem) totalRevenueElem.textContent = `₦${totalRevenue.toLocaleString()}`;

        // Explicit ID updates
        const totalStaffElem = document.getElementById("totalStaff");
        if (totalStaffElem) totalStaffElem.textContent = staffSnap.size;

        const totalTerminalStaffElem = document.getElementById("totalTerminalStaff");
        if (totalTerminalStaffElem) totalTerminalStaffElem.textContent = staffSnap.size;

        const totalDriversElem = document.getElementById("totalDrivers");
        if (totalDriversElem) totalDriversElem.textContent = driversSnap.size;

        // Universal Card Scanner for Stat Cards on all pages
        document.querySelectorAll(".stat-card, .card").forEach(card => {
            const labelSpan = card.querySelector("span");
            const valueStrong = card.querySelector("strong");
            if (labelSpan && valueStrong) {
                const labelText = labelSpan.textContent.trim().toUpperCase();
                if (labelText.includes("TOTAL STAFF") || labelText === "STAFF") {
                    valueStrong.textContent = staffSnap.size;
                } else if (labelText.includes("TERMINAL STAFF")) {
                    valueStrong.textContent = staffSnap.size;
                } else if (labelText.includes("TOTAL DRIVERS") || labelText.includes("DRIVERS")) {
                    valueStrong.textContent = driversSnap.size;
                } else if (labelText.includes("TOTAL BAYS")) {
                    valueStrong.textContent = baysSnap.size;
                } else if (labelText.includes("AVAILABLE")) {
                    valueStrong.textContent = availableBaysCount;
                } else if (labelText.includes("ASSIGNED")) {
                    valueStrong.textContent = assignedBaysCount;
                } else if (labelText.includes("OCCUPIED")) {
                    valueStrong.textContent = occupiedBaysCount;
                } else if (labelText.includes("TOTAL BUSES")) {
                    valueStrong.textContent = busesSnap.size;
                } else if (labelText.includes("TOTAL ROUTES")) {
                    valueStrong.textContent = routesSnap.size;
                } else if (labelText.includes("TOTAL SCHEDULES")) {
                    valueStrong.textContent = schedulesSnap.size;
                }
            }
        });

    } catch (error) {
        console.error("Error loading system analytics:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadSystemAnalytics();
});

// =========================================================
// POPULATE ROUTE DROPDOWN (FALLBACK HELPER)
// =========================================================

async function loadRouteDropdown() {
    const routeSelect = document.getElementById("routeSelect") || document.getElementById("scheduleRoute") || document.querySelector("select[name='route']");
    if (!routeSelect) return;

    try {
        const querySnapshot = await getDocs(collection(db, "routes"));
        routeSelect.innerHTML = `<option value="">Select Route</option>`;

        if (querySnapshot.empty) {
            routeSelect.innerHTML += `<option value="" disabled>No routes available. Create one in Routes page.</option>`;
            return;
        }

        querySnapshot.forEach(docSnap => {
            const route = docSnap.data();
            const routeName = route.routeName || `${route.origin}-${route.destination}`;
            routeSelect.innerHTML += `<option value="${routeName}">${routeName}</option>`;
        });

    } catch (error) {
        console.error("Error loading routes for dropdown:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadRouteDropdown();
});


// =========================================================
// BOOKING MANAGEMENT & SUBMISSION (FIRESTORE)
// =========================================================

let bookingEditId = null;

async function loadBookings() {
    const tableBody = document.getElementById("bookingTableBody") || 
                      document.getElementById("bookingHistoryBody") || 
                      document.getElementById("bookingsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="26" style="text-align:center;">Loading bookings...</td></tr>`;

    try {
        const querySnapshot = await getDocs(collection(db, "bookings"));
        let bookings = [];
        querySnapshot.forEach((docSnap) => {
            bookings.push({ id: docSnap.id, ...docSnap.data() });
        });

        tableBody.innerHTML = "";

        if (bookings.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="26" style="text-align:center;">No bookings available</td></tr>`;
            return;
        }

        bookings.forEach((booking) => {
            tableBody.innerHTML += `
                <tr id="booking-${booking.id}">
                    <td data-label="Booking ID">${booking.bookingId || "N/A"}</td> 
                    <td data-label="Receipt Number">${booking.receiptNumber || "-"}</td>
                    <td data-label="State">${booking.state || "N/A"}</td>   
                    <td data-label="Passenger Name">${booking.passengerName || "N/A"}</td>
                    <td data-label="Passenger Phone">${booking.passengerPhone || "N/A"}</td>
                    <td data-label="Passenger Email">${booking.passengerEmail || "-"}</td>
                    <td data-label="How many kids">${booking.kidCount || 0}</td>
                    <td data-label="Sponsor Name">${booking.sponsorName || "-"}</td>
                    <td data-label="Sponsor Phone">${booking.sponsorPhone || "-"}</td>
                    <td data-label="Sponsor Email">${booking.sponsorEmail || "-"}</td>
                    <td data-label="Gender">${booking.gender || "-"}</td>
                    <td data-label="Bus">${booking.busNumber || "N/A"}</td>
                    <td data-label="Route">${booking.route || "N/A"}</td>
                    <td data-label="Bus Status">Active</td>
                    <td data-label="Payment Method">${booking.paymentMethod || "-"}</td>
                    <td data-label="Payment Status">${booking.paymentStatus || "Pending"}</td>
                    <td data-label="Transaction Reference">-</td>
                    <td data-label="Booking Status">${booking.bookingStatus || "Active"}</td>
                    <td data-label="Ticket Type">${booking.ticketType || "-"}</td>
                    <td data-label="Seat">${booking.seatNumber || "-"}</td>
                    <td data-label="Departure Date">${booking.departureDate || "-"}</td>
                    <td data-label="Departure Time">${booking.departureTime || "-"}</td>
                    <td data-label="Driver Name">${booking.driverName || "-"}</td>  
                    <td data-label="Ticket Price">₦${Number(booking.ticketPrice || 0).toLocaleString()}</td>
                    <td data-label="Booking Date">${booking.bookingDate || "N/A"}</td>
                    <td>
                        <button onclick="cancelBooking('${booking.id}')" class="delete-btn">Cancel</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error loading bookings:", error);
        tableBody.innerHTML = `<tr><td colspan="26" style="text-align:center;">Error loading bookings from cloud.</td></tr>`;
    }
}

async function loadBookingStates() {
    const stateSelect = document.getElementById("bookingState") || document.getElementById("departureState");
    if (!stateSelect) return;

    try {
        const querySnapshot = await getDocs(collection(db, "schedules"));
        let states = [];
        querySnapshot.forEach(docSnap => {
            const sch = docSnap.data();
            if (sch.state) states.push(sch.state);
        });

        const uniqueStates = [...new Set(states)];
        stateSelect.innerHTML = `<option value="">Select State</option>`;
        
        uniqueStates.forEach(st => {
            stateSelect.innerHTML += `<option value="${st}">${st}</option>`;
        });
    } catch (error) {
        console.error("Error loading booking states:", error);
    }
}

async function loadBookingBuses() {
    const busSelect = document.getElementById("bookingBusNumber") || document.getElementById("busNumber");
    const stateSelect = document.getElementById("bookingState") || document.getElementById("departureState");
    if (!busSelect) return;

    try {
        const selectedState = stateSelect ? stateSelect.value.trim().toLowerCase() : "";
        const querySnapshot = await getDocs(collection(db, "schedules"));
        
        busSelect.innerHTML = `<option value="">Select Bus</option>`;
        
        querySnapshot.forEach(docSnap => {
            const sch = docSnap.data();
            const schState = (sch.state || "").trim().toLowerCase();

            if (!selectedState || schState === selectedState) {
                if (sch.busNumber) {
                    busSelect.innerHTML += `<option value="${sch.busNumber}">${sch.busNumber}</option>`;
                }
            }
        });
    } catch (error) {
        console.error("Error loading booking buses:", error);
    }
}

async function loadBookingRoutes() {
    const routeSelect = document.getElementById("bookingRoute") || document.getElementById("routeName");
    if (!routeSelect) return;

    try {
        const querySnapshot = await getDocs(collection(db, "routes"));
        routeSelect.innerHTML = `<option value="">Select Route</option>`;

        querySnapshot.forEach(docSnap => {
            const route = docSnap.data();
            const rName = route.routeName || `${route.origin}-${route.destination}`;
            routeSelect.innerHTML += `<option value="${rName}">${rName}</option>`;
        });
    } catch (error) {
        console.error("Error loading booking routes:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadBookingStates();
    loadBookingBuses();
    loadBookingRoutes();

    const departureStateElem = document.getElementById("bookingState") || document.getElementById("departureState");
    if (departureStateElem) {
        departureStateElem.addEventListener("change", () => {
            loadBookingBuses();
        });
    }

    const bookingTableBody = document.getElementById("bookingTableBody");
    if (bookingTableBody) {
        loadBookings();
    }

    const searchBookingInput = document.getElementById("searchBooking");
    if (searchBookingInput) {
        searchBookingInput.addEventListener("input", loadBookings);
    }

    const bookingForm = document.getElementById("bookingForm");
    if (bookingForm) {
        bookingForm.addEventListener("submit", async function (event) {
            event.preventDefault();

            const passengerName = document.getElementById("passengerName")?.value.trim();
            const passengerPhone = document.getElementById("passengerPhone")?.value.trim();
            const passengerEmail = document.getElementById("passengerEmail")?.value.trim();
            const gender = document.getElementById("gender")?.value;
            const ticketType = document.getElementById("ticketType")?.value;
            const kidCount = document.getElementById("kidCount")?.value || 0;
            const sponsorName = document.getElementById("sponsorName")?.value.trim();
            const sponsorPhone = document.getElementById("sponsorPhone")?.value.trim();
            const sponsorEmail = document.getElementById("sponsorEmail")?.value.trim();
            const state = document.getElementById("bookingState")?.value.trim() || document.getElementById("departureState")?.value.trim();
            const busNumber = document.getElementById("bookingBusNumber")?.value.trim();
            const route = document.getElementById("bookingRoute")?.value.trim();
            const paymentMethod = document.getElementById("paymentMethod")?.value.trim();
            const ticketPrice = document.getElementById("ticketPrice")?.value || "0";

            if (!passengerName || !passengerPhone || !state || !busNumber || !route) {
                alert("Please fill in all required booking fields.");
                return;
            }

            try {
                const bookingData = {
                    bookingId: "BK" + Math.floor(1000 + Math.random() * 9000),
                    passengerName,
                    passengerPhone,
                    passengerEmail,
                    gender,
                    ticketType,
                    kidCount: Number(kidCount),
                    sponsorName,
                    sponsorPhone,
                    sponsorEmail,
                    state,
                    busNumber,
                    route,
                    paymentMethod,
                    paymentStatus: paymentMethod === "Cash" ? "Pending" : "Paid",
                    bookingStatus: "Active",
                    bookingDate: new Date().toLocaleDateString(),
                    ticketPrice: Number(ticketPrice) || 0,
                    createdAt: new Date().toLocaleString()
                };

                await addDoc(collection(db, "bookings"), bookingData);
                alert("Booking Successful! Saved to Cloud.");
                bookingForm.reset();

                // Check role to route customer vs admin/staff appropriately
                const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
                const role = String(currentUser.role || "").toLowerCase();

                if (role === "customer") {
                    window.location.href = "available-schedules.html";
                } else {
                    window.location.href = "bookinghistory.html";
                }

            } catch (error) {
                console.error("Error saving booking to Firestore:", error);
                alert("Failed to save booking: " + error.message);
            }
        });
    }
});


// =========================================================
// BAY / PLATFORM MANAGEMENT SECTION (FIRESTORE)
// =========================================================

let editBayId = null;

async function loadBayStates() {
    const stateSelect = document.getElementById("bayState") || document.getElementById("state") || document.querySelector("select[name='state']");
    if (!stateSelect) return;

    try {
        const querySnapshot = await getDocs(collection(db, "buses"));
        let states = [];
        querySnapshot.forEach(docSnap => {
            const bus = docSnap.data();
            if (bus.state) states.push(bus.state);
        });

        const uniqueStates = [...new Set(states)];
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));

        stateSelect.innerHTML = `<option value="">Select State</option>`;

        if (currentUser && currentUser.role === "staff") {
            const assignedState = String(currentUser.state || "").trim();
            stateSelect.innerHTML = `<option value="${assignedState}">${assignedState}</option>`;
            stateSelect.value = assignedState;
            stateSelect.disabled = true;
        } else {
            uniqueStates.forEach(st => {
                stateSelect.innerHTML += `<option value="${st}">${st}</option>`;
            });
        }
    } catch (error) {
        console.error("Error loading bay states:", error);
    }
}

async function loadBayBuses() {
    const busSelect = document.getElementById("bayBus") || document.getElementById("assignedBus") || document.querySelector("select[name='assignedBus']");
    if (!busSelect) return;

    try {
        const querySnapshot = await getDocs(collection(db, "buses"));
        busSelect.innerHTML = `<option value="">Select Bus (optional)</option>`;

        querySnapshot.forEach(docSnap => {
            const bus = docSnap.data();
            if (bus.busNumber) {
                busSelect.innerHTML += `<option value="${bus.busNumber}">${bus.busNumber} (${bus.busType || 'Standard'})</option>`;
            }
        });
    } catch (error) {
        console.error("Error loading bay buses:", error);
    }
}

async function loadBays() {
    const tableBody = document.getElementById("bayTableBody") || 
                      document.getElementById("platformTableBody") || 
                      document.querySelector("tbody");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Loading terminal bays...</td></tr>`;

    try {
        const querySnapshot = await getDocs(collection(db, "bays"));
        let bays = [];
        querySnapshot.forEach((docSnap) => {
            bays.push({ id: docSnap.id, ...docSnap.data() });
        });

        tableBody.innerHTML = "";

        if (bays.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No bays registered yet.</td></tr>`;
            return;
        }

        bays.forEach((bay) => {
            tableBody.innerHTML += `
                <tr>
                    <td data-label="State">${bay.state || "N/A"}</td>
                    <td data-label="Bay Number">${bay.bayNumber || "N/A"}</td>
                    <td data-label="Status">${bay.status || "Active"}</td>
                    <td data-label="Assigned Bus">${bay.assignedBus || "None"}</td>
                    <td data-label="Bus Status">${bay.busStatus || "N/A"}</td>
                    <td>
                        <button onclick="deleteBay('${bay.id}')" class="delete-btn">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error loading bays:", error);
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Error loading bays from cloud.</td></tr>`;
        }
    }
}

window.deleteBay = async function(bayId) {
    if (!confirm("Are you sure you want to delete this bay?")) return;
    try {
        await deleteDoc(doc(db, "bays", bayId));
        alert("Bay deleted successfully.");
        loadBays();
        loadSystemAnalytics();
    } catch (error) {
        console.error("Error deleting bay:", error);
        alert("Failed to delete bay.");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const bayForm = document.getElementById("bayForm") || document.getElementById("platformForm") || document.querySelector("form");
    
    if (window.location.pathname.includes("platform.html") || document.getElementById("bayTableBody")) {
        loadBayStates();
        loadBayBuses();
        loadBays();

        if (bayForm) {
            bayForm.addEventListener("submit", async function(e) {
                e.preventDefault();

                const state = document.getElementById("bayState")?.value || document.getElementById("state")?.value;
                const bayNumber = document.getElementById("bayNumber")?.value.trim();
                const status = document.getElementById("bayStatus")?.value;
                const assignedBus = document.getElementById("assignedBus")?.value || "None";

                if (!state || !bayNumber) {
                    alert("Please select a state and enter a bay number.");
                    return;
                }

                try {
                    const bayData = {
                        state,
                        bayNumber,
                        status: status || "Active",
                        assignedBus,
                        createdAt: new Date().toLocaleString()
                    };

                    await addDoc(collection(db, "bays"), bayData);
                    alert("Bay added successfully!");
                    bayForm.reset();
                    loadBays();
                    loadSystemAnalytics();
                } catch (err) {
                    console.error("Error saving bay:", err);
                    alert("Failed to add bay: " + err.message);
                }
            });
        }
    }
});


// =========================================================
// BUS MOVEMENT / INCOMING BUSES & HISTORY (FIRESTORE)
// =========================================================

async function loadIncomingBuses() {
    const incomingBody = document.getElementById("incomingBusTableBody");
    const historyBody = document.getElementById("movementHistoryTableBody");

    if (!incomingBody && !historyBody) return;

    if (incomingBody) {
        incomingBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Loading incoming buses...</td></tr>`;
    }
    if (historyBody) {
        historyBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">Loading movement history...</td></tr>`;
    }

    try {
        const querySnapshot = await getDocs(collection(db, "schedules"));
        let incomingTrips = [];
        let historyTrips = [];

        querySnapshot.forEach((docSnap) => {
            const sch = { id: docSnap.id, ...docSnap.data() };
            const status = String(sch.status || "").toLowerCase();

            if (status === "arrived") {
                historyTrips.push(sch);
            } else if (status !== "cancelled") {
                incomingTrips.push(sch);
            }
        });

        if (incomingBody) {
            incomingBody.innerHTML = "";
            if (incomingTrips.length === 0) {
                incomingBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No incoming buses found</td></tr>`;
            } else {
                incomingTrips.forEach((trip) => {
                    incomingBody.innerHTML += `
                        <tr>
                            <td>${trip.busNumber || "N/A"}</td>
                            <td>${trip.state || trip.origin || "N/A"}</td>
                            <td>${trip.routeName || "N/A"}</td>
                            <td>${trip.destination || "N/A"}</td>
                            <td>${trip.departureTime || "N/A"}</td>
                            <td>${trip.expectedArrivalTime || "N/A"}</td>
                            <td><span class="badge active">${trip.status || "Scheduled"}</span></td>
                            <td>
                                <button onclick="confirmBusArrival('${trip.id}')" class="edit-btn" style="padding: 5px 10px; cursor:pointer;">Confirm Arrival</button>
                            </td>
                        </tr>
                    `;
                });
            }
        }

        if (historyBody) {
            historyBody.innerHTML = "";
            if (historyTrips.length === 0) {
                historyBody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No completed movement records yet</td></tr>`;
            } else {
                historyTrips.forEach((trip) => {
                    historyBody.innerHTML += `
                        <tr>
                            <td>${trip.busNumber || "N/A"}</td>
                            <td>${trip.state || trip.origin || "N/A"}</td>
                            <td>${trip.routeName || "N/A"}</td>
                            <td>${trip.destination || "N/A"}</td>
                            <td>${trip.departureTime || "N/A"}</td>
                            <td>${trip.expectedArrivalTime || "N/A"}</td>
                            <td>${trip.actualArrivalTime || "N/A"}</td>
                            <td>${trip.confirmedBy || "Admin"}</td>
                        </tr>
                    `;
                });
            }
        }

    } catch (error) {
        console.error("Error loading bus movement data:", error);
    }
}

window.confirmBusArrival = async function(scheduleId) {
    if (!confirm("Confirm that this bus has arrived at the terminal?")) return;

    try {
        const currentUser = JSON.parse(localStorage.getItem("currentUser"));
        const scheduleRef = doc(db, "schedules", scheduleId);

        await updateDoc(scheduleRef, {
            status: "Arrived",
            actualArrivalTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            confirmedBy: currentUser ? currentUser.name || currentUser.username : "Admin"
        });

        alert("Bus arrival confirmed successfully!");
        loadIncomingBuses();
    } catch (error) {
        console.error("Error confirming arrival:", error);
        alert("Failed to confirm arrival: " + error.message);
    }
};

document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("platform.html")) {
        loadIncomingBuses();
    }
});


// =========================================================
// STAFF MANAGEMENT SECTION (FIRESTORE)
// =========================================================

async function loadStaffStates() {
    const stateSelect = document.getElementById("staffState") || document.getElementById("assignedState");
    if (!stateSelect) return;

    try {
        const querySnapshot = await getDocs(collection(db, "buses"));
        let states = [];
        querySnapshot.forEach(docSnap => {
            const bus = docSnap.data();
            if (bus.state) states.push(bus.state);
        });

        const uniqueStates = [...new Set(states)];
        stateSelect.innerHTML = `<option value="">Select State / Terminal</option>`;
        
        uniqueStates.forEach(st => {
            stateSelect.innerHTML += `<option value="${st}">${st}</option>`;
        });
    } catch (error) {
        console.error("Error loading staff states:", error);
    }
}

async function loadStaffList() {
    const tableBody = document.getElementById("staffTableBody") || document.querySelector("tbody");
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Loading staff records...</td></tr>`;

    try {
        const querySnapshot = await getDocs(collection(db, "staffs"));
        let staffList = [];
        querySnapshot.forEach((docSnap) => {
            staffList.push({ id: docSnap.id, ...docSnap.data() });
        });

        tableBody.innerHTML = "";

        if (staffList.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">No staff members registered yet.</td></tr>`;
            return;
        }

        staffList.forEach((staff) => {
            const displayId = staff.id ? `ST-${staff.id.substring(0, 4).toUpperCase()}` : "N/A";

            tableBody.innerHTML += `
                <tr>
                    <td>${displayId}</td>
                    <td>${staff.staffName || "N/A"}</td>
                    <td>${staff.role || "N/A"}</td>
                    <td>${staff.role || "N/A"}</td>
                    <td>${staff.gender || "N/A"}</td>
                    <td>${staff.assignedState || "N/A"}</td>
                    <td>${staff.phone || "N/A"}</td>
                    <td>${staff.createdAt || "N/A"}</td>
                    <td>
                        <button onclick="deleteStaff('${staff.id}')" class="delete-btn" style="padding: 5px 10px; cursor:pointer;">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error loading staff:", error);
        tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center;">Error loading staff records from cloud.</td></tr>`;
    }
}

window.deleteStaff = async function(staffId) {
    if (!confirm("Are you sure you want to delete this staff member?")) return;
    try {
        await deleteDoc(doc(db, "staffs", staffId));
        alert("Staff deleted successfully.");
        loadStaffList();
        loadSystemAnalytics();
    } catch (error) {
        console.error("Error deleting staff:", error);
        alert("Failed to delete staff.");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("staff.html") || document.getElementById("staffTableBody")) {
        loadStaffStates();
        loadStaffList();

        const staffForm = document.getElementById("staffForm");
        if (staffForm) {
            staffForm.addEventListener("submit", async function(e) {
                e.preventDefault();

                const staffName = document.getElementById("staffName")?.value.trim();
                const role = document.getElementById("staffRole")?.value;
                const gender = document.getElementById("staffGender")?.value;
                const assignedState = document.getElementById("staffState")?.value;
                const phone = document.getElementById("staffPhone")?.value.trim();
                const username = document.getElementById("staffUsername")?.value.trim();
                const password = document.getElementById("staffPassword")?.value;
                const confirmPassword = document.getElementById("staffConfirmPassword")?.value;

                if (!staffName || !role || !assignedState || !username || !password) {
                    alert("Please fill in all required staff fields.");
                    return;
                }

                if (confirmPassword && password !== confirmPassword) {
                    alert("Passwords do not match!");
                    return;
                }

                try {
                    const staffData = {
                        staffName,
                        role,
                        gender: gender || "Not Specified",
                        assignedState,
                        phone: phone || "N/A",
                        username,
                        password,
                        createdAt: new Date().toLocaleString()
                    };

                    await addDoc(collection(db, "staffs"), staffData);
                    alert("Staff member registered successfully!");
                    staffForm.reset();
                    loadStaffList();
                    loadSystemAnalytics();
                } catch (err) {
                    console.error("Error saving staff:", err);
                    alert("Failed to register staff: " + err.message);
                }
            });
        }
    }
});

// =========================================================
// DRIVER MANAGEMENT SECTION (FIRESTORE)
// =========================================================

async function loadDriverBuses() {
    const selects = document.querySelectorAll("select");
    let busSelect = null;
    
    selects.forEach(sel => {
        if (sel.id.toLowerCase().includes("bus") || sel.innerHTML.includes("Select Bus") || sel.previousElementSibling?.textContent.includes("Bus")) {
            busSelect = sel;
        }
    });

    if (!busSelect) return;

    try {
        const querySnapshot = await getDocs(collection(db, "buses"));
        busSelect.innerHTML = `<option value="">Select Bus</option>`;

        querySnapshot.forEach(docSnap => {
            const bus = docSnap.data();
            if (bus.busNumber) {
                const displayVal = `${bus.busNumber} - ${bus.busType || 'Standard'}`;
                busSelect.innerHTML += `<option value="${displayVal}">${displayVal}</option>`;
            }
        });
    } catch (error) {
        console.error("Error loading driver buses:", error);
    }
}

async function loadDriverList() {
    const tables = document.querySelectorAll("table");
    let tableBody = null;
    
    tables.forEach(t => {
        if (t.innerHTML.toLowerCase().includes("driver") || t.id.toLowerCase().includes("driver")) {
            tableBody = t.querySelector("tbody") || tableBody;
        }
    });

    if (!tableBody && tables.length > 1) {
        tableBody = tables[tables.length - 1].querySelector("tbody");
    }

    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Loading drivers...</td></tr>`;

    try {
        const querySnapshot = await getDocs(collection(db, "drivers"));
        let drivers = [];
        querySnapshot.forEach((docSnap) => {
            drivers.push({ id: docSnap.id, ...docSnap.data() });
        });

        tableBody.innerHTML = "";

        if (drivers.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No drivers registered yet.</td></tr>`;
            return;
        }

        drivers.forEach((driver) => {
            tableBody.innerHTML += `
                <tr>
                    <td>${driver.driverName || "N/A"}</td>
                    <td>${driver.gender || "N/A"}</td>
                    <td>${driver.phone || "N/A"}</td>
                    <td>${driver.busNumber || "N/A"}</td>
                    <td>${driver.createdAt || "N/A"}</td>
                    <td>
                        <button onclick="deleteDriver('${driver.id}')" class="delete-btn" style="padding: 5px 10px; cursor:pointer;">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error("Error loading drivers:", error);
    }
};

window.deleteDriver = async function(driverId) {
    if (!confirm("Are you sure you want to delete this driver?")) return;
    try {
        await deleteDoc(doc(db, "drivers", driverId));
        alert("Driver deleted successfully.");
        loadDriverList();
        loadSystemAnalytics();
    } catch (error) {
        console.error("Error deleting driver:", error);
        alert("Failed to delete driver.");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("staff.html")) {
        loadDriverBuses();
        loadDriverList();

        const forms = document.querySelectorAll("form");
        const driverForm = forms.length > 1 ? forms[1] : forms[0];

        if (driverForm) {
            driverForm.addEventListener("submit", async function(e) {
                e.preventDefault();

                const inputs = driverForm.querySelectorAll("input, select");
                let driverName = "";
                let gender = "Male";
                let phone = "";
                let selectedBus = "";

                inputs.forEach(input => {
                    const val = input.value.trim();
                    const placeholder = (input.placeholder || "").toLowerCase();
                    const id = (input.id || "").toLowerCase();

                    if (placeholder.includes("john") || placeholder.includes("name") || id.includes("name")) {
                        driverName = val;
                    } else if (input.tagName === "SELECT" && (id.includes("gender") || input.innerHTML.includes("Male"))) {
                        gender = val;
                    } else if (placeholder.includes("phone") || id.includes("phone")) {
                        phone = val;
                    } else if (input.tagName === "SELECT" && (id.includes("bus") || input.innerHTML.includes("Select Bus"))) {
                        selectedBus = val;
                    }
                });

                if (!driverName || !phone || !selectedBus) {
                    alert("Please fill in all required driver fields and select a bus.");
                    return;
                }

                try {
                    const driverData = {
                        driverName,
                        gender,
                        phone,
                        busNumber: selectedBus,
                        createdAt: new Date().toLocaleString()
                    };

                    await addDoc(collection(db, "drivers"), driverData);
                    alert("Driver added successfully!");
                    driverForm.reset();
                    loadDriverList();
                    loadSystemAnalytics();
                } catch (err) {
                    console.error("Error saving driver:", err);
                    alert("Failed to add driver: " + err.message);
                }
            });
        }
    }
});

// =========================================================
// TICKET GENERATION SECTION (FIRESTORE)
// =========================================================

async function loadTicketBookings() {
    const bookingSelect = document.getElementById("bookingReference") || 
                          document.getElementById("bookingIdSelect") || 
                          document.querySelector("select");
    
    if (!bookingSelect) return;

    try {
        const querySnapshot = await getDocs(collection(db, "bookings"));
        let bookings = [];
        querySnapshot.forEach(docSnap => {
            bookings.push({ id: docSnap.id, ...docSnap.data() });
        });

        bookingSelect.innerHTML = `<option value="">Select Booking Reference (ID)</option>`;
        
        if (bookings.length === 0) {
            bookingSelect.innerHTML += `<option value="" disabled>No bookings available</option>`;
            return;
        }

        bookings.forEach(booking => {
            const displayRef = booking.bookingId || booking.id;
            const passenger = booking.passengerName || "Unknown Passenger";
            bookingSelect.innerHTML += `<option value="${booking.id}">${displayRef} - ${passenger} (${booking.route || 'N/A'})</option>`;
        });

        bookingSelect.addEventListener("change", function() {
            const selectedId = this.value;
            const selectedBooking = bookings.find(b => b.id === selectedId);
            
            if (selectedBooking) {
                populateTicketPreview(selectedBooking);
            } else {
                clearTicketPreview();
            }
        });

    } catch (error) {
        console.error("Error loading ticket bookings:", error);
    }
}

function populateTicketPreview(booking) {
    setElementText("ticketBookingId", booking.bookingId || "N/A");
    setElementText("ticketReceiptNo", booking.receiptNumber || "-");
    setElementText("ticketPassengerName", booking.passengerName || "N/A");
    setElementText("ticketGender", booking.gender || "-");
    setElementText("ticketPhone", booking.passengerPhone || "N/A");
    setElementText("ticketKids", booking.kidCount || 0);
    setElementText("ticketEmail", booking.passengerEmail || "-");
    setElementText("ticketState", booking.state || "N/A");
    setElementText("ticketSponsorName", booking.sponsorName || "-");
    setElementText("ticketSponsorPhone", booking.sponsorPhone || "-");
    setElementText("ticketSponsorEmail", booking.sponsorEmail || "-");
    setElementText("ticketBus", booking.busNumber || "N/A");
    setElementText("ticketRoute", booking.route || "N/A");
    setElementText("ticketPaymentMethod", booking.paymentMethod || "-");
    setElementText("ticketPaymentStatus", booking.paymentStatus || "Pending");
    setElementText("ticketType", booking.ticketType || "-");
    setElementText("ticketSeat", booking.seatNumber || "-");
    setElementText("ticketDepartureDate", booking.departureDate || "-");
    setElementText("ticketDepartureTime", booking.departureTime || "-");
    setElementText("ticketDriver", booking.driverName || "-");
    setElementText("ticketFare", `₦${Number(booking.ticketPrice || 0).toLocaleString()}`);
    setElementText("ticketBookedDate", booking.bookingDate || "N/A");
}

function setElementText(id, text) {
    const elem = document.getElementById(id) || document.querySelector(`[data-field="${id}"]`);
    if (elem) elem.textContent = text;
}

function clearTicketPreview() {}

document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("ticket.html")) {
        loadTicketBookings();

        const printBtn = document.getElementById("printTicketBtn") || document.querySelector(".print-btn");
        if (printBtn) {
            printBtn.addEventListener("click", () => {
                window.print();
            });
        }
    }
});


// =========================================================
// OFFICIAL TICKET GENERATION & PRINTING (FIRESTORE)
// =========================================================

async function loadTicketBookingSelector() {
    const ticketSelect = document.getElementById("ticketBooking");
    if (!ticketSelect) return;

    try {
        const querySnapshot = await getDocs(collection(db, "bookings"));
        let bookings = [];
        querySnapshot.forEach(docSnap => {
            bookings.push({ id: docSnap.id, ...docSnap.data() });
        });

        ticketSelect.innerHTML = `<option value="">Select a booking reference...</option>`;

        if (bookings.length === 0) {
            ticketSelect.innerHTML += `<option value="" disabled>No bookings found in cloud</option>`;
            return;
        }

        bookings.forEach(booking => {
            const bId = booking.bookingId || booking.id;
            const pName = booking.passengerName || "Unknown";
            ticketSelect.innerHTML += `<option value="${booking.id}">${bId} - ${pName} (${booking.route || 'N/A'})</option>`;
        });

        ticketSelect.addEventListener("change", function() {
            const selectedId = this.value;
            const targetBooking = bookings.find(b => b.id === selectedId);
            if (targetBooking) {
                fillTicketCard(targetBooking);
            } else {
                clearTicketCard();
            }
        });

        if (bookings.length > 0) {
            ticketSelect.value = bookings[0].id;
            fillTicketCard(bookings[0]);
        }

    } catch (error) {
        console.error("Error loading ticket bookings:", error);
    }
}

function fillTicketCard(booking) {
    setValue("ticketBookingId", booking.bookingId || "N/A");
    setValue("ticketNumber", booking.receiptNumber || booking.bookingId || "N/A");
    setValue("ticketPassenger", booking.passengerName || "N/A");
    setValue("ticketPassengerGender", booking.gender || "N/A");
    setValue("ticketPassengerPhone", booking.passengerPhone || "N/A");
    setValue("ticketKidCount", booking.kidCount || 0);
    setValue("ticketPassengerEmail", booking.passengerEmail || "N/A");
    setValue("passengerState", booking.state || "N/A");
    setValue("ticketSponsor", booking.sponsorName || "N/A");
    setValue("ticketSponsorPhone", booking.sponsorPhone || "N/A");
    setValue("ticketSponsorEmail", booking.sponsorEmail || "N/A");
    setValue("ticketBus", booking.busNumber || "N/A");
    setValue("ticketRoute", booking.route || "N/A");
    setValue("ticketSeat", booking.seatNumber || "Standard Seat");
    setValue("passengerTicketType", booking.ticketType || "Standard");
    setValue("ticketDepartureDate", booking.departureDate || "N/A");
    setValue("ticketdepartureTime", booking.departureTime || "N/A");
    setValue("ticketDriverName", booking.driverName || "Not Assigned");
    setValue("ticketPaymentMethod", booking.paymentMethod || "Cash");
    setValue("ticketPaymentStatus", booking.paymentStatus || "Pending");
    setValue("ticketFare", `₦${Number(booking.ticketPrice || 0).toLocaleString()}`);
    setValue("ticketDate", booking.bookingDate || booking.createdAt || "N/A");
}

function clearTicketCard() {
    const ids = [
        "ticketBookingId", "ticketNumber", "ticketPassenger", "ticketPassengerGender",
        "ticketPassengerPhone", "ticketKidCount", "ticketPassengerEmail", "passengerState",
        "ticketSponsor", "ticketSponsorPhone", "ticketSponsorEmail", "ticketBus",
        "ticketRoute", "ticketSeat", "passengerTicketType", "ticketDepartureDate",
        "ticketdepartureTime", "ticketDriverName", "ticketPaymentMethod", "ticketPaymentStatus",
        "ticketFare", "ticketDate"
    ];
    ids.forEach(id => setValue(id, ""));
}

function setValue(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text;
}

window.printTicket = function() {
    window.print();
};

document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("ticket.html")) {
        loadTicketBookingSelector();

        const generateBtn = document.getElementById("generateTicket");
        if (generateBtn) {
            generateBtn.addEventListener("click", () => {
                const selectElem = document.getElementById("ticketBooking");
                if (!selectElem || !selectElem.value) {
                    alert("Please select a booking reference first.");
                    return;
                }
                window.print();
            });
        }
    }
});

window.addEventListener("afterprint", () => {
    const selectElem = document.getElementById("ticketBooking");
    if (selectElem) selectElem.value = "";
    clearTicketCard();
});

// =========================================================
// REPORTS & TERMINAL PERFORMANCE ANALYTICS (FIRESTORE)
// =========================================================

async function loadReportsData() {
    if (!window.location.pathname.includes("reports.html")) return;

    try {
        const [bookingsSnap, busesSnap, schedulesSnap, staffSnap, driversSnap, routesSnap] = await Promise.all([
            getDocs(collection(db, "bookings")),
            getDocs(collection(db, "buses")),
            getDocs(collection(db, "schedules")),
            getDocs(collection(db, "staffs")),
            getDocs(collection(db, "drivers")),
            getDocs(collection(db, "routes"))
        ]);

        let bookings = [];
        bookingsSnap.forEach(doc => bookings.push(doc.data()));
        let activeBookings = bookings.filter(b => b.bookingStatus !== "Cancelled" && b.bookingStatus !== "Expired");
        let paidBookings = bookings.filter(b => b.paymentStatus === "Paid");
        let pendingBookings = bookings.filter(b => b.paymentStatus === "Pending");
        let cancelledBookings = bookings.filter(b => b.bookingStatus === "Cancelled");
        let expiredBookings = bookings.filter(b => b.bookingStatus === "Expired");
        let totalRevenue = paidBookings.reduce((sum, b) => sum + Number(b.ticketPrice || 0), 0);

        let schedules = [];
        schedulesSnap.forEach(doc => schedules.push(doc.data()));
        let scheduledCount = schedules.filter(s => (s.status || "").toLowerCase() === "scheduled").length;
        let boardingCount = schedules.filter(s => (s.status || "").toLowerCase() === "boarding").length;
        let delayedCount = schedules.filter(s => (s.status || "").toLowerCase() === "delayed").length;
        let departedCount = schedules.filter(s => (s.status || "").toLowerCase() === "departed" || (s.status || "").toLowerCase() === "arrived").length;
        let cancelledSchedCount = schedules.filter(s => (s.status || "").toLowerCase() === "cancelled").length;

        let staffList = [];
        staffSnap.forEach(doc => staffList.push(doc.data()));

        let driversList = [];
        driversSnap.forEach(doc => driversList.push(doc.data()));

        let cashiers = staffList.filter(s => (s.role || "").toLowerCase().includes("cashier")).length;
        let terminalOfficers = staffList.filter(s => (s.role || "").toLowerCase().includes("officer")).length;
        let managers = staffList.filter(s => (s.role || "").toLowerCase().includes("manager")).length;
        let security = staffList.filter(s => (s.role || "").toLowerCase().includes("security")).length;
        
        let maleCount = [...staffList, ...driversList].filter(s => (s.gender || "").toLowerCase() === "male").length;
        let femaleCount = [...staffList, ...driversList].filter(s => (s.gender || "").toLowerCase() === "female").length;

        let totalCombinedStaff = staffList.length + driversList.length;

        setRepVal("reportBuses", busesSnap.size);
        setRepVal("reportRoutes", routesSnap.size);
        setRepVal("reportSchedules", schedulesSnap.size);
        setRepVal("reportBookings", activeBookings.length);

        setRepVal("reportScheduled", scheduledCount);
        setRepVal("reportBoarding", boardingCount);
        setRepVal("reportDelayed", delayedCount);
        setRepVal("reportDeparted", departedCount);
        setRepVal("reportCancelled", cancelledSchedCount);

        setRepVal("reportStaff", totalCombinedStaff);
        setRepVal("reportDrivers", driversList.length);
        setRepVal("reportCashier", cashiers);
        setRepVal("reportTerminal", terminalOfficers);
        setRepVal("reportManagers", managers);
        setRepVal("reportSecurity", security);
        setRepVal("reportMale", maleCount);
        setRepVal("reportFemale", femaleCount);

        setRepVal("reportRevenue", `₦${totalRevenue.toLocaleString()}`);
        setRepVal("reportPaid", paidBookings.length);
        setRepVal("reportPending", pendingBookings.length);
        setRepVal("reportCancelledBooking", cancelledBookings.length);

        setRepVal("busSummary", busesSnap.size);
        setRepVal("routeSummary", routesSnap.size);
        setRepVal("scheduleSummary", scheduledCount);
        setRepVal("boardingScheduleSummary", boardingCount);
        setRepVal("delayedScheduleSummary", delayedCount);
        setRepVal("departedScheduleSummary", departedCount);
        setRepVal("cancelledScheduleSummary", cancelledSchedCount);
        setRepVal("bookingSummary", activeBookings.length);
        setRepVal("bookingPaidSummary", paidBookings.length);
        setRepVal("bookingPendingSummary", pendingBookings.length);
        setRepVal("cancelledBookingSummary", cancelledBookings.length);
        setRepVal("expiredBookingSummary", expiredBookings.length);
        setRepVal("passengerSummary", activeBookings.length);
        setRepVal("staffSummary", totalCombinedStaff);

    } catch (error) {
        console.error("Error loading reports data:", error);
    }
}

function setRepVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

window.printReport = function() {
    window.print();
};

window.exportReportToExcel = function() {
    const element = document.getElementById("reportContainer");
    if (!element) return;
    
    const wb = XLSX.utils.book_new();
    const table = document.querySelector("#reportContainer table");
    if (table) {
        const ws = XLSX.utils.table_to_sheet(table);
        XLSX.utils.book_append_sheet(wb, ws, "System Summary");
        XLSX.writeFile(wb, "ATC_Terminal_Performance_Report.xlsx");
    } else {
        alert("Report exported successfully!");
    }
};

document.addEventListener("DOMContentLoaded", () => {
    loadReportsData();
});

// =========================================================
// REAL-TIME DASHBOARD ANALYTICS & TABLES (FIRESTORE)
// =========================================================

async function initDashboard() {
    if (!window.location.pathname.includes("dashboard.html")) return;

    try {
        const [bookingsSnap, busesSnap, schedulesSnap, staffSnap, driversSnap, routesSnap] = await Promise.all([
            getDocs(collection(db, "bookings")),
            getDocs(collection(db, "buses")),
            getDocs(collection(db, "schedules")),
            getDocs(collection(db, "staffs")),
            getDocs(collection(db, "drivers")),
            getDocs(collection(db, "routes"))
        ]);

        let bookings = [];
        bookingsSnap.forEach(docSnap => bookings.push(docSnap.data()));
        let activeBookings = bookings.filter(b => b.bookingStatus !== "Cancelled" && b.bookingStatus !== "Expired");
        let paidBookings = bookings.filter(b => b.paymentStatus === "Paid");
        let totalRevenue = paidBookings.reduce((sum, b) => sum + Number(b.ticketPrice || 0), 0);

        let staffList = [];
        staffSnap.forEach(doc => staffList.push(doc.data()));

        let driversList = [];
        driversSnap.forEach(doc => driversList.push(doc.data()));

        let totalStaffCount = staffList.length + driversList.length;

        setDashboardVal("totalBuses", busesSnap.size);
        setDashboardVal("totalRoutes", routesSnap.size);
        setDashboardVal("totalSchedules", schedulesSnap.size);
        setDashboardVal("totalBookings", activeBookings.length);
        setDashboardVal("totalRevenue", `₦${totalRevenue.toLocaleString()}`);
        setDashboardVal("totalStaff", totalStaffCount);
        setDashboardVal("totalDrivers", driversList.length);
        setDashboardVal("totalTerminalStaff", staffList.length);

        setDashboardVal("todayBookings", activeBookings.length);
        const avgFare = activeBookings.length > 0 ? Math.round(totalRevenue / activeBookings.length) : 0;
        setDashboardVal("averageFare", `₦${avgFare.toLocaleString()}`);

        const todayBody = document.getElementById("todayDeparturesBody");
        if (todayBody) {
            todayBody.innerHTML = "";
            let schedules = [];
            schedulesSnap.forEach(doc => schedules.push(doc.data()));
            
            if (schedules.length === 0) {
                todayBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No departures found</td></tr>`;
            } else {
                schedules.slice(0, 5).forEach(s => {
                    todayBody.innerHTML += `
                        <tr>
                            <td>${s.busNumber || 'N/A'}</td>
                            <td>${s.route || 'N/A'}</td>
                            <td>${s.departureTime || 'N/A'}</td>
                            <td><span class="badge status-${(s.status || 'Scheduled').toLowerCase()}">${s.status || 'Scheduled'}</span></td>
                        </tr>`;
                });
            }
        }

        const recentBody = document.getElementById("recentActivities");
        if (recentBody) {
            recentBody.innerHTML = "";
            activeBookings.slice(0, 5).forEach(b => {
                recentBody.innerHTML += `
                    <tr>
                        <td>New booking by ${b.passengerName || 'Passenger'}</td>
                        <td>Today</td>
                    </tr>`;
            });
        }

        const lastUpdated = document.getElementById("dashboardLastUpdated");
        if (lastUpdated) {
            lastUpdated.textContent = `Last Updated: ${new Date().toLocaleTimeString()}`;
        }

    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
}

function setDashboardVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}


// =========================================================
// CHART.JS DASHBOARD VISUALIZATIONS (FIRESTORE)
// =========================================================

async function renderDashboardCharts() {
    if (!window.location.pathname.includes("dashboard.html")) return;

    try {
        const [bookingsSnap, busesSnap, schedulesSnap, routesSnap, staffSnap, driversSnap] = await Promise.all([
            getDocs(collection(db, "bookings")),
            getDocs(collection(db, "buses")),
            getDocs(collection(db, "schedules")),
            getDocs(collection(db, "routes")),
            getDocs(collection(db, "staffs")),
            getDocs(collection(db, "drivers"))
        ]);

        let bookings = [];
        bookingsSnap.forEach(doc => bookings.push(doc.data()));
        let schedules = [];
        schedulesSnap.forEach(doc => schedules.push(doc.data()));
        let buses = [];
        busesSnap.forEach(doc => buses.push(doc.data()));
        let staff = [];
        staffSnap.forEach(doc => staff.push(doc.data()));
        let drivers = [];
        driversSnap.forEach(doc => drivers.push(doc.data()));

        const schedCtx = document.getElementById("scheduleStatusChart");
        if (schedCtx) {
            new Chart(schedCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Scheduled', 'Boarding', 'Delayed', 'Departed'],
                    datasets: [{
                        data: [
                            schedules.filter(s => (s.status || "").toLowerCase() === "scheduled").length,
                            schedules.filter(s => (s.status || "").toLowerCase() === "boarding").length,
                            schedules.filter(s => (s.status || "").toLowerCase() === "delayed").length,
                            schedules.filter(s => (s.status || "").toLowerCase() === "departed").length
                        ],
                        backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444', '#10b981']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const bookingCtx = document.getElementById("bookingStatusChart");
        if (bookingCtx) {
            new Chart(bookingCtx, {
                type: 'bar',
                data: {
                    labels: ['Paid', 'Pending', 'Cancelled'],
                    datasets: [{
                        label: 'Bookings',
                        data: [
                            bookings.filter(b => (b.paymentStatus || "").toLowerCase() === "paid").length,
                            bookings.filter(b => (b.paymentStatus || "").toLowerCase() === "pending").length,
                            bookings.filter(b => (b.bookingStatus || "").toLowerCase() === "cancelled").length
                        ],
                        backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const genderCtx = document.getElementById("genderChart");
        if (genderCtx) {
            new Chart(genderCtx, {
                type: 'pie',
                data: {
                    labels: ['Male', 'Female'],
                    datasets: [{
                        data: [
                            [...staff, ...drivers].filter(s => (s.gender || "").toLowerCase() === "male").length,
                            [...staff, ...drivers].filter(s => (s.gender || "").toLowerCase() === "female").length
                        ],
                        backgroundColor: ['#3b82f6', '#ec4899']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const busCtx = document.getElementById("busStatisticsChart");
        if (busCtx) {
            let smallBuses = buses.filter(b => (b.busType || b.type || "").toLowerCase().includes("small")).length;
            let largeBuses = buses.filter(b => (b.busType || b.type || "").toLowerCase().includes("large") || (b.busType || b.type || "").toLowerCase().includes("luxury")).length;
            if (smallBuses === 0 && largeBuses === 0) smallBuses = buses.length;

            new Chart(busCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Small / Coaster', 'Large / Luxury'],
                    datasets: [{
                        data: [smallBuses, largeBuses],
                        backgroundColor: ['#6366f1', '#14b8a6']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const revenueCtx = document.getElementById("revenueTrendChart");
        if (revenueCtx) {
            new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                    datasets: [{
                        label: 'Revenue (₦)',
                        data: [0, 0, 0, bookings.reduce((sum, b) => sum + Number(b.ticketPrice || 0), 0)],
                        borderColor: '#10b981',
                        tension: 0.3
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const routesCtx = document.getElementById("topRoutesChart");
        if (routesCtx) {
            new Chart(routesCtx, {
                type: 'bar',
                data: {
                    labels: ['Route 1', 'Route 2', 'Route 3'],
                    datasets: [{
                        label: 'Bookings',
                        data: [bookings.length, 0, 0],
                        backgroundColor: '#f59e0b'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

    } catch (error) {
        console.error("Error rendering dashboard charts:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initDashboard();
    renderDashboardCharts();
});