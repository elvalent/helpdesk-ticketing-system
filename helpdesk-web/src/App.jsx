import { useState, useEffect, useMemo } from 'react'
import axios from 'axios'

const API = 'http://127.0.0.1:8000/api'

function App() {
  const [token, setToken] = useState(sessionStorage.getItem('token') || '')
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('user') || 'null') } catch { return null }
  })
  const [isRegister, setIsRegister] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('user')
  const [tickets, setTickets] = useState(() => {
    try {
      const u = JSON.parse(sessionStorage.getItem('user') || 'null')
      if (!u) return []
      return JSON.parse(sessionStorage.getItem(`tickets_cache_${u.id}`) || '[]')
    } catch { return [] }
  })
  const [isLoadingTickets, setIsLoadingTickets] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [msg, setMsg] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAddIT, setShowAddIT] = useState(false)
  const [newITName, setNewITName] = useState('')
  const [newITEmail, setNewITEmail] = useState('')
  const [newITPassword, setNewITPassword] = useState('')
  const [addITMsg, setAddITMsg] = useState('')

  const getCacheKey = (userObj) => userObj ? `tickets_cache_${userObj.id}` : 'tickets_cache'
  const saveCache = (data, userObj = user) => {
    setTickets(data)
    try { sessionStorage.setItem(getCacheKey(userObj), JSON.stringify(data)) } catch {}
  }
  const loadTickets = async (showSkeleton = true) => {
    if (!token) return
    const hasCache = tickets.length > 0
    if (showSkeleton && !hasCache) setIsLoadingTickets(true)
    try {
      const res = await axios.get(`${API}/tickets`, { headers: { Authorization: `Bearer ${token}` } })
      saveCache(res.data)
    } catch {} finally { setIsLoadingTickets(false) }
  }
  useEffect(() => { if (token) loadTickets(false) }, [token])

  const handleAuth = async (e) => {
    e.preventDefault()
    sessionStorage.removeItem('token'); sessionStorage.removeItem('user'); setTickets([])
    try {
      const url = isRegister ? `${API}/register` : `${API}/login`
      const body = isRegister ? { name, email, password, role } : { email, password }
      const res = await axios.post(url, body)
      const newUser = res.data.user
      setToken(res.data.token); setUser(newUser)
      sessionStorage.setItem('token', res.data.token); sessionStorage.setItem('user', JSON.stringify(newUser))
      try { setTickets(JSON.parse(sessionStorage.getItem(getCacheKey(newUser)) || '[]')) } catch { setTickets([]) }
      setMsg('Berhasil masuk sebagai ' + newUser.name)
      setEmail(''); setPassword(''); setName('')
    } catch (err) {
      setMsg(err.response?.data?.message || err.response?.data?.errors?.email?.[0] || 'Gagal, cek input kamu')
      setToken(''); setUser(null)
    }
  }

  const handleAddIT = async (e) => {
    e.preventDefault(); setAddITMsg('')
    if (!newITName.trim() || !newITEmail.trim() || !newITPassword.trim()) { setAddITMsg('Semua field wajib diisi'); return }
    try {
      const res = await axios.post(`${API}/register`, { name: newITName, email: newITEmail, password: newITPassword, role: 'it' })
      setAddITMsg('✅ Berhasil! Akun IT ' + res.data.user.name + ' sudah dibuat.')
      setNewITName(''); setNewITEmail(''); setNewITPassword('')
    } catch (err) { setAddITMsg('❌ Gagal: ' + (err.response?.data?.message || err.response?.data?.errors?.email?.[0] || 'Email sudah dipakai')) }
  }

  const createTicket = async (e) => {
    e.preventDefault()
    if (!title.trim() || isSending) return
    const tempId = Date.now()
    const tempTicket = { id: tempId, title, description, priority, status: 'open', handled_by: null, handler: null, user: { name: user?.name }, created_at: new Date().toISOString(), _sending: true }
    const newList = [tempTicket, ...tickets]
    saveCache(newList)
    setTitle(''); setDescription(''); setMsg(''); setIsSending(true)
    try {
      const res = await axios.post(`${API}/tickets`, { title: tempTicket.title, description: tempTicket.description, priority: tempTicket.priority }, { headers: { Authorization: `Bearer ${token}` } })
      saveCache(newList.map(t => t.id === tempId ? res.data : t))
      setMsg('Tiket berhasil dikirim ke tim IT.')
    } catch {
      saveCache(tickets.filter(t => t.id !== tempId)); setMsg('Gagal bikin tiket, coba lagi')
    } finally { setIsSending(false) }
  }

  const updateStatus = async (id, status) => {
    const oldTickets = tickets
    // Optimistic: langsung kunci ke gua kalo gua yang ambil
    saveCache(tickets.map(t => t.id === id ? { ...t, status, handled_by: status === 'in_progress' ? user?.id : t.handled_by, handler: status === 'in_progress' ? { id: user?.id, name: user?.name } : t.handler } : t))
    try {
      const res = await axios.put(`${API}/tickets/${id}`, { status }, { headers: { Authorization: `Bearer ${token}` } })
      setTickets(prev => {
        const next = prev.map(t => t.id === id ? res.data : t)
        try { sessionStorage.setItem(getCacheKey(user), JSON.stringify(next)) } catch {}
        return next
      })
      if (status === 'in_progress') setMsg('Tiket berhasil kamu ambil. Tiket ini sekarang terkunci untuk kamu.')
      if (status === 'resolved') setMsg('Tiket selesai. User sudah bisa liat namamu sebagai penyelesai.')
    } catch (err) {
      saveCache(oldTickets)
      setMsg('Gagal ubah status: ' + (err.response?.data?.message || 'cek backend'))
    }
  }

  const logout = async () => {
    try { await axios.post(`${API}/logout`, {}, { headers: { Authorization: `Bearer ${token}` } }) } catch {}
    setToken(''); setUser(null); sessionStorage.removeItem('token'); sessionStorage.removeItem('user')
    setTickets([]); setEmail(''); setPassword(''); setName(''); setIsRegister(false); setShowAddIT(false)
  }

  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter(t => t.status === 'open').length
    const progress = tickets.filter(t => t.status === 'in_progress').length
    const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length
    const rate = total === 0 ? 0 : Math.round((resolved / total) * 100)
    const high = tickets.filter(t => t.priority === 'high').length
    const medium = tickets.filter(t => t.priority === 'medium').length
    const low = tickets.filter(t => t.priority === 'low').length
    return { total, open, progress, resolved, rate, high, medium, low }
  }, [tickets])

  const chartData = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('id-ID', { weekday: 'short' }) + ' ' + d.getDate()
      const masuk = tickets.filter(t => (t.created_at || '').slice(0, 10) === key).length
      const selesai = tickets.filter(t => (t.status === 'resolved' || t.status === 'closed') && ((t.updated_at || t.created_at || '').slice(0, 10) === key)).length
      days.push({ label, masuk, selesai })
    }
    return days
  }, [tickets])
  const maxChart = Math.max(1, ...chartData.map(d => Math.max(d.masuk, d.selesai)))
  const filteredTickets = useMemo(() => {
    let list = [...tickets].sort((a, b) => b.id - a.id)
    if (filterStatus !== 'all') list = list.filter(t => t.status === filterStatus)
    return list
  }, [tickets, filterStatus])

  if (!token) {
    return (
      <div className="page">
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ width: 52, height: 52, background: '#4B2E2B', color: 'white', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, margin: '0 auto 14px' }}>H</div>
            <h1 style={{ margin: 0, fontSize: 24, color: '#4B2E2B' }}>Helpdesk</h1>
            <p style={{ margin: '6px 0 0', color: '#8A7A71', fontSize: 14 }}>{isRegister ? 'Buat akun baru untuk mulai' : 'Selamat datang kembali, silakan masuk'}</p>
          </div>
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {isRegister && (<><label className="label">Nama Lengkap</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Contoh: Kiel Andrian" className="input" /></>)}
            <label className="label">Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" className="input" />
            <label className="label">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="input" />
            {isRegister && (<><label className="label">Daftar Sebagai</label><select value={role} onChange={e => setRole(e.target.value)} className="input"><option value="user">User - Pengaju Tiket</option><option value="it">IT Support - Penanganan Tiket</option></select></>)}
            <button className="btn" style={{ marginTop: 6 }}>{isRegister ? 'Buat Akun' : 'Masuk'}</button>
          </form>
          {msg && <p style={{ background: '#FDECEC', color: '#8B2E2E', padding: '10px 12px', borderRadius: 10, fontSize: 13, textAlign: 'center' }}>{msg}</p>}
          <p onClick={() => { setIsRegister(!isRegister); setMsg(''); setEmail(''); setPassword(''); setName('') }} style={{ textAlign: 'center', color: '#7A5C4F', fontSize: 14, cursor: 'pointer', marginTop: 18, fontWeight: 500 }}>{isRegister ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}</p>
        </div>
      </div>
    )
  }

  if (user?.role === 'it') {
    return (
      <div style={{ minHeight: '100vh', background: '#F5EFE6', color: '#3E2F2A' }}>
        <div className="dash-wrap" style={{ maxWidth: 980 }}>
          <div className="dash-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <p style={{ margin: 0, color: '#8A7A71', fontSize: 13 }}>Helpdesk • Tim IT</p>
              <h1 style={{ margin: '4px 0 0', color: '#4B2E2B', fontSize: 26 }}>Dashboard IT </h1>
              <p style={{ margin: '6px 0 0', color: '#8A7A71', fontSize: 14 }}>Login sebagai: <b style={{ color: '#4B2E2B' }}>{user?.name} • {user?.email}</b></p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowAddIT(!showAddIT)} style={{ background: '#4B2E2B', border: 'none', padding: '9px 16px', borderRadius: 999, cursor: 'pointer', color: 'white', fontWeight: 600 }}>+ Tambah Akun IT</button>
              <button onClick={logout} style={{ background: 'white', border: '1px solid #E8DDD0', padding: '9px 16px', borderRadius: 999, cursor: 'pointer', color: '#4B2E2B', fontWeight: 600 }}>Keluar</button>
            </div>
          </div>
          {showAddIT && (
            <div style={{ background: '#FFFDF9', borderRadius: 16, padding: 18, border: '1px solid #E8DDD0', marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 12px', color: '#4B2E2B' }}>Buat Akun IT Baru</h3>
              <form onSubmit={handleAddIT} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input value={newITName} onChange={e => setNewITName(e.target.value)} placeholder="Nama IT baru" className="input" />
                <input value={newITEmail} onChange={e => setNewITEmail(e.target.value)} placeholder="Email baru, contoh: it2@kampus.ac.id" className="input" />
                <input type="password" value={newITPassword} onChange={e => setNewITPassword(e.target.value)} placeholder="Password" className="input" />
                <button className="btn">Buat Akun IT</button>
              </form>
              {addITMsg && <p style={{ background: addITMsg.includes('✅') ? '#EAF6EC' : '#FDECEC', color: addITMsg.includes('✅') ? '#2E6B3A' : '#8B2E2E', padding: '10px 12px', borderRadius: 10, fontSize: 13, marginTop: 12 }}>{addITMsg}</p>}
            </div>
          )}
          {msg && <div style={{ background: '#EAF6EC', color: '#2E6B3A', padding: '11px 14px', borderRadius: 12, fontSize: 14, marginBottom: 16 }}>{msg}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Total Tiket', value: stats.total, sub: 'Tiket saya + belum diambil', bg: '#FFFDF9', color: '#4B2E2B' },
              { label: 'Belum Ditangani', value: stats.open, sub: 'Bisa diambil', bg: '#FDECEC', color: '#8B2E2E' },
              { label: 'Sedang Saya Kerjakan', value: stats.progress, sub: 'In Progress', bg: '#FFF3D6', color: '#7A5C00' },
              { label: 'Selesai', value: stats.resolved, sub: `${stats.rate}% terselesaikan`, bg: '#EAF6EC', color: '#2E6B3A' },
            ].map((c, i) => (
              <div key={i} style={{ background: c.bg, borderRadius: 16, padding: 16, border: '1px solid #E8DDD0' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#8A7A71', fontWeight: 600 }}>{c.label}</p>
                <h2 style={{ margin: '6px 0 2px', fontSize: 32, color: c.color, lineHeight: 1 }}>{c.value}</h2>
                <p style={{ margin: 0, fontSize: 12, color: '#8A7A71' }}>{c.sub}</p>
              </div>
            ))}
          </div>
          <div style={{ background: '#FFFDF9', borderRadius: 16, padding: 18, border: '1px solid #E8DDD0', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><b style={{ color: '#4B2E2B', fontSize: 14 }}>Tingkat Penyelesaian</b><b style={{ color: '#4B2E2B', fontSize: 14 }}>{stats.rate}%</b></div>
            <div style={{ height: 10, background: '#F5EFE6', borderRadius: 999, overflow: 'hidden' }}><div style={{ height: '100%', width: `${stats.rate}%`, background: '#4B2E2B', borderRadius: 999 }} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#FFFDF9', borderRadius: 16, padding: 18, border: '1px solid #E8DDD0' }}>
              <b style={{ color: '#4B2E2B', fontSize: 14 }}>Performa 7 Hari Terakhir</b>
              <p style={{ margin: '4px 0 16px', fontSize: 12, color: '#8A7A71' }}><span style={{ color: '#C9A86A' }}>■</span> Masuk &nbsp; <span style={{ color: '#4B2E2B' }}>■</span> Selesai</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 140 }}>
                {chartData.map((d, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110, width: '100%', justifyContent: 'center' }}>
                      <div style={{ width: 16, height: `${Math.max(4, (d.masuk / maxChart) * 100)}%`, background: '#C9A86A', borderRadius: '6px 6px 0 0' }} />
                      <div style={{ width: 16, height: `${Math.max(4, (d.selesai / maxChart) * 100)}%`, background: '#4B2E2B', borderRadius: '6px 6px 0 0' }} />
                    </div>
                    <div style={{ fontSize: 10, color: '#8A7A71', textAlign: 'center' }}>{d.label}<br /><b style={{ color: '#4B2E2B' }}>{d.masuk} / {d.selesai}</b></div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: '#FFFDF9', borderRadius: 16, padding: 18, border: '1px solid #E8DDD0' }}>
              <b style={{ color: '#4B2E2B', fontSize: 14 }}>Berdasarkan Prioritas</b>
              {[
                { label: 'Tinggi - Mendesak', val: stats.high, total: stats.total, color: '#B42318' },
                { label: 'Sedang', val: stats.medium, total: stats.total, color: '#C9A86A' },
                { label: 'Rendah', val: stats.low, total: stats.total, color: '#2E6B3A' },
              ].map((p, i) => (
                <div key={i} style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}><span>{p.label}</span><b>{p.val}</b></div>
                  <div style={{ height: 8, background: '#F5EFE6', borderRadius: 999, overflow: 'hidden' }}><div style={{ height: '100%', width: `${p.total ? (p.val / p.total) * 100 : 0}%`, background: p.color }} /></div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <h3 style={{ color: '#4B2E2B', margin: 0 }}>Tiket Saya & Belum Diambil <span style={{ background: '#4B2E2B', color: 'white', fontSize: 12, padding: '3px 9px', borderRadius: 999 }}>{filteredTickets.length}</span></h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['all', 'open', 'in_progress', 'resolved'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '7px 13px', borderRadius: 999, border: '1px solid #E8DDD0', background: filterStatus === s ? '#4B2E2B' : 'white', color: filterStatus === s ? 'white' : '#4B2E2B', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{s === 'all' ? 'Semua' : s.replace('_', ' ')}</button>
              ))}
              <button onClick={() => loadTickets(true)} style={{ padding: '7px 13px', borderRadius: 999, border: '1px solid #E8DDD0', background: 'white', color: '#4B2E2B', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>↻ Refresh</button>
            </div>
          </div>
          {filteredTickets.map(t => (
            <div key={t.id} style={{ background: '#FFFDF9', borderRadius: 16, padding: 18, marginBottom: 12, border: '1px solid #E8DDD0' }}>
              <div className="ticket-top" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><b style={{ color: '#4B2E2B' }}>{t.title}</b><span style={{ fontSize: 12, background: t.status === 'resolved' ? '#EAF6EC' : t.status === 'in_progress' ? '#FFF3D6' : '#F5EFE6', color: '#4B2E2B', padding: '4px 10px', borderRadius: 999, height: 'fit-content', whiteSpace: 'nowrap' }}>{t.status}</span></div>
              <p style={{ color: '#8A7A71', fontSize: 14, lineHeight: 1.6, margin: '8px 0' }}>{t.description}</p>
              <small style={{ color: '#8A7A71' }}>Dari: {t.user?.name} • Prioritas: {t.priority}</small>
              {t.handler && <div style={{ marginTop: 8, background: '#F5EFE6', padding: '8px 10px', borderRadius: 10, fontSize: 13 }}>👨‍💻 Ditangani oleh: <b style={{ color: '#4B2E2B' }}>{t.handler.name}</b> {t.handler.id === user?.id ? '(Kamu)' : ''}</div>}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select value={t.status} onChange={e => updateStatus(t.id, e.target.value)} className="input" style={{ width: 'auto', padding: '9px 10px' }}><option value="open">Open - Lepas</option><option value="in_progress">In Progress - Ambil</option><option value="resolved">Resolved - Selesai</option><option value="closed">Closed</option></select>
                {t.status === 'open' && <button onClick={() => updateStatus(t.id, 'in_progress')} style={{ background: '#4B2E2B', color: 'white', border: 'none', padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>▶ Ambil Tiket</button>}
                {t.status === 'in_progress' && <button onClick={() => updateStatus(t.id, 'resolved')} style={{ background: '#2E6B3A', color: 'white', border: 'none', padding: '9px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>✓ Tandai Selesai</button>}
              </div>
            </div>
          ))}
          {filteredTickets.length === 0 && <div style={{ background: '#FFFDF9', padding: 22, borderRadius: 16, textAlign: 'center', color: '#8A7A71', border: '1px solid #E8DDD0' }}>Nggak ada tiket. Tiket yang udah diambil IT lain nggak muncul di sini (anti bocor).</div>}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5EFE6', color: '#3E2F2A' }}>
      <div className="dash-wrap">
        <div className="dash-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <p style={{ margin: 0, color: '#8A7A71', fontSize: 13 }}>Helpdesk • Pengguna</p>
            <h1 style={{ margin: '4px 0 0', color: '#4B2E2B', fontSize: 26 }}>Halo, {user?.name} </h1>
            <p style={{ margin: '6px 0 0', color: '#8A7A71', fontSize: 14 }}>{user?.email}</p>
          </div>
          <button onClick={logout} style={{ background: 'white', border: '1px solid #E8DDD0', padding: '9px 16px', borderRadius: 999, cursor: 'pointer', color: '#4B2E2B', fontWeight: 600 }}>Keluar</button>
        </div>
        {msg && <div style={{ background: '#EAF6EC', color: '#2E6B3A', padding: '11px 14px', borderRadius: 12, fontSize: 14, marginBottom: 18 }}>{msg}</div>}
        <div style={{ background: '#FFFDF9', borderRadius: 18, padding: 22, border: '1px solid #E8DDD0', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 14px', color: '#4B2E2B' }}>Buat Tiket Baru</h3>
          <form onSubmit={createTicket} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Judul masalah" className="input" />
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Ceritakan detail masalahnya..." rows={3} className="input" style={{ resize: 'vertical' }} />
            <select value={priority} onChange={e => setPriority(e.target.value)} className="input"><option value="low">Prioritas: Rendah</option><option value="medium">Prioritas: Sedang</option><option value="high">Prioritas: Tinggi - Mendesak</option></select>
            <button className="btn" disabled={isSending} style={{ opacity: isSending ? 0.7 : 1 }}>{isSending ? 'Mengirim...' : 'Kirim ke Tim IT'}</button>
          </form>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ color: '#4B2E2B', margin: 0 }}>Tiket Saya <span style={{ background: '#4B2E2B', color: 'white', fontSize: 12, padding: '3px 9px', borderRadius: 999 }}>{filteredTickets.length}</span></h3>
          <button onClick={() => loadTickets(true)} style={{ padding: '7px 13px', borderRadius: 999, border: '1px solid #E8DDD0', background: 'white', color: '#4B2E2B', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>↻ Refresh</button>
        </div>
        {filteredTickets.map(t => (
          <div key={t.id} style={{ background: '#FFFDF9', borderRadius: 16, padding: 18, marginBottom: 12, border: '1px solid #E8DDD0' }}>
            <div className="ticket-top" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><b style={{ color: '#4B2E2B' }}>{t.title}</b><span style={{ fontSize: 12, background: t.status === 'resolved' ? '#EAF6EC' : t.status === 'in_progress' ? '#FFF3D6' : '#F5EFE6', color: '#4B2E2B', padding: '4px 10px', borderRadius: 999, height: 'fit-content', whiteSpace: 'nowrap' }}>{t.status}</span></div>
            <p style={{ color: '#8A7A71', fontSize: 14, lineHeight: 1.6, margin: '8px 0' }}>{t.description}</p>
            <small style={{ color: '#8A7A71' }}>Prioritas: {t.priority}</small>
            {!t.handler && t.status === 'open' && <div style={{ marginTop: 10, background: '#F5EFE6', padding: '10px 12px', borderRadius: 10, fontSize: 13, color: '#8A7A71' }}>⏳ Menunggu IT mengambil tiketmu...</div>}
            {t.handler && t.status === 'in_progress' && <div style={{ marginTop: 10, background: '#FFF3D6', padding: '10px 12px', borderRadius: 10, fontSize: 13, color: '#4B2E2B' }}>👨‍💻 <b>Dikerjakan oleh: {t.handler.name}</b><br /><span style={{ color: '#8A7A71' }}>Tiketmu lagi ditangani {t.handler.name}, tunggu ya.</span></div>}
            {t.handler && (t.status === 'resolved' || t.status === 'closed') && <div style={{ marginTop: 10, background: '#EAF6EC', padding: '10px 12px', borderRadius: 10, fontSize: 13, color: '#2E6B3A' }}>✅ <b>Diselesaikan oleh: {t.handler.name}</b><br /><span style={{ color: '#8A7A71' }}>Masalahmu sudah diselesaikan oleh {t.handler.name}.</span></div>}
          </div>
        ))}
        {filteredTickets.length === 0 && <div style={{ background: '#FFFDF9', padding: 22, borderRadius: 16, textAlign: 'center', color: '#8A7A71', border: '1px solid #E8DDD0' }}>Belum ada tiket.</div>}
      </div>
    </div>
  )
}

export default App