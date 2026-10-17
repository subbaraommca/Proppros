// Apply the saved theme before first paint (no flash). Dark-first: Basalt unless Limestone was chosen.
try {
  document.documentElement.dataset.theme = localStorage.getItem("pp-theme") === "light" ? "light" : "dark";
} catch (e) {
  document.documentElement.dataset.theme = "dark";
}
