import { db, auth } from "./config.js";
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { esc, getProducts, productCard } from "./app.js";

const WORKER_BASE_URL = "https://market-vision.dev-kumrekrishna.workers.dev";
const avatars = [
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Mia",
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Oliver",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Robot1",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Robot2",
    "https://api.dicebear.com/7.x/pixel-art/svg?seed=Pixel1",
    "https://api.dicebear.com/7.x/pixel-art/svg?seed=Pixel2"
];

// Secure Image Upload Handler
async function uploadToR2(file) {
  const cleanFileName = file.name.replace(/\s+/g, '-');
  const res = await fetch(WORKER_BASE_URL, {
    method: "POST",
    body: file,
    headers: { "X-File-Name": `user_${Date.now()}_${cleanFileName}` }
  });
  if (!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  return data.url;
}

document.addEventListener("DOMContentLoaded", () => {
  let currentUser = null;
  let userAddresses = [];
  let userWishlistIds = [];
  let selectedPfpUrl = null;

  const editProfileModal = document.getElementById("editProfileModal");
  const openEditModalBtn = document.getElementById("openEditModalBtn");
  const closeEditModalBtn = document.getElementById("closeEditModalBtn");
  const profileForm = document.getElementById("profileForm");
  const profStatus = document.getElementById("profStatus");

  const addressListContainer = document.getElementById("addressListContainer");
  const saveAddressBtn = document.getElementById("saveAddressBtn");

  const pfpModal = document.getElementById("pfpModal");
  const openPfpModalBtn = document.getElementById("openPfpModalBtn");
  const closePfpModalBtn = document.getElementById("closePfpModalBtn");
  const avatarGrid = document.getElementById("avatarGrid");
  const savePfpBtn = document.getElementById("savePfpBtn");
  const pfpStatus = document.getElementById("pfpStatus");
  const profPfpUpload = document.getElementById("profPfpUpload");

  const wishlistContainer = document.getElementById("wishlistContainer");
  const ordersContainer = document.getElementById("ordersContainer");

  function getInitials(name) {
    if(!name || name.trim() === "") return "U";
    const parts = name.trim().split(" ");
    if(parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
  }

  window.loadWishlist = async function() {
      if(!userWishlistIds || userWishlistIds.length === 0) {
          wishlistContainer.innerHTML = '<p class="muted">Your wishlist is empty.</p>';
          return;
      }
      wishlistContainer.innerHTML = '<p class="muted">Loading wishlist...</p>';
      
      try {
          const allProducts = await getProducts();
          const wishedProducts = allProducts.filter(p => userWishlistIds.includes(p.id));
          
          if(wishedProducts.length === 0) {
               wishlistContainer.innerHTML = '<p class="muted">Your wishlist is empty.</p>';
          } else {
               wishlistContainer.innerHTML = `<div class="product-grid">${wishedProducts.map(p => productCard(p, true)).join('')}</div>`;
          }
      } catch (error) {
          wishlistContainer.innerHTML = '<p class="muted" style="color:red;">Error loading wishlist.</p>';
      }
  };

  // Load User Data & Init Profile
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    currentUser = user;
    
    try {
        const userDocRef = doc(db, "users", user.uid);
        const snap = await getDoc(userDocRef);
        
        if (snap.exists()) {
          const data = snap.data();
          
          // Populate UI
          document.getElementById("profileNameDisplay").textContent = data.name || "Customer";
          document.getElementById("profileBioDisplay").textContent = data.bio || "Welcome to your profile.";
          
          document.getElementById("profName").value = data.name || "";
          document.getElementById("profPhone").value = data.phone || "";
          document.getElementById("profBio").value = data.bio || "";
          
          if(data.addresses && Array.isArray(data.addresses)) {
              userAddresses = data.addresses;
              renderAddresses();
          }
          
          if(data.wishlist && Array.isArray(data.wishlist)) {
              userWishlistIds = data.wishlist;
          }
          
          window.loadWishlist();
          
          // Clean state for Orders (No more dummy data)
          ordersContainer.innerHTML = '<p class="muted">No orders found. Start shopping!</p>';

          // Profile Picture Logic
          const pfpDisplay = document.getElementById("profilePfpDisplay");
          if (data.pfp) {
            pfpDisplay.innerHTML = `<img src="${esc(data.pfp)}" alt="PFP">`;
          } else {
            pfpDisplay.textContent = getInitials(data.name);
          }
        }
    } catch(e) {
        console.error("Error loading user profile:", e);
    }
  });

  // ------------------------------------
  // ADDRESS MANAGEMENT
  // ------------------------------------
  function renderAddresses() {
      if(userAddresses.length === 0) {
          addressListContainer.innerHTML = '<p class="muted">No saved addresses.</p>';
          return;
      }
      addressListContainer.innerHTML = userAddresses.map((addr, index) => `
        <div class="address-card" style="margin-bottom:10px; padding:10px;">
           <div style="display:flex; justify-content:space-between; align-items:center;">
             <h4 style="margin:0;"><i class="fas fa-map-marker-alt"></i> ${esc(addr.type)}</h4>
             <button type="button" class="btn danger" style="padding: 2px 8px; min-height:auto; font-size:12px;" onclick="deleteAddress(${index})"><i class="fas fa-trash"></i></button>
           </div>
           <p style="margin:5px 0 0 0;">${esc(addr.town)}, ${esc(addr.road)}, ${esc(addr.city)} - ${esc(addr.pin)}</p>
           ${addr.landmark ? `<p style="margin:2px 0 0 0;">Landmark: ${esc(addr.landmark)}</p>` : ''}
           ${addr.altPhone ? `<p style="margin:2px 0 0 0;">Contact: ${esc(addr.altPhone)}</p>` : ''}
        </div>
      `).join('');
  }

  window.deleteAddress = function(index) {
      if(!confirm("Delete this address?")) return;
      userAddresses.splice(index, 1);
      renderAddresses();
  };

  saveAddressBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      const newAddr = {
          type: document.getElementById("newAddrType").value,
          altPhone: document.getElementById("newAddrPhone").value.trim(),
          town: document.getElementById("newAddrTown").value.trim(),
          road: document.getElementById("newAddrRoad").value.trim(),
          landmark: document.getElementById("newAddrLandmark").value.trim(),
          city: document.getElementById("newAddrCity").value.trim(),
          pin: document.getElementById("newAddrPin").value.trim()
      };
      
      if(!newAddr.town || !newAddr.city) {
          alert("Please fill at least Town and City");
          return;
      }
      userAddresses.push(newAddr);
      renderAddresses();
      
      // Clear inputs
      ["newAddrPhone", "newAddrTown", "newAddrRoad", "newAddrLandmark", "newAddrCity", "newAddrPin"].forEach(id => document.getElementById(id).value = "");
  });

  // ------------------------------------
  // PROFILE UPDATE LOGIC
  // ------------------------------------
  openEditModalBtn?.addEventListener("click", () => editProfileModal.classList.add("open"));
  closeEditModalBtn?.addEventListener("click", () => editProfileModal.classList.remove("open"));

  profileForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const submitBtn = profileForm.querySelector("button[type='submit']");
    submitBtn.disabled = true;
    profStatus.textContent = "Saving all details...";

    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        name: document.getElementById("profName").value.trim(),
        phone: document.getElementById("profPhone").value.trim(),
        bio: document.getElementById("profBio").value.trim(),
        addresses: userAddresses
      });
      profStatus.textContent = "Saved Successfully!";
      profStatus.style.color = "green";
      setTimeout(() => window.location.reload(), 1000); 
    } catch (error) {
      profStatus.textContent = "Failed to update.";
      profStatus.style.color = "red";
      submitBtn.disabled = false;
    }
  });

  // ------------------------------------
  // AVATAR/PFP UPDATE LOGIC
  // ------------------------------------
  openPfpModalBtn?.addEventListener("click", () => {
      avatarGrid.innerHTML = avatars.map(url => `
        <div class="avatar-option" data-url="${url}">
            <img src="${url}" alt="Avatar">
        </div>
      `).join('');
      
      document.querySelectorAll('.avatar-option').forEach(el => {
          el.addEventListener('click', function() {
              document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
              this.classList.add('selected');
              selectedPfpUrl = this.dataset.url;
              profPfpUpload.value = ""; 
            });
      });
      pfpModal.classList.add("open");
  });

  closePfpModalBtn?.addEventListener("click", () => pfpModal.classList.remove("open"));

  profPfpUpload?.addEventListener('change', () => {
      if(profPfpUpload.files.length > 0) {
          document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('selected'));
          selectedPfpUrl = null; 
        }
  });

  savePfpBtn?.addEventListener("click", async () => {
      if(!currentUser) return;
      savePfpBtn.disabled = true;
      pfpStatus.textContent = "Processing...";

      try {
          let finalPfpUrl = selectedPfpUrl;

          // If a custom file is selected, upload it first
          if (profPfpUpload.files.length > 0) {
              pfpStatus.textContent = "Uploading Image...";
              finalPfpUrl = await uploadToR2(profPfpUpload.files[0]);
          }

          if (finalPfpUrl) {
              await updateDoc(doc(db, "users", currentUser.uid), { pfp: finalPfpUrl });
              pfpStatus.textContent = "Avatar updated!";
              pfpStatus.style.color = "green";
              setTimeout(() => window.location.reload(), 1000);
          } else {
              pfpStatus.textContent = "Please select an avatar or upload an image.";
              savePfpBtn.disabled = false;
          }
      } catch (error) {
          console.error(error);
          pfpStatus.textContent = "Failed to update Avatar.";
          pfpStatus.style.color = "red";
          savePfpBtn.disabled = false;
      }
  });
});