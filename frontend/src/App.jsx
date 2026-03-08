import React, { useState, useEffect } from 'react';
import GlobeView from './components/GlobeView';
import Sidebar from './components/Sidebar';
import { X, MapPin, ExternalLink } from 'lucide-react';

function App() {
  const [movies, setMovies] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [markerSize, setMarkerSize] = useState(32); // Default width 32px

  useEffect(() => {
    // Update CSS variables for marker size
    document.documentElement.style.setProperty('--marker-width', `${markerSize}px`);
    document.documentElement.style.setProperty('--marker-height', `${markerSize * 1.5}px`);
  }, [markerSize]);

  useEffect(() => {
    // Fetch the generated movie data with cache busting
    fetch(`/movies.json?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        setMovies(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load movie data:", err);
        setLoading(false);
      });
  }, []);

  const handleMovieSelect = (movie) => {
    setSelectedMovie(movie);
  };

  const closeDetails = () => {
    setSelectedMovie(null);
  };

  return (
    <div className="app-container">
      {/* 3D Globe Background */}
      <div className="globe-container">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--accent)' }}>
            Loading Global Data...
          </div>
        ) : (
          <GlobeView
            data={movies}
            selectedMovieId={selectedMovie?.id}
            onMovieSelect={handleMovieSelect}
          />
        )}

        {/* Branding Overlay */}
        <div className="globe-overlay">
          <h1>Movie Globe</h1>
          <p>{movies.length} locations around the world.</p>
        </div>

        {/* Selected Movie Modal overlaying the globe */}
        {selectedMovie && (
          <div className="selected-movie-info glass-panel">
            <button className="close-btn" onClick={closeDetails} aria-label="Close">
              <X size={24} />
            </button>
            <img
              src={selectedMovie.cover_url || ''}
              alt={selectedMovie.title}
              className="selected-cover"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <div className="selected-details">
              <h2 className="selected-title">{selectedMovie.title}</h2>
              <div className="selected-meta">
                <span>{selectedMovie.year || 'N/A'}</span>
              </div>

              <div className="selected-ratings">
                {selectedMovie.douban_rating && (
                  <div className="rating-item" title="Douban Rating">
                    <span className="rating-label">Douban</span>
                    <span className="rating-value">★ {selectedMovie.douban_rating}</span>
                  </div>
                )}
                {selectedMovie.imdb_rating && (
                  <div className="rating-item" title="IMDb Rating">
                    <span className="rating-label">IMDb</span>
                    <span className="rating-value">★ {selectedMovie.imdb_rating}</span>
                  </div>
                )}
              </div>

              <div className="selected-location">
                <MapPin size={16} />
                <span>{selectedMovie.location_name || (selectedMovie.locations && selectedMovie.locations[0]?.name) || 'Unknown Location'}</span>
              </div>

              <div className="selected-links" style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {selectedMovie.douban_id && (
                  <a
                    href={`https://movie.douban.com/subject/${selectedMovie.douban_id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link-btn douban-link"
                  >
                    Douban <ExternalLink size={14} />
                  </a>
                )}
                {selectedMovie.imdb_id && (
                  <a
                    href={`https://www.imdb.com/title/${selectedMovie.imdb_id}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="external-link-btn imdb-link"
                  >
                    IMDb <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Size Slider Overlay */}
        <div className="controls-overlay">
          <label htmlFor="size-slider">Poster Size: {markerSize}px</label>
          <input
            id="size-slider"
            type="range"
            min="16"
            max="100"
            value={markerSize}
            onChange={(e) => setMarkerSize(Number(e.target.value))}
            className="slider"
          />
        </div>
      </div>

      {/* Sidebar Movie List */}
      <Sidebar
        movies={movies}
        selectedMovieId={selectedMovie?.id}
        onMovieSelect={handleMovieSelect}
      />
    </div>
  );
}

export default App;
