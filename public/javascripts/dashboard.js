// Dashboard JavaScript

// Track in-flight fetches so empty tables can say "no data" only after loading has finished
// (an empty <tbody> during loading looks the same as an empty result). The layout loads
// this file after the page scripts, so their first requests may already be running; the
// "loading" flag starts on and is cleared by the first idle check below.
(function trackFetchActivity() {
  if (!window.fetch || window.fetch.__tracked) return;
  const originalFetch = window.fetch.bind(window);
  let pending = 0;
  const markIdle = () => {
    if (pending === 0) document.documentElement.removeAttribute("data-loading");
  };
  const tracked = (...args) => {
    pending += 1;
    document.documentElement.setAttribute("data-loading", "");
    return originalFetch(...args).finally(() => {
      pending -= 1;
      // Let the page render the response before deciding the table is empty
      setTimeout(markIdle, 50);
    });
  };
  tracked.__tracked = true;
  window.fetch = tracked;
  document.documentElement.setAttribute("data-loading", "");
  window.addEventListener("load", () => setTimeout(markIdle, 300));
})();

document.addEventListener("DOMContentLoaded", function () {
  // Set active navigation based on current page
  setActiveNavigation();
  setupSidebarDrawer();
  setupStackedTables();
  setupBrokenImageFallback();

  // Initialize tooltips if Bootstrap is available
  if (typeof bootstrap !== "undefined") {
    var tooltipTriggerList = [].slice.call(
      document.querySelectorAll('[data-bs-toggle="tooltip"]')
    );
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }

  // Initialize popovers
  var popoverTriggerList = [].slice.call(
    document.querySelectorAll('[data-bs-toggle="popover"]')
  );
  var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl);
  });
});

