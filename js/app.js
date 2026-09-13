import { db, auth } from "./config.js";
import { collection, getDocs, query, orderBy, limit, doc, getDoc, addDoc, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const DEFAULT_PHONE = "917804888497";
let currentUser = null;

// Cart System State
let cart = JSON.parse(localStorage.getItem('mv_cart')) || [];

export const DEFAULT_CATEGORIES = [
    "Clothes", "Stationery", "Phones", "Electronics", "Beauty", "Accessories", "Groceries"
];

export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

// ---------------------------------------------
// CART LOGIC
// ---------------------------------------------
function saveCart() {
    localStorage.setItem('mv_cart', JSON.stringify(cart));
    updateCartBadge();
}

function updateCartBadge() {
    const badges = document.querySelectorAll('.cart-badge');
    const total = cart.reduce((sum, item) => sum + item.quantity, 0);
    badges.forEach(b => {
        b.innerText = total;
    });
}

window.addToCart = function(productStr, event) {
  if (event) event.stopPropagation(); 
  
  let p;
  try {
      p = JSON.parse(decodeURIComponent(productStr));
  } catch(e) {
      console.error("Cart error: invalid product data.");
      return;
  }

  const existing = cart.find(item => item.id === p.id);
  if (existing) {
      existing.quantity += 1;
  } else {
      cart.push({ ...p, quantity: 1 });
  }
  
  saveCart();
  window.openCartModal();
}

window.openCartModal = function(e) {
    if(e) e.preventDefault();
    let cartSidebar = document.getElementById('cartSidebar');
    
    if (!cartSidebar) {
        cartSidebar = document.createElement('div');
        cartSidebar.id = 'cartSidebar';
        cartSidebar.className = 'cart-sidebar';
        document.body.appendChild(cartSidebar);

        const overlay = document.createElement('div');
        overlay.id = 'cartOverlay';
        overlay.className = 'cart-overlay';
        overlay.onclick = window.closeCartModal;
        document.body.appendChild(overlay);
    }

    window.renderCartItems();
    document.getElementById('cartSidebar').classList.add('open');
    document.getElementById('cartOverlay').classList.add('open');
};

window.closeCartModal = function() {
    document.getElementById('cartSidebar').classList.remove('open');
    document.getElementById('cartOverlay').classList.remove('open');
};

window.renderCartItems = function() {
    const cartSidebar = document.getElementById('cartSidebar');
    if(!cartSidebar) return;

    let totalAmt = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
    let totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

    let html = `
        <div class="cart-header">
            <h2>Your Cart (${totalItems})</h2>
            <button class="close-cart" onclick="closeCartModal()">&times;</button>
        </div>
        <div class="cart-body">
    `;

    if (cart.length === 0) {
        html += `<div class="empty-cart"><i class="fas fa-shopping-basket" style="font-size: 40px; color:#ccd8e6; margin-bottom:15px; display:block;"></i>Your cart is currently empty.</div>`;
    } else {
        cart.forEach((item, index) => {
            const isVideo = item.image && item.image.match(/\.(mp4|webm|ogg)$/i);
            const mediaHtml = isVideo 
                ? `<video class="cart-media" src="${esc(item.image)}" muted></video>` 
                : `<img class="cart-media" src="${item.image ? esc(item.image) : 'assets/logo/logo.png'}" alt="Item">`;

            html += `
                <div class="cart-item">
                    ${mediaHtml}
                    <div class="cart-item-info">
                        <h4>${esc(item.name)}</h4>
                        <div class="cart-price">₹${Number(item.price).toLocaleString("en-IN")}</div>
                        <div class="qty-controls">
                            <button onclick="updateCartQty(${index}, -1)">-</button>
                            <span>${item.quantity}</span>
                            <button onclick="updateCartQty(${index}, 1)">+</button>
                        </div>
                    </div>
                    <button class="remove-item" onclick="removeFromCart(${index})"><i class="fas fa-trash"></i></button>
                </div>
            `;
        });
    }

    html += `</div>
        <div class="cart-footer">
            <div class="cart-total">
                <span>Total:</span>
                <span>₹${totalAmt.toLocaleString("en-IN")}</span>
            </div>
            <button class="btn primary full" ${cart.length === 0 ? 'disabled' : ''} onclick="checkoutCart()">
                <i class="fab fa-whatsapp" style="margin-right:8px; font-size:16px;"></i> Send Order
            </button>
        </div>
    `;

    cartSidebar.innerHTML = html;
};

window.updateCartQty = function(index, delta) {
    cart[index].quantity += delta;
    if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
    }
    saveCart();
    window.renderCartItems();
};

window.removeFromCart = function(index) {
    cart.splice(index, 1);
    saveCart();
    window.renderCartItems();
};

