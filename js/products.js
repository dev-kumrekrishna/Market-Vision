import { getProducts, productCard, esc, DEFAULT_CATEGORIES } from "./app.js"; // <--- Import Default
import { db, auth } from "./config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("productGrid");
  const search = document.getElementById("search");
  const categories = document.getElementById("categories");
  const empty = document.getElementById("empty");
  
  // Accept direct category link from index.html (e.g. ?cat=Clothes)
  const urlParams = new URLSearchParams(window.location.search);
  let active = urlParams.get('cat') || "All"; 
  
  let allProducts = [];
  let userWishlist = [];

  function render() {
    const q = (search?.value || "").toLowerCase().trim();
    const filtered = allProducts.filter(product => {
      const matchesCategory = active === "All" || product.category === active;
      const searchable = `${product.name} ${product.description || ""} ${product.category || ""}`.toLowerCase();
      return matchesCategory && searchable.includes(q);
    });
    
    grid.innerHTML = filtered.map(p => productCard(p, userWishlist.includes(p.id))).join("");
    empty.hidden = filtered.length > 0;
  }

  function renderCategories() {
    // Combine Default Categories with any Custom categories in DB
    const usedCategories = allProducts.map(p => p.category).filter(Boolean);
    const uniqueCategories = [...new Set([...DEFAULT_CATEGORIES, ...usedCategories])];
    
    const categoryList = ["All", ...uniqueCategories];
    
    // Fallback if URL parameter is something completely new
    if(active !== "All" && !categoryList.includes(active)) {
        categoryList.push(active);
    }
    
    categories.innerHTML = categoryList.map(category => `
      <button class="chip ${category === active ? "active" : ""}" data-cat="${esc(category)}">
        ${esc(category)}
      </button>
    `).join("");
  }

  categories.addEventListener("click", event => {
    const button = event.target.closest(".chip");
    if (!button) return;
    active = button.dataset.cat;
    
    categories.querySelectorAll(".chip").forEach(chip => {
      chip.classList.toggle("active", chip.dataset.cat === active);
    });
    render();
  });

  search?.addEventListener("input", render);
  grid.innerHTML = `<p class="muted">Loading products...</p>`;

  onAuthStateChanged(auth, async user => {
      if(user) {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          if(userSnap.exists() && userSnap.data().wishlist) {
              userWishlist = userSnap.data().wishlist;
          }
      }
      
      allProducts = await getProducts();
      renderCategories();
      render();
  });
});