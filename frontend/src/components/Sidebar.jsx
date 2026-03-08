import React, { useState } from 'react';
import { Search, MapPin, Star } from 'lucide-react';

const Sidebar = ({ movies, selectedMovieId, onMovieSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter movies by search term (title or location)
  const filteredMovies = movies.filter(movie => {
    const term = searchTerm.toLowerCase();
    return (
      (movie.title && movie.title.toLowerCase().includes(term)) ||
      (movie.location_name && movie.location_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="sidebar glass-panel">
      <div className="sidebar-header">
        <h2>My Movie Globe ({movies.length})</h2>
        <div style={{ position: 'relative' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)'
            }}
          />
          <input
            type="text"
            className="search-input"
            placeholder="Search movie or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      <div className="movie-list">
        {filteredMovies.map((movie) => (
          <div
            key={movie.id}
            className={`movie-card ${selectedMovieId === movie.id ? 'active' : ''}`}
            onClick={() => onMovieSelect(movie)}
          >
            <img
              src={movie.cover_url || ''}
              alt={movie.title}
              className="movie-cover"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <div className="movie-info">
              <div className="movie-title">{movie.title}</div>
              <div className="movie-meta">
                <span>{movie.year || 'N/A'}</span>
                {movie.douban_rating && (
                  <span className="rating-badge">豆瓣 ★ {movie.douban_rating}</span>
                )}
                {movie.imdb_rating && (
                  <span className="rating-badge">IMDb ★ {movie.imdb_rating}</span>
                )}
              </div>
              <div className="movie-meta" style={{ marginTop: '0.3rem', color: 'var(--accent)' }}>
                <MapPin size={12} />
                <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {movie.location_name}
                </span>
              </div>
            </div>
          </div>
        ))}
        {filteredMovies.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 0' }}>
            No movies found.
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