window.checkoutCart = function() {
    if(cart.length === 0) return;
    let activePhone = globalSettings.phone || DEFAULT_PHONE;
    
    let text = "🛍️ *New Order from Market Vision*\n\n";
    let total = 0;
    
    cart.forEach((item, i) => {
        let lineTotal = Number(item.price) * item.quantity;
        total += lineTotal;
        text += `${i+1}. *${item.name}*\n   ${item.quantity} x ₹${item.price} = ₹${lineTotal}\n\n`;
    });
    
    text += `*Total Amount: ₹${total.toLocaleString("en-IN")}*\n\nPlease let me know the payment and delivery details.`;
    window.open(`https://wa.me/${activePhone}?text=${encodeURIComponent(text)}`, '_blank');
};


// ---------------------------------------------
// ORIGINAL LOGIC
// ---------------------------------------------

window.buyNow = function(productStr, event) {
    if (event) event.stopPropagation();
    const p = JSON.parse(decodeURIComponent(productStr));
    let activePhone = globalSettings.phone || DEFAULT_PHONE;
    const text = `Hi Market Vision, I want to order this product instantly:\n\n*${p.name}*\nPrice: ₹${p.price}\nCategory: ${p.category || 'General'}\n\nPlease let me know the payment and delivery details.`;
    window.open(`https://wa.me/${activePhone}?text=${encodeURIComponent(text)}`, '_blank');
}

window.toggleWishlist = async function(productId, btnElement, event) {
  if (event) event.stopPropagation();
  if (!currentUser) {
    alert("Please log in to save items to your wishlist.");
    return;
  }
  const isWished = btnElement.classList.contains("active-heart");
  try {
      const userRef = doc(db, "users", currentUser.uid);
      const userSnap = await getDoc(userRef);
      let wishlist = [];
      if(userSnap.exists() && userSnap.data().wishlist) {
          wishlist = userSnap.data().wishlist;
      }
      if (isWished) {
          btnElement.classList.remove("active-heart");
          btnElement.innerHTML = '<i class="far fa-heart"></i>';
          wishlist = wishlist.filter(id => id !== productId);
      } else {
          btnElement.classList.add("active-heart");
          btnElement.innerHTML = '<i class="fas fa-heart"></i>';
          if(!wishlist.includes(productId)) wishlist.push(productId);
      }
      await setDoc(userRef, { wishlist: wishlist }, { merge: true });
      if(window.location.pathname.includes('profile.html') && typeof loadWishlist === 'function') {
          loadWishlist();
      }
  } catch(e) {
      console.error("Error updating wishlist", e);
  }
}

window.shareProduct = function(productName, event) {
  if (event) event.stopPropagation();
  if (navigator.share) {
    navigator.share({
      title: 'Check out ' + productName + ' on Market Vision',
      text: 'Found this great product!',
      url: window.location.href,
    });
  } else {
    alert("Share link copied to clipboard!");
  }
}

export function productCard(p, isWished = false) {
  const rating = (Math.random() * (5 - 3.5) + 3.5).toFixed(1);
  const reviews = Math.floor(Math.random() * 150) + 5;
  
  // FIX: Properly encode product string to prevent single quote crashes
  const productDataStr = encodeURIComponent(JSON.stringify(p)).replace(/'/g, "%27");
  
  const heartClass = isWished ? "active-heart" : "";
  const heartIcon = isWished ? "fas" : "far";
  
  const isVideo = p.image && p.image.match(/\.(mp4|webm|ogg)$/i);
  const mediaHtml = p.image 
    ? (isVideo ? `<video src="${esc(p.image)}" muted loop onmouseover="this.play()" onmouseout="this.pause()"></video>` : `<img src="${esc(p.image)}" alt="${esc(p.name)}">`) 
    : `<span class="placeholder">MV</span>`;

  return `
    <article class="product-card" onclick="openProductModal('${productDataStr}')">
      <div class="product-card-actions">
         <button class="action-btn ${heartClass}" onclick="toggleWishlist('${p.id}', this, event)" title="Add to Wishlist"><i class="${heartIcon} fa-heart"></i></button>
         <button class="action-btn" onclick="shareProduct('${esc(p.name)}', event)" title="Share"><i class="fas fa-share-alt"></i></button>
      </div>
      <div class="image">
        ${mediaHtml}
      </div>
      <div class="product-info">
        <span class="category">${esc(p.category || "General")}</span>
        <h3 class="product-name">${esc(p.name)}</h3>
        <div class="rating-snippet">
            ${rating} <i class="fas fa-star"></i> <span>(${reviews})</span>
        </div>
        <p>${esc(p.description || "")}</p>
        <div class="price">₹${Number(p.price || 0).toLocaleString("en-IN")}</div>
        <div style="display:flex; gap:10px; margin-top: 10px;">
            <button class="btn secondary full" onclick="addToCart('${productDataStr}', event)">Add to Cart</button>
            <button class="btn primary full" onclick="buyNow('${productDataStr}', event)">Order Now</button>
        </div>
      </div>
    </article>
  `;
}

export async function getProducts(limitCount = null) {
  try {
    let productsQuery = query(collection(db, "products"), orderBy("createdAt", "desc"));
    if (limitCount) {
      productsQuery = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(limitCount));
    }
    const snapshot = await getDocs(productsQuery);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error fetching products:", error);
    return [];
  }
}

