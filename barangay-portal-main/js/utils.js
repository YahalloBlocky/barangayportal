// ============================================================
// utils.js — Shared helper functions for all pages
// ============================================================

// Tab switching
export function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab
      if (!target) return
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'))
      btn.classList.add('active')
      const panel = document.getElementById(`tab-${target}`)
      if (panel) panel.classList.add('active')
    })
  })
}

// Escape HTML to prevent XSS attacks
export function esc(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// Format a Firestore timestamp or date string
export function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('en-PH', { month:'short', day:'numeric', year:'numeric' })
}

// Show a status message under a form
export function showMsg(elId, text, type) {
  const el = document.getElementById(elId)
  if (!el) return
  const colors = { success:'#1a7a5e', warn:'#b45309', error:'#c0392b' }
  el.textContent = text
  el.style.color  = colors[type] || '#333'
  setTimeout(() => { el.textContent = '' }, 5000)
}

// Preview an image before uploading
export function previewImg(inputId, previewId, placeholderId, clearId) {
  const file = document.getElementById(inputId).files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = e => {
    document.getElementById(previewId).src = e.target.result
    document.getElementById(previewId).classList.remove('hidden')
    document.getElementById(placeholderId).classList.add('hidden')
    document.getElementById(clearId).classList.remove('hidden')
  }
  reader.readAsDataURL(file)
}

// Clear an image preview
export function clearImg(inputId, previewId, placeholderId, clearId) {
  document.getElementById(inputId).value = ''
  const p = document.getElementById(previewId)
  p.src = ''
  p.classList.add('hidden')
  document.getElementById(placeholderId).classList.remove('hidden')
  document.getElementById(clearId).classList.add('hidden')
}

// Open image modal
export function openModal(src) {
  document.getElementById('modal-img').src = src
  document.getElementById('modal').classList.remove('hidden')
  document.body.style.overflow = 'hidden'
}

// Close image modal
export function closeModal() {
  document.getElementById('modal').classList.add('hidden')
  document.body.style.overflow = ''
}

// Convert image file to compressed base64 string (max ~500KB output)
export function imageToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')

        // Resize: max 800px wide/tall
        let w = img.width
        let h = img.height
        const MAX = 800
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX }
          else       { w = Math.round(w * MAX / h); h = MAX }
        }

        canvas.width  = w
        canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)

        // Compress to JPEG at 70% quality
        const base64 = canvas.toDataURL('image/jpeg', 0.7)
        resolve(base64)
      }
      img.onerror = reject
      img.src = e.target.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Legacy uploadImage — now just returns base64 (storage param ignored)
export async function uploadImage(storage, file, folder) {
  return await imageToBase64(file)
}

// Make these available globally so inline HTML onclick handlers can use them
window.previewImg = previewImg
window.clearImg   = clearImg
window.closeModal = closeModal
window.openModal  = openModal
window.esc        = esc

// Close modal on Escape key
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() })
