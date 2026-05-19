// ============================================================
// lostfound.js — Lost & Found page logic using Firebase
// FIX: Resolved tab now shows BOTH lost and found items together
// ============================================================

import { db, storage } from "./firebase-config.js"
import { initTabs, esc, formatDate, showMsg, uploadImage } from "./utils.js"
import {
  collection, addDoc, getDocs, doc, updateDoc,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"

initTabs()

let lfType = 'lost'

window.setLFType = function (type) {
  lfType = type
  const lostBtn = document.getElementById('lf-type-lost')
  const foundBtn = document.getElementById('lf-type-found')
  const submitBtn = document.getElementById('lf-submit-btn')

  lostBtn.classList.remove('active', 'lost-active', 'found-active')
  foundBtn.classList.remove('active', 'lost-active', 'found-active')

  if (type === 'lost') {
    lostBtn.classList.add('active', 'lost-active')
    submitBtn.textContent = '🔍 Post Lost Item'
    submitBtn.style.background = '#c0392b'
    submitBtn.style.color = '#fff'
  } else {
    foundBtn.classList.add('active', 'found-active')
    submitBtn.textContent = '✅ Post Found Item'
    submitBtn.style.background = '#1a7a5e'
    submitBtn.style.color = '#fff'
  }
}

window.submitLF = async function () {
  const itemName = document.getElementById('lf-item-name').value.trim()
  const name = document.getElementById('lf-name').value.trim()
  const desc = document.getElementById('lf-desc').value.trim()
  const location = document.getElementById('lf-location').value.trim()
  const contact = document.getElementById('lf-contact').value.trim()
  const imageFile = document.getElementById('lf-image').files[0]

  if (!itemName) return showMsg('lf-msg', '⚠️ Item name is required.', 'warn')
  if (!desc) return showMsg('lf-msg', '⚠️ Description is required.', 'warn')
  if (!location) return showMsg('lf-msg', '⚠️ Location is required.', 'warn')
  if (!contact) return showMsg('lf-msg', '⚠️ Contact is required.', 'warn')

  if (imageFile && imageFile.size > 2 * 1024 * 1024)
    return showMsg('lf-msg', '⚠️ Image must be under 2MB.', 'warn')

  showMsg('lf-msg', 'Saving...', 'warn')

  try {
    let imageUrl = null
    if (imageFile) imageUrl = await uploadImage(storage, imageFile, 'lostfound')

    await addDoc(collection(db, 'lost_found'), {
      type: lfType,
      item_name: itemName,
      name: name || 'Anonymous',
      description: desc,
      location,
      contact,
      imageUrl,
      status: 'pending',
      createdAt: serverTimestamp()
    })

    showMsg('lf-msg', '✅ Posted successfully!', 'success')
    document.getElementById('lf-item-name').value = ''
    document.getElementById('lf-name').value = ''
    document.getElementById('lf-desc').value = ''
    document.getElementById('lf-location').value = ''
    document.getElementById('lf-contact').value = ''
    window.clearImg('lf-image', 'lf-preview', 'lf-ph', 'lf-clear')

    setTimeout(() => {
      loadLF('lost')
      loadLF('found')
    }, 1500)

  } catch (err) {
    console.error(err)
    showMsg('lf-msg', '❌ Error: ' + err.message, 'error')
  }
}

// Load pending items (lost or found separately)
async function loadLF(type) {
  const gridId = type === 'lost' ? 'lost-grid' : 'found-grid'
  const grid = document.getElementById(gridId)
  if (!grid) return

  grid.innerHTML = '<div class="loading">Loading...</div>'

  try {
    const q = query(
      collection(db, 'lost_found'),
      where('type', '==', type),
      where('status', '==', 'pending')
    )
    const snapshot = await getDocs(q)
    let items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))

    // Sort newest first
    items.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(0)
      const bTime = b.createdAt?.toDate?.() || new Date(0)
      return bTime - aTime
    })

    const countEl = document.getElementById(`${type}-count`)
    if (countEl) countEl.textContent = items.length

    grid.innerHTML = items.length === 0
      ? `<div class="empty-state">No ${type} items yet.</div>`
      : items.map(item => buildLFCard(item, false)).join('')

  } catch (err) {
    console.error(err)
    grid.innerHTML = `<div class="empty-state">Could not load. Error: ${err.message}</div>`
  }
}

