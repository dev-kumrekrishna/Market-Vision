import { db, auth } from "./config.js";
import { doc, getDoc, collection, getDocs, query, orderBy, limit, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { esc, productCard } from "./app.js";

let currentUser = null;
let currentProduct = null;
let currentRating = 5;

document.addEventListener("DOMContentLoaded", async () => {
    onAuthStateChanged(auth, user => {
        currentUser = user;
    });

    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('id');
    const container = document.getElementById("productDetailContainer");

    if (!productId) {
        container.innerHTML = "<p class='muted'>Product not found. <a href='products.html' style='color:#1565c0;'>Go back to products.</a></p>";
        return;
    }

    try {
        const docSnap = await getDoc(doc(db, "products", productId));
        if (docSnap.exists()) {
            currentProduct = { id: docSnap.id, ...docSnap.data() };
            renderFullPageProduct(currentProduct);
            loadProductReviews(currentProduct.id);
            loadSuggestedProducts(currentProduct.category, currentProduct.id);
        } else {
            container.innerHTML = "<p class='muted'>Product not found.</p>";
        }
    } catch (error) {
        console.error("Error fetching product:", error);
        container.innerHTML = "<p class='muted' style='color:#d93025;'>Error loading product. Please check your connection.</p>";
    }
});

function renderFullPageProduct(p) {
    // FIX: Encode string correctly for HTML attribute
    const productDataStr = encodeURIComponent(JSON.stringify(p)).replace(/'/g, "%27");
    
    // IMAGE GALLERY LOGIC
    let mediaHtml = '';
    if (p.media && p.media.length > 0) {
        const firstMediaIsVideo = p.media[0].match(/\.(mp4|webm|ogg)$/i);
        const mainMedia = firstMediaIsVideo 
            ? `<video id="mainMediaDisplay" src="${esc(p.media[0])}" style="width:100%; height:400px; object-fit:contain; border-radius:8px; background:#fff;" controls autoplay muted></video>` 
            : `<img id="mainMediaDisplay" src="${esc(p.media[0])}" style="width:100%; height:400px; object-fit:contain; border-radius:8px; background:#fff;">`;
        
        let thumbsHtml = `<div style="display:flex; gap:12px; margin-top:20px; overflow-x:auto; padding-bottom:10px;">`;
        
        p.media.forEach((url) => {
            const isVid = url.match(/\.(mp4|webm|ogg)$/i);
            if(isVid) {
                thumbsHtml += `<video src="${esc(url)}" style="width:75px; height:75px; object-fit:cover; border-radius:8px; cursor:pointer; border:2px solid #e0e7f0; background:#fff;" onclick="document.getElementById('mainMediaDisplay').outerHTML = '<video id=\\'mainMediaDisplay\\' src=\\'${esc(url)}\\' style=\\'width:100%; height:400px; object-fit:contain; border-radius:8px; background:#fff;\\' controls autoplay></video>'"></video>`;
            } else {
                thumbsHtml += `<img src="${esc(url)}" style="width:75px; height:75px; object-fit:cover; border-radius:8px; cursor:pointer; border:2px solid #e0e7f0; background:#fff;" onclick="document.getElementById('mainMediaDisplay').outerHTML = '<img id=\\'mainMediaDisplay\\' src=\\'${esc(url)}\\' style=\\'width:100%; height:400px; object-fit:contain; border-radius:8px; background:#fff;\\'>'">`;
            }
        });
        thumbsHtml += `</div>`;
        mediaHtml = mainMedia + thumbsHtml;
    } else if (p.image) {
        const isVideo = p.image.match(/\.(mp4|webm|ogg)$/i);
        mediaHtml = isVideo 
            ? `<video src="${esc(p.image)}" style="width:100%; max-height:450px; object-fit:contain; border-radius:8px; background:#fff;" controls></video>` 
            : `<img src="${esc(p.image)}" alt="${esc(p.name)}" style="width:100%; max-height:450px; object-fit:contain; border-radius:8px; background:#fff;">`;
    } else {
        mediaHtml = `<div style="width:100%; height:400px; background:#fff; display:grid; place-items:center; color:#1565c0; font-weight:bold; font-size:24px; border-radius:8px; border:1px solid #e7edf5;">MV</div>`;
    }

    // SPECIFIC DETAILS LOGIC
    let detailsHtml = "";
    if (p.specificDetails && p.specificDetails.length > 0) {
        detailsHtml = `<div style="margin: 20px 0; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e7edf5;">
            <h4 style="margin:0 0 10px 0; color:#12203a;">Product Specifications</h4>
            <table style="width:100%; font-size:14px; color:#526074; border-collapse: collapse;">
                ${p.specificDetails.map(d => `<tr><td style="padding: 5px 0; font-weight:bold; width: 40%;">${esc(d.name)}:</td><td style="padding: 5px 0;">${esc(d.value)}</td></tr>`).join('')}
            </table>
        </div>`;
    }

    document.getElementById("productDetailContainer").innerHTML = `
        <div class="product-modal-grid" style="background:#fff; border:1px solid #e0e7f0; border-radius:12px; overflow:hidden; margin-bottom: 40px;">
            <div class="pm-image-section" style="padding: 40px; background: #f8fafc; display:flex; flex-direction:column; justify-content:center;">
                ${mediaHtml}
            </div>
            <div class="pm-details-section" style="padding: 40px;">
                <span class="pm-category">${esc(p.category || "General")}</span>
                <h1 class="pm-title" style="font-size:32px; margin: 10px 0;">${esc(p.name)}</h1>
                
                <div class="rating-snippet" style="font-size:14px; margin-bottom:15px;">
                    4.5 <i class="fas fa-star"></i> <span id="reviewCountBadge">(0)</span>
                </div>
                
                <div class="pm-price" style="font-size:28px; margin: 20px 0;">₹${Number(p.price || 0).toLocaleString("en-IN")}</div>
                <p class="pm-desc" style="font-size:16px;">${esc(p.description || "No description provided.")}</p>
                
                ${detailsHtml}

                <div style="display:flex; gap:15px; margin-top: 30px; margin-bottom: 30px;">
                    <button class="btn primary" style="flex:1; font-size:16px;" onclick="buyNow('${productDataStr}', event)">
                        <i class="fab fa-whatsapp" style="margin-right:8px;"></i> Buy Now
                    </button>
                    <!-- UPDATED ADD TO CART -->
                    <button class="btn secondary" style="flex:1; font-size:16px;" onclick="addToCart('${productDataStr}', event)">
                        <i class="fas fa-shopping-cart" style="margin-right:8px;"></i> Add to Cart
                    </button>
                </div>
            </div>
        </div>

        <div style="margin-bottom: 40px;">
            <h2 style="font-size:22px; color:#12203a; margin-bottom: 20px; border-bottom: 2px solid #e7edf5; padding-bottom:10px;">Similar Products</h2>
            <div class="product-grid" id="similarProductsList" style="margin-bottom: 40px;">
                <p class="muted">Loading similar products...</p>
            </div>
            
            <h2 style="font-size:22px; color:#12203a; margin-bottom: 20px; border-bottom: 2px solid #e7edf5; padding-bottom:10px;">More to Explore</h2>
            <div class="product-grid" id="otherProductsList">
                <p class="muted">Loading more products...</p>
            </div>
        </div>

        <div style="background:#fff; border:1px solid #e0e7f0; border-radius:12px; padding:30px;">
            <h2 style="font-size:22px; color:#12203a; margin-bottom: 20px; border-bottom: 2px solid #e7edf5; padding-bottom:10px;">Customer Reviews</h2>
            <div id="pmReviewsList" style="margin-bottom: 30px; max-height: 400px; overflow-y:auto; padding-right:10px;">
                <p class="muted">Loading reviews...</p>
            </div>
            
            <div class="review-form" style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e7edf5;">
                <h3 style="margin-top:0; margin-bottom:15px; font-size:16px;">Write a Review</h3>
                <div class="star-rating-input" id="newReviewStars" style="margin-bottom: 10px;">
                    <i class="fas fa-star active" onclick="setReviewRating(1)"></i>
                    <i class="fas fa-star active" onclick="setReviewRating(2)"></i>
                    <i class="fas fa-star active" onclick="setReviewRating(3)"></i>
                    <i class="fas fa-star active" onclick="setReviewRating(4)"></i>
                    <i class="fas fa-star active" onclick="setReviewRating(5)"></i>
                </div>
                <textarea id="newReviewText" rows="3" placeholder="Tell us what you think about this product..." style="width:100%; padding:10px; border:1px solid #ccd8e6; border-radius:6px; resize:vertical; margin-bottom:10px; font-family:inherit;"></textarea>
                <button class="btn primary" id="submitReviewBtn" onclick="submitProductReview(event)">Post Review</button>
                <p id="reviewStatus" class="muted" style="margin-top:10px; font-weight:bold;"></p>
            </div>
        </div>
    `;
}

async function loadSuggestedProducts(category, currentId) {
    const similarContainer = document.getElementById("similarProductsList");
    const otherContainer = document.getElementById("otherProductsList");

    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(25));
        const snap = await getDocs(q);
        
        let similarProducts = [];
        let otherProducts = [];

        snap.forEach(doc => {
            if (doc.id !== currentId) {
                const data = doc.data();
                const p = { id: doc.id, ...data };
                
                if (data.category === category) {
                    similarProducts.push(p);
                } else {
                    otherProducts.push(p);
                }
            }
        });
        
        similarProducts = similarProducts.slice(0, 4);
        otherProducts = otherProducts.sort(() => 0.5 - Math.random()).slice(0, 4);

        if (similarProducts.length === 0) {
            similarContainer.innerHTML = '<p class="muted">No similar products available.</p>';
        } else {
            similarContainer.innerHTML = similarProducts.map(p => productCard(p, false)).join('');
        }

        if (otherProducts.length === 0) {
            otherContainer.innerHTML = '<p class="muted">No other products available.</p>';
        } else {
            otherContainer.innerHTML = otherProducts.map(p => productCard(p, false)).join('');
        }
    } catch(e) {
        console.error("Suggestions Error:", e);
        similarContainer.innerHTML = '<p class="muted">Could not load suggestions.</p>';
        otherContainer.innerHTML = '<p class="muted">Could not load more products.</p>';
    }
}