function getInitials(name) {
  if(!name || name.trim() === "") return "U";
  const parts = name.trim().split(" ");
  if(parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}

window.openProductModal = function(productStr) {
    const p = JSON.parse(decodeURIComponent(productStr));
    window.location.href = `product-details.html?id=${p.id}`;
}

let globalSettings = { phone: DEFAULT_PHONE, instagram: "@kumre_krishna_11" };

async function loadSiteSettings() {
    try {
        const settingsSnap = await getDoc(doc(db, "settings", "general"));
        if (settingsSnap.exists()) {
            const d = settingsSnap.data();
            if(d.phone) globalSettings.phone = d.phone;
            if(d.instagram) globalSettings.instagram = d.instagram;
        }
    } catch (e) { }
    const footerRows = document.querySelectorAll('.footer-row');
    footerRows.forEach(row => {
        if(!row.innerHTML.includes('insta-link')) {
            const div = document.createElement('div');
            div.innerHTML = `
                <a href="https://instagram.com/${globalSettings.instagram.replace('@', '')}" target="_blank" class="insta-link" style="color:#1565c0; font-weight:bold; display:flex; align-items:center; gap:5px;">
                    <i class="fab fa-instagram"></i> Follow ${globalSettings.instagram}
                </a>
            `;
            row.appendChild(div);
        }
    });
    const whatsappLink = document.getElementById("whatsappLink");
    if (whatsappLink) whatsappLink.href = `https://wa.me/${globalSettings.phone}?text=${encodeURIComponent("Hi Market Vision, I have an enquiry.")}`;
    const callLink = document.getElementById("callLink");
    if (callLink) callLink.href = `tel:+${globalSettings.phone}`;
}

async function initApp() {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  const menuToggle = document.getElementById("menuToggle");
  const mobileMenu = document.getElementById("mobileMenu");

  menuToggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    mobileMenu?.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (mobileMenu && mobileMenu.classList.contains("open")) {
      if (!menuToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
        mobileMenu.classList.remove("open");
      }
    }
  });
  
  // Link Cart Buttons
  const cartIcons = document.querySelectorAll('.cart-icon');
  cartIcons.forEach(icon => icon.addEventListener('click', window.openCartModal));
  updateCartBadge();

  await loadSiteSettings();

  const authMenuLinks = document.getElementById("authMenuLinks");
  const menuProfileContainer = document.getElementById("menuProfileContainer");

  onAuthStateChanged(auth, async user => {
    currentUser = user;
    let userWishlist = [];
    if (user) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      let userData = { role: "customer", name: user.email };
      if (userDoc.exists()) {
          userData = userDoc.data();
          if(userData.wishlist) userWishlist = userData.wishlist;
      }
      const role = userData.role;

      if (menuProfileContainer) {
        let pfpHtml = userData.pfp ? `<img src="${esc(userData.pfp)}" alt="PFP">` : getInitials(userData.name);
        menuProfileContainer.innerHTML = `
          <div class="menu-profile-section">
            <div class="pfp-circle">${pfpHtml}</div>
            <div class="menu-profile-info">
              <span class="menu-profile-name">${esc(userData.name || "Customer")}</span>
              <span class="menu-profile-role">${role} Account</span>
            </div>
          </div>
        `;
        menuProfileContainer.style.display = "block";
      }

      if (authMenuLinks) {
        let linksHtml = "";
        if (role === "admin") {
           linksHtml += `<a href="dashboard.html"><i class="fas fa-chart-line" style="margin-right:8px;"></i> Admin Dashboard</a>`;
        }
        linksHtml += `
          <a href="profile.html"><i class="fas fa-user-circle" style="margin-right:8px;"></i> My Profile</a>
          <a href="#" id="navLogout" style="color: #d93025;"><i class="fas fa-sign-out-alt" style="margin-right:8px;"></i> Logout</a>
        `;
        authMenuLinks.innerHTML = linksHtml;
      }
      
      document.getElementById("navLogout")?.addEventListener("click", (e) => {
          e.preventDefault();
          signOut(auth).then(() => window.location.reload());
      });
    } else {
      if (menuProfileContainer) menuProfileContainer.style.display = "none";
      if (authMenuLinks) authMenuLinks.innerHTML = `<a href="login.html"><i class="fas fa-sign-in-alt" style="margin-right:8px;"></i> Login / Sign Up</a>`;
    }

    const featured = document.getElementById("featuredProducts");
    if (featured) {
      featured.innerHTML = `<p class="muted">Loading products...</p>`;
      const products = await getProducts(4);
      featured.innerHTML = products.length 
         ? products.map(p => productCard(p, userWishlist.includes(p.id))).join("") 
         : `<p class="muted">No products available yet.</p>`;
    }
  });
}

document.addEventListener("DOMContentLoaded", initApp);