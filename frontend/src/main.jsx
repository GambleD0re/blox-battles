// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

const style = document.createElement('style');
style.innerHTML = `
    :root {
        --font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        --bg-color: #010409;
        --text-color: #e6edf3;
        --text-muted: #7d8590;
        --accent-color: #58a6ff;
        --win-color: #3fb950;
        --loss-color: #f85149;
        --widget-bg: rgba(22, 27, 34, 0.75);
        --widget-border: rgba(255, 255, 255, 0.1);
        --widget-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.2);
        --input-bg: #0d1117;
        --input-border: #30363d;
        --divider-color: #21262d;
        --btn-primary-bg: #238636;
        --btn-primary-hover-bg: #2ea043;
        --btn-secondary-bg: #30363d;
        --btn-secondary-hover-bg: #484f58;
    }
    html {
        /* [FIXED] Scaled UI up slightly for better readability on standard screens. */
        font-size: 93.75%; /* 15px base */
    }
    html, body, #root {
        height: 100%;
    }
    body { background-color: var(--bg-color); color: var(--text-color); font-family: var(--font-family); margin: 0; }
    .widget { background: var(--widget-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid var(--widget-border); box-shadow: var(--widget-shadow); padding: 1.5rem; border-radius: 1rem; }
    .widget-title { margin-top: 0; margin-bottom: 1.5rem; font-size: 1.25rem; font-weight: 600; padding-bottom: 1rem; border-bottom: 1px solid var(--divider-color); }
    .dashboard-header { background: var(--widget-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid var(--widget-border); box-shadow: var(--widget-shadow); padding: 1.5rem 2rem; border-radius: 1rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
    .player-info { display: flex; align-items: center; gap: 1.5rem; }
    .player-avatar { width: 80px; height: 80px; border-radius: 50%; border: 4px solid var(--accent-color); box-shadow: 0 0 15px rgba(88, 166, 255, 0.5); object-fit: cover; }
    .player-name { font-size: 2rem; font-weight: 700; margin: 0; color: #fff; }
    .player-id { font-size: 0.9rem; color: var(--text-muted); margin: 0.25rem 0 0 0; }
    .player-stats { display: flex; align-items: center; gap: 1.5rem; }
    .stat-item { display: flex; flex-direction: column; align-items: center; text-align: center; min-width: 80px; padding: 0.5rem 1rem; border-radius: 8px; background: var(--bg-color); border: 1px solid var(--input-border); }
    .stat-value { font-size: 1.75rem; font-weight: 700; }
    .stat-label { font-size: 0.8rem; font-weight: 500; color: var(--text-muted); }
    .stat-item.gems .stat-value { color: var(--accent-color); }
    .stat-item.wins .stat-value { color: var(--win-color); }
    .stat-item.losses .stat-value { color: var(--loss-color); }
    .btn-settings { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: 1px solid var(--input-border); border-radius: 50%; background-color: var(--input-bg); color: var(--text-color); cursor: pointer; transition: all 0.2s; }
    .btn-settings:hover { border-color: var(--accent-color); color: var(--accent-color); }
    .form-group { margin-bottom: 1rem; text-align: left; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; font-size: 0.9rem; color: var(--text-muted); }
    .form-input { width: 100%; padding: 0.75rem; border: 1px solid var(--input-border); border-radius: 8px; box-sizing: border-box; font-size: 1rem; background-color: var(--input-bg); color: var(--text-color); transition: all 0.2s; }
    select.form-input { -webkit-appearance: none; -moz-appearance: none; appearance: none; background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e"); background-position: right 0.5rem center; background-repeat: no-repeat; background-size: 1.5em 1.5em; padding-right: 2.5rem; }
    .form-input:focus { outline: none; border-color: var(--accent-color); box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.2); }
    .btn { padding: 0.85rem; border: none; border-radius: 8px; color: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 1rem; transition: all 0.2s; text-decoration: none; display: inline-block; text-align: center; }
    .btn-primary { background-color: var(--btn-primary-bg); }
    .btn-primary:hover { background-color: var(--btn-primary-hover-bg); transform: translateY(-2px); box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
    .duel-item { display: flex; align-items: center; gap: 1rem; padding: 0.75rem; border-bottom: 1px solid var(--divider-color); }
    .vs-card { display: flex; justify-content: space-around; align-items: center; background-color: var(--bg-color); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem; flex-shrink: 0; }
    .player-display { text-align: center; }
    .player-display img { width: 70px; height: 70px; border-radius: 50%; border: 3px solid var(--divider-color); object-fit: cover; }
    .player-display h4 { margin: 0.5rem 0 0 0; font-weight: 600; font-size: 0.9rem; }
    .vs-text { font-size: 2rem; font-weight: 900; color: var(--text-muted); }
    .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--divider-color); }
    .btn-danger { background-color: var(--loss-color); }
    .btn-accept { background-color: var(--win-color); }
    .banned-weapons-list { list-style-type: none; padding-left: 0; margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 8px; }
    .banned-weapons-list li { background-color: var(--bg-color); padding: 5px 10px; border-radius: 6px; font-size: 0.9rem; border: 1px solid var(--input-border); }
    .live-feed-cards-container { position: relative; width: 100%; height: 100%; overflow: hidden; }
    .duel-card-wrapper { position: absolute; top: 50%; transform: translateY(-50%); transition: left 0.8s cubic-bezier(0.2, 0.8, 0.2, 1); width: 40rem; }
    .pos-slot2 { left: 1rem; }
    .pos-slot1 { left: calc(100% - 40rem - 1rem); }
    .pos-enter { left: 100%; }
    .pos-exit { left: -40rem; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