// Load ALL resolved items (both lost and found) in one query
async function loadResolved() {
  const grid = document.getElementById('lf-resolved-grid')
  if (!grid) return

  grid.innerHTML = '<div class="loading">Loading...</div>'

  try {
    // Single query for ALL resolved items — no type filter
    const q = query(
      collection(db, 'lost_found'),
      where('status', '==', 'resolved')
    )
    const snapshot = await getDocs(q)
    let items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))

    // Sort newest first
    items.sort((a, b) => {
      const aTime = a.createdAt?.toDate?.() || new Date(0)
      const bTime = b.createdAt?.toDate?.() || new Date(0)
      return bTime - aTime
    })

    // Update the resolved count badge
    const countEl = document.getElementById('resolved-count')
    if (countEl) countEl.textContent = items.length

    grid.innerHTML = items.length === 0
      ? `<div class="empty-state">No resolved items yet.</div>`
      : items.map(item => buildLFCard(item, true)).join('')

  } catch (err) {
    console.error(err)
    grid.innerHTML = `<div class="empty-state">Could not load. Error: ${err.message}</div>`
  }
}

function buildLFCard(item, resolved) {
  const isLost = item.type === 'lost'
  const cardTop = resolved ? 'border-top:4px solid var(--gray-400)' : isLost ? 'border-top:4px solid var(--lost)' : 'border-top:4px solid var(--found)'
  const badgeClass = resolved ? 'badge-resolved' : isLost ? 'badge-lost' : 'badge-found'
  const badgeText = resolved ? '✔ Resolved' : isLost ? '🔍 Lost' : '✅ Found'

  const imgHtml = item.imageUrl
    ? `<img class="card-img" src="${item.imageUrl}" alt="${esc(item.item_name)}" onclick="openModal('${esc(item.imageUrl)}')" title="Click to enlarge"/>`
    : `<div class="card-no-img">${isLost ? '🔍' : '📦'}</div>`

  const resolveBtn = !resolved
    ? `<button class="resolve-btn" onclick="resolveLF('${item.id}')">✔ Mark Resolved</button>`
    : `<span style="font-size:.75rem;color:var(--gray-400)">✔ Resolved</span>`

  return `
    <div class="item-card" style="${cardTop}" id="lf-${item.id}">
      ${imgHtml}
      <div class="card-body">
        <span class="card-badge ${badgeClass}">${badgeText}</span>
        <div class="card-title">${esc(item.item_name)}</div>
        <div class="card-desc">${esc(item.description)}</div>
        <div class="card-meta">
          <div class="meta-row"><span class="meta-icon">📍</span><span class="meta-key">Location:</span><span class="meta-val">${esc(item.location)}</span></div>
          <div class="meta-row"><span class="meta-icon">📞</span><span class="meta-key">Contact:</span><span class="meta-val">${esc(item.contact)}</span></div>
          <div class="meta-row"><span class="meta-icon">👤</span><span class="meta-key">Posted by:</span><span class="meta-val">${esc(item.name)}</span></div>
        </div>
        <div class="card-footer">
          <span class="card-date">📅 ${formatDate(item.createdAt)}</span>
          ${resolveBtn}
        </div>
      </div>
    </div>`
}

window.resolveLF = async function (id) {
  if (!confirm('Mark as resolved? It will move to the Resolved tab.')) return
  try {
    await updateDoc(doc(db, 'lost_found', id), { status: 'resolved' })
    const card = document.getElementById(`lf-${id}`)
    if (card) {
      card.style.opacity = '0'
      card.style.transition = 'opacity 0.3s'
      setTimeout(() => {
        loadLF('lost')
        loadLF('found')
        loadResolved()
      }, 300)
    }
  } catch (err) { alert('Could not resolve. Try again.') }
}

// Initialize
loadLF('lost')
loadLF('found')
loadResolved()