async function loadProductReviews(productId) {
    const reviewsContainer = document.getElementById("pmReviewsList");
    try {
        const reviewsQuery = query(collection(db, "products", productId, "reviews"), orderBy("createdAt", "desc"));
        const snap = await getDocs(reviewsQuery);

        if (snap.empty) {
            reviewsContainer.innerHTML = '<p class="muted">No reviews yet. Be the first to review!</p>';
            document.getElementById("reviewCountBadge").innerText = "(0)";
            return;
        }

        let html = '';
        snap.forEach(d => {
            const r = d.data();
            const starsHtml = Array(5).fill(0).map((_, i) => {
                return i < (r.rating || 5) ? '<i class="fas fa-star"></i>' : '<i class="far fa-star"></i>';
            }).join('');

            html += '<div class="review-item" style="padding: 15px 0; border-bottom: 1px solid #f0f4f8;">' +
                    '<div class="review-header" style="display: flex; justify-content: space-between; margin-bottom: 5px;">' +
                    '<span class="reviewer-name" style="font-weight: 700; color: #12203a; font-size:14px;">' + esc(r.userName || "User") + '</span>' +
                    '<span class="review-stars" style="color: #e69b45; font-size: 12px;">' + starsHtml + '</span>' +
                    '</div>' +
                    '<p class="review-text" style="margin: 0; color: #64748b; font-size: 13px;">' + esc(r.text) + '</p>' +
                    '</div>';
        });
        reviewsContainer.innerHTML = html;
        document.getElementById("reviewCountBadge").innerText = "(" + snap.size + ")";
    } catch(e) {
        reviewsContainer.innerHTML = '<p class="muted" style="color:#d93025;">Error loading reviews.</p>';
    }
}

