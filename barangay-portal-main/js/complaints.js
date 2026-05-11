// ============================================================
// complaints.js — Complaints page logic using Firebase
// ============================================================

import { db, storage }    from "./firebase-config.js"
import { initTabs, esc, formatDate, showMsg, uploadImage } from "./utils.js"
import {
  collection, addDoc, getDocs, doc, updateDoc, increment,
  query, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"

initTabs()

let cSort   = 'newest'
const voted = {}

window.setSort = function(sort) {
  cSort = sort
  document.getElementById('c-sort-newest').classList.toggle('active', sort === 'newest')
  document.getElementById('c-sort-top').classList.toggle('active', sort === 'top')
  loadComplaints('pending')
}

window.submitComplaint = async function() {
  const title     = document.getElementById('c-title').value.trim()
  const name      = document.getElementById('c-name').value.trim()
  const desc      = document.getElementById('c-desc').value.trim()
  const imageFile = document.getElementById('c-image').files[0]

  if (!title) return showMsg('c-msg','⚠️ Title is required.','warn')
  if (!desc)  return showMsg('c-msg','⚠️ Description is required.','warn')

  if (imageFile && imageFile.size > 2 * 1024 * 1024)
    return showMsg('c-msg','⚠️ Image must be under 2MB.','warn')

  showMsg('c-msg','Saving...','warn')

  try {
    let imageUrl = null
    if (imageFile) imageUrl = await uploadImage(storage, imageFile, 'complaints')

    await addDoc(collection(db, 'complaints'), {
      type: 'complaint', title, desc,
      name: name || 'Anonymous',
      imageUrl,
      upvotes: 0, downvotes: 0,
      status: 'pending',
      createdAt: serverTimestamp()
    })

    showMsg('c-msg','✅ Complaint submitted!','success')
    document.getElementById('c-title').value = ''
    document.getElementById('c-name').value  = ''
    document.getElementById('c-desc').value  = ''
    window.clearImg('c-image','c-preview','c-ph','c-clear')

    setTimeout(() => {
      loadComplaints('pending')
      loadComplaints('resolved')
    }, 1500)

  } catch(err) {
    console.error(err)
    showMsg('c-msg','❌ Error: ' + err.message,'error')
  }
}

async function loadComplaints(status) {
  const isResolved = status === 'resolved'
  const gridId     = isResolved ? 'c-resolved-grid' : 'complaint-grid'
  const grid       = document.getElementById(gridId)
  if (!grid) return

  grid.innerHTML = '<div class="loading">Loading...</div>'

  try {
    const q = query(
      collection(db, 'complaints'),
      where('type',   '==', 'complaint'),
      where('status', '==', status)
    )
    const snapshot = await getDocs(q)
    let items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))

    // Sort in JavaScript instead of Firestore
    if (cSort === 'top' && !isResolved) {
      items.sort((a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes))
    } else {
      items.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0)
        const bTime = b.createdAt?.toDate?.() || new Date(0)
        return bTime - aTime
      })
    }

    if (!isResolved) {
      const el = document.getElementById('complaint-count')
      if (el) el.textContent = items.length
    } else {
      const el = document.getElementById('c-resolved-count')
      if (el) el.textContent = items.length
    }

    grid.innerHTML = items.length === 0
      ? `<div class="empty-state">No ${isResolved ? 'resolved' : 'active'} complaints yet.</div>`
      : items.map(p => buildCard(p, isResolved)).join('')

  } catch(err) {
    console.error(err)
    grid.innerHTML = `<div class="empty-state">Could not load. Error: ${err.message}</div>`
  }
}