// Routes whose path does not start with their menu item's href
const NAV_ALIASES = [
  [/^\/dashboard\/(addcategories|editcategories)(\/|$)/, "/dashboard/categories"],
  [/^\/dashboard\/(addroom|editroom)(\/|$)/, "/dashboard/room"],
  [/^\/dashboard\/notifications\//, "/dashboard/typeNotify"],
];

// Last path segment -> what the page does, for the breadcrumb and the tab title
function pageAction(path) {
  if (/\/(add|add[a-z]+)(\/|$)/i.test(path)) return "Thêm mới";
  if (/\/(edit|edit[a-z]+)(\/|$)/i.test(path)) return "Chỉnh sửa";
  if (/\/invoice\//.test(path)) return "Hóa đơn";
  if (/\/(view|detail)\//.test(path) || /^\/dashboard\/contact-forms-design\/.+/.test(path)) return "Chi tiết";
  return "";
}

// Highlight the menu item for the current page, then build the breadcrumb from it
function setActiveNavigation() {
  const currentPath = window.location.pathname.replace(/\/$/, "") || "/dashboard";
  const alias = NAV_ALIASES.find(([pattern]) => pattern.test(currentPath));
  const matchPath = alias ? alias[1] : currentPath;
  let activeLink = null;

  document.querySelectorAll(".nav-item a").forEach((link) => {
    const href = link.getAttribute("href");
    const isActive =
      matchPath === href || (href !== "/dashboard" && matchPath.startsWith(href + "/"));
    link.parentElement.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
      activeLink = link;
    } else {
      link.removeAttribute("aria-current");
    }
  });

  const crumb = document.getElementById("page-crumb");
  if (!crumb || !activeLink) return;
  const section = activeLink.closest(".menu-section").querySelector(".menu-section-title").textContent.trim();
  const page = activeLink.querySelector("span").textContent.trim();
  const action = pageAction(currentPath);
  // "Sản phẩm / Sản phẩm" says nothing twice; drop the group when it matches the page
  const parts = [section === page ? "" : section, page, action].filter(Boolean);
  crumb.replaceChildren(
    ...parts.map((text, index) => {
      const isLast = index === parts.length - 1;
      if (isLast) {
        const current = document.createElement("span");
        current.className = "page-crumb__current";
        current.textContent = text;
        return current;
      }
      if (text === page) {
        const link = document.createElement("a");
        link.href = activeLink.getAttribute("href");
        link.textContent = text;
        return link;
      }
      const span = document.createElement("span");
      span.textContent = text;
      return span;
    })
  );
  document.title = `${action ? `${action} - ` : ""}${page} - SONA Admin`;
}

// Below 992px the sidebar is a drawer opened from the header button
function setupSidebarDrawer() {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("sidebar-toggle");
  const closeButton = document.getElementById("sidebar-close");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (!sidebar || !toggle) return;

  const setOpen = (open) => {
    document.body.classList.toggle("sidebar-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    backdrop.hidden = !open;
    if (open) closeButton.focus();
  };
  toggle.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => {
    setOpen(false);
    toggle.focus();
  });
  backdrop.addEventListener("click", () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
}

// On phones the list tables stack into one card per row (CSS in _adminKit.scss). Each cell
// carries its column title in data-label; rows are re-rendered by the page scripts, so the
// labels are refreshed whenever a table body changes.
const STACKED_TABLES =
  ".category-table, .room-table, .products-table, .product-table, .contact-form-table, .news-table, .orders-table";

function labelTableCells(table) {
  // Column headers may hold filter menus; only the header's own title is a label
  const titles = Array.from(table.querySelectorAll("thead th")).map((th) => {
    const copy = th.cloneNode(true);
    copy.querySelectorAll(".filter-dropdown, .dropdown-menu, ul, select").forEach((node) => node.remove());
    return copy.textContent.replace(/\s+/g, " ").trim();
  });
  table.querySelectorAll("tbody tr").forEach((row) => {
    Array.from(row.children).forEach((cell, index) => {
      const title = titles[index] || "";
      if (cell.dataset.label !== title) cell.dataset.label = title;
    });
  });
}

function setupStackedTables() {
  document.querySelectorAll(STACKED_TABLES).forEach((element) => {
    // Some pages put the class on a wrapper (orders) rather than on the <table> itself
    const table = element.tagName === "TABLE" ? element : element.querySelector("table");
    if (!table) return;
    labelTableCells(table);
    const body = table.tBodies[0];
    if (!body) return;
    new MutationObserver(() => labelTableCells(table)).observe(body, { childList: true, subtree: true });
  });
}

// Some stored image URLs no longer resolve (Cloudinary 404). Hide the broken-image glyph and its
// alt text so the cell shows a neutral tile instead of overlapping text.
function setupBrokenImageFallback() {
  document.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (image.tagName === "IMG" && image.closest(".content-container")) {
        image.classList.add("is-broken");
      }
    },
    true
  );
}

// Handle data table sorting
function sortTable(tableId, columnIndex) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));

  // Get the current sort direction
  const th = table.querySelectorAll("th")[columnIndex];
  const currentDir = th.getAttribute("data-sort") === "asc" ? "desc" : "asc";

  // Update all headers to remove sort indicators
  table.querySelectorAll("th").forEach((header) => {
    header.setAttribute("data-sort", "");
    header.querySelector("i.sort-indicator")?.remove();
  });

  // Update current header with sort direction and indicator
  th.setAttribute("data-sort", currentDir);

  const icon = document.createElement("i");
  icon.className =
    currentDir === "asc"
      ? "fas fa-sort-up sort-indicator ms-1"
      : "fas fa-sort-down sort-indicator ms-1";
  th.appendChild(icon);

  // Sort the rows
  rows.sort((a, b) => {
    const aValue = a.cells[columnIndex].textContent.trim();
    const bValue = b.cells[columnIndex].textContent.trim();

    // Check if values are numbers
    const aNum = parseFloat(aValue.replace(/[^\d.-]/g, ""));
    const bNum = parseFloat(bValue.replace(/[^\d.-]/g, ""));

    if (!isNaN(aNum) && !isNaN(bNum)) {
      return currentDir === "asc" ? aNum - bNum : bNum - aNum;
    }

    // Otherwise sort as strings
    return currentDir === "asc"
      ? aValue.localeCompare(bValue)
      : bValue.localeCompare(aValue);
  });

  // Reattach sorted rows to the table
  rows.forEach((row) => tbody.appendChild(row));
}

// Function to confirm delete actions
function confirmDelete(itemType, itemId) {
  return confirm(
    `Are you sure you want to delete this ${itemType}? This action cannot be undone.`
  );
}

// Function to show toast notifications
function showToast(message, type = "success") {
  const toastContainer = document.getElementById("toastContainer");
  if (!toastContainer) {
    // Create toast container if it doesn't exist
    const container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "position-fixed top-0 end-0 p-3";
    container.style.zIndex = "1050";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-white bg-${type} border-0`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");
  toast.setAttribute("aria-atomic", "true");

  toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
        </div>
    `;

  document.getElementById("toastContainer").appendChild(toast);

  const bsToast = new bootstrap.Toast(toast, {
    delay: 5000,
  });

  bsToast.show();

  // Remove the toast after it's hidden
  toast.addEventListener("hidden.bs.toast", function () {
    toast.remove();
  });
}
