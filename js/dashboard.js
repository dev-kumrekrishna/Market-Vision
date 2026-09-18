import { db, auth } from "./config.js";
import { requireAdminAuth } from "./auth.js";
import { esc, DEFAULT_CATEGORIES } from "./app.js"; 
import { collection, getDocs, addDoc, deleteDoc, doc, getDoc, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const WORKER_BASE_URL = "https://market-vision.dev-kumrekrishna.workers.dev"; 

async function uploadToR2(file) {
  const cleanFileName = file.name.replace(/\s+/g, '-');
  const res = await fetch(WORKER_BASE_URL, {
    method: "POST",
    body: file,
    headers: { "X-File-Name": `prod_${Date.now()}_${cleanFileName}` }
  });
  if (!res.ok) throw new Error("Media upload failed");
  const data = await res.json();
  return data.url; 
}

async function deleteFromR2(fileUrl) {
  if (!fileUrl || !fileUrl.includes('workers.dev')) return;
  const fileName = fileUrl.split('/').pop();
  const deleteUrl = `${WORKER_BASE_URL}/${fileName}`;
  try { await fetch(deleteUrl, { method: "DELETE" }); } catch (error) { console.error("Failed:", error); }
}

document.addEventListener("DOMContentLoaded", () => {
  requireAdminAuth(); 
  
  const list = document.getElementById("list");
  const count = document.getElementById("count");
  const catCount = document.getElementById("catCount");
  const modal = document.getElementById("modal");
  const search = document.getElementById("dashSearch");
  
  let allProducts = [];

  // Editor check & UI restrictions
  onAuthStateChanged(auth, async user => {
    if (user) {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().role === "editor") {
        // Agar aage chal kar Orders ka koi tab aata hai, to usko display none kar de:
        const ordersTab = document.getElementById("ordersTab");
        if (ordersTab) ordersTab.style.display = "none";
      }
    }
  });

  async function loadProducts() {
    try {
      const productsQuery = query(collection(db, "products"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(productsQuery);
      allProducts = snapshot.docs.map(documentItem => ({
        id: documentItem.id,
        ...documentItem.data()
      }));
      render();
    } catch (error) {
      console.error(error);
      list.innerHTML = `<p class="muted">Could not load products.</p>`;
    }
  }

  function render() {
    const q = (search?.value || "").toLowerCase();
    const products = allProducts.filter(product =>
      `${product.name} ${product.category || ""}`.toLowerCase().includes(q)
    );
    
    count.textContent = allProducts.length;
    catCount.textContent = new Set(allProducts.map(p => p.category).filter(Boolean)).size;

    list.innerHTML = products.map(product => {
      const isVideo = product.image && product.image.match(/\.(mp4|webm|ogg)$/i);
      return `
        <div class="admin-item">
          <div class="admin-item-main">
            ${product.image 
                ? (isVideo ? `<video class="admin-thumb" src="${esc(product.image)}" muted></video>` : `<img class="admin-thumb" src="${esc(product.image)}" alt="${esc(product.name)}">`)
                : `<div class="admin-thumb"></div>`
            }
            <div>
              <h3>${esc(product.name)}</h3>
              <p>${esc(product.category || "General")} • ₹${Number(product.price || 0).toLocaleString("en-IN")}</p>
            </div>
          </div>
          <button class="delete btn danger" style="min-height: 30px; font-size: 12px;" data-delete="${product.id}">Delete</button>
        </div>
      `;
    }).join("") || `<p class="muted">No products yet.</p>`;
  }

  document.getElementById("addBtn").addEventListener("click", () => {
    
    // Combine DEFAULT categories with any custom ones already in DB
    const usedCategories = allProducts.map(p => p.category).filter(Boolean);
    const combinedCategories = [...new Set([...DEFAULT_CATEGORIES, ...usedCategories])];
    
    let categoryOptions = combinedCategories.map(cat => `<option value="${esc(cat)}">${esc(cat)}</option>`).join('');
    categoryOptions += `<option value="ADD_NEW">+ Add New Category...</option>`;

    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal">
          <h2>Add Product</h2>
          <form id="productForm">
            <label>Product Name<input id="pName" required></label>
            
            <label>Category
              <select id="pCatSelect">
                ${categoryOptions}
              </select>
              <input id="pCatCustom" type="text" placeholder="Type new category name..." style="display: none; margin-top: 8px;">
            </label>

            <label>Price (₹)<input id="pPrice" type="number" min="0" required></label>
            <label>Description<textarea id="pDesc" rows="3"></textarea></label>
            
            <label>Specific Details (Optional)
              <div id="detailsContainer"></div>
              <button type="button" class="btn secondary" id="addDetailBtn" style="margin-top: 8px; padding: 5px 10px; min-height: 30px; font-size: 12px;">+ Add Detail</button>
            </label>

            <label>Product Media (Images / Videos)
              <div id="mediaContainer"></div>
              <button type="button" class="btn secondary" id="addMediaBtn" style="margin-top: 8px; padding: 5px 10px; min-height: 30px; font-size: 12px;">+ Add More Media</button>
            </label>
            
            <div class="modal-actions">
              <button class="btn secondary" type="button" id="cancel">Cancel</button>
              <button class="btn primary" type="submit">Save Product</button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.getElementById("cancel").onclick = () => { modal.innerHTML = ""; };

    const pCatSelect = document.getElementById("pCatSelect");
    const pCatCustom = document.getElementById("pCatCustom");

    pCatSelect.addEventListener("change", (e) => {
      if (e.target.value === "ADD_NEW") {
        pCatCustom.style.display = "block";
        pCatCustom.required = true;
        pCatCustom.focus();
      } else {
        pCatCustom.style.display = "none";
        pCatCustom.required = false;
        pCatCustom.value = "";
      }
    });

    document.getElementById("addDetailBtn").onclick = () => {
      const container = document.getElementById("detailsContainer");
      const row = document.createElement("div");
      row.className = "detail-row";
      row.innerHTML = `
          <input type="text" class="detail-name" placeholder="Name (e.g., Color)">
          <input type="text" class="detail-value" placeholder="Value (e.g., Red)">
          <button type="button" class="remove-btn" title="Remove Detail">X</button>
      `;
      row.querySelector(".remove-btn").onclick = () => row.remove();
      container.appendChild(row);
    };

    const addMediaRow = () => {
      const container = document.getElementById("mediaContainer");
      const row = document.createElement("div");
      row.className = "media-row";
      row.innerHTML = `
          <input type="file" class="media-input" accept="image/*,video/*" style="flex:1;">
          <button type="button" class="remove-btn" title="Remove Media">X</button>
      `;
      row.querySelector(".remove-btn").onclick = () => row.remove();
      container.appendChild(row);
    };

    addMediaRow();
    document.getElementById("addMediaBtn").onclick = addMediaRow;

    // Handle Form Submission
    document.getElementById("productForm").onsubmit = async event => {
      event.preventDefault();
      const submitButton = event.target.querySelector("[type='submit']");
      submitButton.disabled = true;
      submitButton.textContent = "Saving...";

      try {
        let mediaUrls = [];
        const mediaInputs = document.querySelectorAll(".media-input");
        let filesToUpload = [];

        mediaInputs.forEach(input => {
            if (input.files && input.files.length > 0) {
                filesToUpload.push(input.files[0]);
            }
        });
        
        if (filesToUpload.length > 0) {
          submitButton.textContent = `Uploading ${filesToUpload.length} Files...`;
          const uploadPromises = filesToUpload.map(file => uploadToR2(file));
          mediaUrls = await Promise.all(uploadPromises);
        }

        const detailNames = document.querySelectorAll(".detail-name");
        const detailValues = document.querySelectorAll(".detail-value");
        const specificDetails = [];
        
        for (let i = 0; i < detailNames.length; i++) {
           if (detailNames[i].value.trim() && detailValues[i].value.trim()) {
               specificDetails.push({ 
                   name: detailNames[i].value.trim(), 
                   value: detailValues[i].value.trim() 
               });
           }
        }

        const selectedCat = document.getElementById("pCatSelect").value;
        const customCat = document.getElementById("pCatCustom").value.trim();
        const finalCategory = (selectedCat === "ADD_NEW" ? customCat : selectedCat) || "General";

        const primaryMedia = mediaUrls.length > 0 ? mediaUrls[0] : "";

        await addDoc(collection(db, "products"), {
          name: document.getElementById("pName").value.trim(),
          category: finalCategory,
          price: Number(document.getElementById("pPrice").value) || 0,
          description: document.getElementById("pDesc").value.trim(),
          image: primaryMedia,
          media: mediaUrls,
          specificDetails: specificDetails,
          createdAt: serverTimestamp()
        });

        modal.innerHTML = "";
        await loadProducts();
      } catch (error) {
        console.error(error);
        alert("Could not save product. Check database rules.");
      } finally {
        if(submitButton) {
           submitButton.disabled = false;
           submitButton.textContent = "Save Product";
        }
      }
    };
  });

  list.addEventListener("click", async event => {
    const button = event.target.closest("[data-delete]");
    if (!button) return;
    if (!confirm("Delete this product and all attached media?")) return;
    const productId = button.dataset.delete;

    try {
      const product = allProducts.find(p => p.id === productId);
      if (product) {
        if (product.media && product.media.length > 0) {
           for (const url of product.media) {
               await deleteFromR2(url);
           }
        } else if (product.image) {
           await deleteFromR2(product.image);
        }
      }
      
      await deleteDoc(doc(db, "products", productId));
      await loadProducts();
    } catch (error) {
      console.error(error);
      alert("Could not delete product.");
    }
  });


  search?.addEventListener("input", render);
  
  loadProducts();
});