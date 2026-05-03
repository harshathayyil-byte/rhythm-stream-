import { useEffect, useState } from 'react'
import { getChart, getStreamUrl, searchMusic, addFavorite, getFavorites, removeFavorite, login, register, getMe, type Track } from './services/api' 
import './styles/global.css'

export default function App() {
  const [user, setUser] = useState<any>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' })
  
  const [topTracks, setTopTracks] = useState<Track[]>([])
  const [searchResults, setSearchResults] = useState<Track[]>([])
  const [favorites, setFavorites] = useState<Track[]>([])
  const [isViewingFavorites, setIsViewingFavorites] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [lastSearchQuery, setLastSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoadingStream, setIsLoadingStream] = useState(false)
  const [progress, setProgress] = useState(0)
  const [audio] = useState(new Audio())

  // Audio event listeners
  useEffect(() => {
    const handleEnded = () => setIsPlaying(false)
    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100)
      }
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [audio])

  // Initial load
  useEffect(() => {
    const init = async () => {
      // Check for token
      const token = localStorage.getItem('token')
      if (token) {
        try {
          const userData = await getMe()
          setUser(userData)
        } catch (error) {
          localStorage.removeItem('token')
        }
      }

      try {
        const chartData = await getChart()
        if (chartData && chartData.tracks && chartData.tracks.data) {
          setTopTracks(chartData.tracks.data)
        }
      } catch (error) {
        console.error('Error fetching charts:', error)
      }
    }
    init()
  }, [])

  // Fetch favorites when user changes or viewing favorites
  useEffect(() => {
    if (user) {
      fetchFavorites()
    } else {
      setFavorites([])
    }
  }, [user])

  const fetchFavorites = async () => {
    try {
      const data = await getFavorites()
      const mappedFavorites = data.map((f: any) => ({
        id: f.track_id,
        title: f.track_title,
        artist: { name: f.artist_name },
        album: { cover_medium: f.album_cover, title: '' },
      }))
      setFavorites(mappedFavorites)
    } catch (error) {
      console.error('Error fetching favorites:', error)
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (authMode === 'register') {
        const data = await register(authForm)
        localStorage.setItem('token', data.access_token)
      } else {
        const params = new URLSearchParams()
        params.append('username', authForm.username)
        params.append('password', authForm.password)
        const data = await login(params)
        localStorage.setItem('token', data.access_token)
      }
      const userData = await getMe()
      setUser(userData)
      setShowAuth(false)
      setAuthForm({ username: '', email: '', password: '' })
    } catch (error: any) {
      alert(error.message)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setIsViewingFavorites(false)
  }

  const toggleFavorite = async (e: React.MouseEvent, track: Track) => {
    e.stopPropagation()
    if (!user) {
      setShowAuth(true)
      return
    }

    const isFav = favorites.some(f => f.id === track.id)
    try {
      if (isFav) {
        await removeFavorite(track.id)
      } else {
        await addFavorite({
          track_id: track.id,
          track_title: track.title,
          artist_name: track.artist.name,
          album_cover: track.album.cover_medium
        })
      }
      await fetchFavorites()
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults([])
      setHasSearched(false)
      return
    }

    try {
      setIsSearching(true)
      setHasSearched(true)
      setLastSearchQuery(searchQuery)
      const data = await searchMusic(searchQuery)
      if (data && data.data) {
        setSearchResults(data.data)
      } else {
        setSearchResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const playTrack = async (track: Track) => {
    if (currentTrack?.id === track.id) {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        audio.play()
        setIsPlaying(true)
      }
    } else {
      try {
        setIsLoadingStream(true)
        setIsPlaying(false)
        setCurrentTrack(track)
        
        const { url } = await getStreamUrl(track.id)
        audio.src = url
        await audio.play()
        setIsPlaying(true)
      } catch (error) {
        console.error('Error playing track:', error)
        alert('Could not stream this track.')
      } finally {
        setIsLoadingStream(false)
      }
    }
  }

  const resetHome = () => {
    setSearchResults([])
    setSearchQuery('')
    setHasSearched(false)
    setIsViewingFavorites(false)
  }

  const tracksToDisplay = isViewingFavorites ? favorites : (hasSearched ? searchResults : topTracks)
  const titleText = isViewingFavorites 
    ? 'Your Favorites'
    : (hasSearched 
        ? (isSearching ? `Searching for "${lastSearchQuery}"...` : `Results for "${lastSearchQuery}"`) 
        : 'Top Tracks')

  return (
    <div className="app-container">
      <nav className="glass sidebar">
        <h1 className="vibrant-text" onClick={resetHome} style={{ cursor: 'pointer' }}>Rhythm Stream</h1>
        <ul className="nav-links">
          <li><a href="#" className={!isViewingFavorites && !hasSearched ? 'active' : ''} onClick={resetHome}>Home</a></li>
          <li><a href="#" onClick={() => document.getElementById('search-input')?.focus()}>Search</a></li>
          <li><a href="#" className={isViewingFavorites ? 'active' : ''} onClick={() => {
            if (!user) setShowAuth(true)
            else setIsViewingFavorites(true)
          }}>Favorites</a></li>
          {user ? (
            <li><a href="#" onClick={handleLogout}>Logout ({user.username})</a></li>
          ) : (
            <li><a href="#" onClick={() => setShowAuth(true)}>Login</a></li>
          )}
        </ul>
      </nav>
      
      <main className="content">
        <form className="glass search-bar" onSubmit={handleSearch}>
          <input 
            id="search-input"
            type="text" 
            placeholder="Search for any song or artist..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="vibrant-button" disabled={isSearching}>
            {isSearching ? '...' : 'Search'}
          </button>
        </form>
        
        {!hasSearched && !isViewingFavorites && (
          <section className="hero glass">
            <div className="hero-content">
              <h2 className="vibrant-text">Listen to the rhythm.</h2>
              <p>Explore millions of tracks and stream them directly from YouTube.</p>
            </div>
          </section>
        )}
        
        <section className="browse-section">
          <h3>{titleText}</h3>
          <div className="grid track-grid">
            {tracksToDisplay.length > 0 ? (
              tracksToDisplay.map((track) => (
                <div key={track.id} className={`glass track-card ${currentTrack?.id === track.id ? 'active' : ''}`} onClick={() => playTrack(track)}>
                  <img src={track.album?.cover_medium || 'https://via.placeholder.com/250'} alt={track.album?.title} />
                  <div className="track-card-info">
                    <span className="track-title">{track.title}</span>
                    <span className="artist-name">{track.artist?.name}</span>
                  </div>
                  <button className="favorite-btn" onClick={(e) => toggleFavorite(e, track)}>
                    {favorites.some(f => f.id === track.id) ? '❤️' : '🤍'}
                  </button>
                  <button className="play-overlay">
                    {isLoadingStream && currentTrack?.id === track.id ? '⌛' : (currentTrack?.id === track.id && isPlaying ? '⏸' : '▶')}
                  </button>
                </div>
              ))
            ) : (
              <div className="no-results">
                {isSearching ? (
                  <p className="loading-placeholder">Searching the musical galaxy...</p>
                ) : (
                  <p>
                    {isViewingFavorites 
                      ? "You haven't added any favorites yet." 
                      : (hasSearched ? 'No songs found for your search. Try another artist or track name!' : 'Loading top tracks...')}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      {showAuth && (
        <div className="modal-overlay" onClick={() => setShowAuth(false)}>
          <div className="glass auth-modal" onClick={e => e.stopPropagation()}>
            <h2 className="vibrant-text">{authMode === 'login' ? 'Welcome Back' : 'Join Rhythm Stream'}</h2>
            <form onSubmit={handleAuth}>
              <input 
                type="text" 
                placeholder={authMode === 'login' ? "Username or Email" : "Username"} 
                value={authForm.username}
                onChange={e => setAuthForm({...authForm, username: e.target.value})}
                required
              />
              {authMode === 'register' && (
                <input 
                  type="email" 
                  placeholder="Email" 
                  value={authForm.email}
                  onChange={e => setAuthForm({...authForm, email: e.target.value})}
                  required
                />
              )}
              <input 
                type="password" 
                placeholder="Password" 
                value={authForm.password}
                onChange={e => setAuthForm({...authForm, password: e.target.value})}
                required
              />
              <button type="submit" className="vibrant-button">{authMode === 'login' ? 'Login' : 'Sign Up'}</button>
            </form>
            <p onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
              {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Login"}
            </p>
          </div>
        </div>
      )}
      
      <footer className="glass music-player">
        <div className="player-controls">
          <div className="track-info">
            {currentTrack ? (
              <>
                <img src={currentTrack.album?.cover_medium} alt={currentTrack.album?.title} className={`album-art ${isLoadingStream ? 'loading-pulse' : ''}`} />
                <div className="metadata">
                  <span className="track-name">{currentTrack.title}</span>
                  <span className="artist-name">{currentTrack.artist?.name} {isLoadingStream && '(Fetching Audio...)'}</span>
                </div>
              </>
            ) : (
              <>
                <div className="album-art placeholder"></div>
                <div className="metadata">
                  <span className="track-name">No track playing</span>
                  <span className="artist-name">Select a track</span>
                </div>
              </>
            )}
          </div>
          <div className="playback-bar">
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ 
                width: `${progress}%`,
                transition: isLoadingStream ? 'width 2s ease-in-out' : 'width 0.1s linear'
              }}></div>
            </div>
          </div>
          <button className="vibrant-button" disabled={isLoadingStream || !currentTrack} onClick={() => currentTrack && playTrack(currentTrack)}>
            {isLoadingStream ? '⌛' : (isPlaying ? 'Pause' : 'Play')}
          </button>
        </div>
      </footer>
      
      <style>{`
        .app-container {
          display: flex;
          min-height: 100vh;
          padding-bottom: 120px;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .auth-modal {
          padding: 3rem;
          width: 400px;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          text-align: center;
        }

        .auth-modal form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .auth-modal input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--glass-border);
          padding: 1rem;
          border-radius: 8px;
          color: white;
          outline: none;
        }

        .auth-modal p {
          cursor: pointer;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .auth-modal p:hover {
          color: var(--accent-color);
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .loading-pulse {
          animation: pulse 1.5s infinite ease-in-out;
        }

        .track-card.active {
          border: 1px solid var(--accent-color);
          background: rgba(255, 0, 204, 0.1);
        }
        
        .sidebar {
          width: 250px;
          height: calc(100vh - 2rem);
          position: sticky;
          top: 1rem;
          padding: 2rem;
          margin: 1rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          z-index: 10;
        }
        
        .nav-links {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        
        .nav-links a {
          font-size: 1.1rem;
          transition: color 0.3s ease;
          color: white;
          text-decoration: none;
        }
        
        .nav-links a:hover {
          color: var(--accent-color);
        }
        
        .nav-links a.active {
          color: var(--accent-color);
          font-weight: bold;
        }
        
        .favorite-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 50%;
          width: 35px;
          height: 35px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          opacity: 0;
          transition: opacity 0.3s ease, transform 0.2s ease;
          z-index: 5;
          border: none;
          cursor: pointer;
        }

        .track-card:hover .favorite-btn {
          opacity: 1;
        }

        .favorite-btn:hover {
          transform: scale(1.2);
        }

        .content {
          flex: 1;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        
        .search-bar {
          padding: 1rem;
          display: flex;
          gap: 1rem;
        }
        
        .search-bar input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: white;
          font-size: 1rem;
        }
        
        .vibrant-button {
          background: linear-gradient(90deg, var(--accent-color), var(--accent-secondary));
          padding: 0.5rem 1.5rem;
          border-radius: 20px;
          font-weight: bold;
          transition: transform 0.2s ease;
          min-width: 100px;
          color: white;
          border: none;
          cursor: pointer;
        }

        .vibrant-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .vibrant-button:hover:not(:disabled) {
          transform: scale(1.05);
        }
        
        .hero {
          padding: 3rem;
          display: flex;
          align-items: center;
          background: linear-gradient(45deg, rgba(255, 0, 204, 0.1), rgba(51, 51, 255, 0.1));
        }
        
        .hero-content h2 {
          font-size: 3rem;
          margin-bottom: 1rem;
        }
        
        .hero-content p {
          font-size: 1.2rem;
          color: var(--text-secondary);
        }
        
        .browse-section h3 {
          font-size: 1.5rem;
          margin-bottom: 1.5rem;
        }
        
        .track-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 1.5rem;
        }

        .track-card {
          padding: 1rem;
          cursor: pointer;
          transition: transform 0.3s ease, background 0.3s ease;
          position: relative;
        }

        .track-card:hover {
          transform: translateY(-5px);
          background: rgba(255, 255, 255, 0.15);
        }

        .track-card img {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 8px;
          margin-bottom: 1rem;
        }

        .track-card-info {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .track-title {
          font-weight: bold;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .artist-name {
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .play-overlay {
          position: absolute;
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--accent-color);
          width: 50px;
          height: 50px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          opacity: 0;
          transition: opacity 0.3s ease;
          border: none;
          color: white;
          cursor: pointer;
        }

        .track-card:hover .play-overlay {
          opacity: 1;
        }

        .no-results {
          grid-column: 1 / -1;
          text-align: center;
          padding: 3rem;
          color: var(--text-secondary);
        }
        
        .music-player {
          position: fixed;
          bottom: 1rem;
          left: 1rem;
          right: 1rem;
          padding: 1rem;
          height: 100px;
          z-index: 100;
        }
        
        .player-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 100%;
          gap: 2rem;
        }
        
        .track-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          width: 300px;
        }
        
        .track-info img {
          width: 60px;
          height: 60px;
          border-radius: 8px;
          object-fit: cover;
        }

        .album-art.placeholder {
          width: 60px;
          height: 60px;
          background: var(--tertiary-bg);
          border-radius: 8px;
        }
        
        .metadata {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .metadata .track-name {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: bold;
        }
        
        .playback-bar {
          flex: 1;
        }
        
        .progress-bar-bg {
          width: 100%;
          height: 6px;
          background: var(--glass-border);
          border-radius: 3px;
          overflow: hidden;
        }
        
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-color), var(--accent-secondary));
          transition: width 0.1s linear;
        }
      `}</style>
    </div>
  )
}