function buildCard(post, resolved) {
  const score      = (post.upvotes || 0) - (post.downvotes || 0)
  const scoreClass = score > 0 ? 'pos' : score < 0 ? 'neg' : ''
  const userVote   = voted[post.id] || null

  const imgHtml = post.imageUrl
    ? `<img class="card-img" src="${post.imageUrl}" alt="${esc(post.title)}" onclick="openModal('${esc(post.imageUrl)}')" title="Click to enlarge"/>`
    : ''

  const voteHtml = !resolved ? `
    <div class="vote-row">
      <button class="vote-btn up ${userVote==='up'?'voted':''}" onclick="castVote('${post.id}','up')" title="Upvote">
        👍 <span id="cup-${post.id}">${post.upvotes||0}</span>
      </button>
      <button class="vote-btn down ${userVote==='down'?'voted':''}" onclick="castVote('${post.id}','down')" title="Downvote">
        👎 <span id="cdown-${post.id}">${post.downvotes||0}</span>
      </button>
      <span class="vote-score ${scoreClass}" id="cscore-${post.id}">${score>0?'+':''}${score}</span>
      <span class="vote-divider">${(post.upvotes||0)+(post.downvotes||0)} votes</span>
    </div>` : ''

  const resolveBtn = !resolved
    ? `<button class="resolve-btn" onclick="resolveC('${post.id}')">✔ Mark Resolved</button>`
    : `<span style="font-size:.75rem;color:var(--gray-400)">✔ Resolved</span>`

  return `
    <div class="item-card" style="border-top:4px solid ${resolved?'var(--gray-400)':'var(--complaint)'}" id="c-${post.id}">
      ${imgHtml}
      <div class="card-body">
        <span class="card-badge ${resolved?'badge-resolved':'badge-complaint'}">${resolved?'✔ Resolved':'📢 Complaint'}</span>
        <div class="card-title">${esc(post.title)}</div>
        <div class="card-desc">${esc(post.desc)}</div>
        ${voteHtml}
        <div class="card-meta">
          <div class="meta-row"><span class="meta-icon">👤</span><span class="meta-key">Posted by:</span><span class="meta-val">${esc(post.name)}</span></div>
        </div>
        <div class="card-footer">
          <span class="card-date">📅 ${formatDate(post.createdAt)}</span>
          ${resolveBtn}
        </div>
      </div>
    </div>`
}

window.castVote = async function(id, voteType) {
  if (voted[id]) return
  voted[id] = voteType
  try {
    const field = voteType === 'up' ? 'upvotes' : 'downvotes'
    await updateDoc(doc(db, 'complaints', id), { [field]: increment(1) })

    const upEl    = document.getElementById(`cup-${id}`)
    const downEl  = document.getElementById(`cdown-${id}`)
    const scoreEl = document.getElementById(`cscore-${id}`)

    if (upEl && voteType === 'up')     upEl.textContent   = parseInt(upEl.textContent)   + 1
    if (downEl && voteType === 'down') downEl.textContent = parseInt(downEl.textContent) + 1

    if (scoreEl) {
      const score = parseInt(upEl?.textContent||0) - parseInt(downEl?.textContent||0)
      scoreEl.textContent = (score>0?'+':'') + score
      scoreEl.className   = `vote-score ${score>0?'pos':score<0?'neg':''}`
    }

    const card = document.getElementById(`c-${id}`)
    if (card) {
      card.querySelector('.vote-btn.up')?.classList.toggle('voted',   voteType==='up')
      card.querySelector('.vote-btn.down')?.classList.toggle('voted', voteType==='down')
    }
  } catch(err) { console.error('Vote failed', err) }
}

window.resolveC = async function(id) {
  if (!confirm('Mark as resolved?')) return
  try {
    await updateDoc(doc(db, 'complaints', id), { status: 'resolved' })
    const card = document.getElementById(`c-${id}`)
    if (card) { card.style.opacity = '0'; card.style.transition = 'opacity 0.3s' }
    setTimeout(() => { loadComplaints('pending'); loadComplaints('resolved') }, 300)
  } catch(err) { alert('Could not resolve. Try again.') }
}

loadComplaints('pending')
loadComplaints('resolved')