window.setReviewRating = function(stars) {
    currentRating = stars;
    const starIcons = document.querySelectorAll('#newReviewStars i');
    starIcons.forEach((star, index) => {
        if (index < stars) {
            star.classList.remove('far');
            star.classList.add('fas', 'active');
        } else {
            star.classList.remove('fas', 'active');
            star.classList.add('far');
        }
    });
};

window.submitProductReview = async function(event) {
    event.preventDefault();
    const textElem = document.getElementById("newReviewText");
    const statusElem = document.getElementById("reviewStatus");
    const btn = document.getElementById("submitReviewBtn");
    
    const text = textElem.value.trim();
    if (!text) {
        statusElem.textContent = "Please write a review text.";
        statusElem.style.color = "#d93025";
        return;
    }
    if (!currentUser) {
        statusElem.innerHTML = "Please <a href='login.html' style='color:#1565c0; text-decoration:underline;'>login</a> to post a review.";
        statusElem.style.color = "#d93025";
        return;
    }

    btn.disabled = true;
    btn.textContent = "Posting...";
    statusElem.textContent = "";

    try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const userName = userDoc.exists() ? (userDoc.data().name || "Customer") : "Customer";

        await addDoc(collection(db, "products", currentProduct.id, "reviews"), {
            text: text,
            rating: currentRating,
            userId: currentUser.uid,
            userName: userName,
            createdAt: serverTimestamp()
        });

        statusElem.textContent = "Review posted successfully!";
        statusElem.style.color = "green";
        textElem.value = "";
        setReviewRating(5);
        btn.disabled = false;
        btn.textContent = "Post Review";
        
        loadProductReviews(currentProduct.id);
    } catch (e) {
        console.error(e);
        statusElem.textContent = "Error posting review. Please try again.";
        statusElem.style.color = "#d93025";
        btn.disabled = false;
        btn.textContent = "Post Review";
    }
};