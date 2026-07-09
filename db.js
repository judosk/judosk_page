let _config = null;

async function loadConfig() {
  if (_config) return _config;
  let api = {}, file = {};
  try { const r = await fetch('/api/config'); if (r.ok) api = await r.json(); } catch(e) {}
  try { const r = await fetch('config/git_config.json'); if (r.ok) file = await r.json(); } catch(e) {}
  const apiTok = String(api.github_token || '').trim();
  const fileTok = String(file.github_token || '').trim();
  _config = {
    github_token: (apiTok && apiTok !== 'YOUR_GITHUB_TOKEN') ? apiTok : fileTok,
    github_owner: file.github_owner || '',
    github_repo: file.github_repo || '',
    data_file_path: file.data_file_path || 'data/posts.json',
    admin_password: api.admin_password || file.admin_password || 'admin1234'
  };
  return _config;
}

function isAdmin() {
  return sessionStorage.getItem('isAdmin') === 'true';
}

function requireAdmin() {
  if (!isAdmin()) {
    window.location.href = 'admin.html';
  }
}

function _authHeaders(token) {
  const t = String(token).replace(/\s+/g, '');
  const h = { 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };
  if (t && t !== 'YOUR_GITHUB_TOKEN') h['Authorization'] = 'token ' + t;
  return h;
}

function _decodeContent(b64) {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64.replace(/\n/g, '')))));
  } catch(e) {
    return [];
  }
}

function _encodeContent(data) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
}

async function _fetchFile(config) {
  const url = `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/contents/${config.data_file_path}`;
  const r = await fetch(url, { headers: _authHeaders(config.github_token) });
  if (!r.ok) return { posts: [], sha: null };
  const data = await r.json();
  return { posts: _decodeContent(data.content), sha: data.sha };
}

async function getPosts() {
  try {
    const config = await loadConfig();
    if (!config.github_owner || !config.github_repo) return [];
    const { posts } = await _fetchFile(config);
    return Array.isArray(posts) ? posts.sort((a, b) => new Date(b.date) - new Date(a.date)) : [];
  } catch(e) {
    return [];
  }
}

async function getPost(id) {
  const posts = await getPosts();
  return posts.find(p => String(p.id) === String(id)) || null;
}

async function savePost(post) {
  const config = await loadConfig();
  const token = String(config.github_token).replace(/\s+/g, '');
  if (!token || token === 'YOUR_GITHUB_TOKEN') throw new Error('GitHub 토큰이 설정되지 않았습니다.');
  if (!config.github_owner || !config.github_repo) throw new Error('저장소 정보가 없습니다.');

  const url = `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/contents/${config.data_file_path}`;
  const headers = _authHeaders(token);

  let sha = null, posts = [];
  try {
    const { posts: p, sha: s } = await _fetchFile(config);
    posts = Array.isArray(p) ? p : [];
    sha = s;
  } catch(e) {}

  if (!post.id) {
    post.id = Date.now().toString();
    post.date = new Date().toISOString().split('T')[0];
    posts.unshift(post);
  } else {
    const idx = posts.findIndex(p => String(p.id) === String(post.id));
    if (idx >= 0) posts[idx] = post;
    else posts.unshift(post);
  }

  const body = { message: `feat: save post ${post.id}`, content: _encodeContent(posts) };
  if (sha) body.sha = sha;

  const r = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error('저장 실패: ' + (err.message || r.status));
  }
  return post;
}

async function deletePost(id) {
  const config = await loadConfig();
  const token = String(config.github_token).replace(/\s+/g, '');
  if (!token || token === 'YOUR_GITHUB_TOKEN') throw new Error('GitHub 토큰이 설정되지 않았습니다.');

  const url = `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/contents/${config.data_file_path}`;
  const headers = _authHeaders(token);

  const { posts, sha } = await _fetchFile(config);
  if (!sha) throw new Error('파일 로드 실패');
  const next = posts.filter(p => String(p.id) !== String(id));

  const r = await fetch(url, {
    method: 'PUT', headers,
    body: JSON.stringify({ message: `feat: delete post ${id}`, content: _encodeContent(next), sha })
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error('삭제 실패: ' + (err.message || r.status));
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdown(src) {
  if (!src) return '';

  let html = escapeHtml(src);

  html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
    '<pre style="background:#f4f4f4;border-radius:6px;padding:12px;overflow-x:auto;"><code>' + code.trim() + '</code></pre>'
  );

  const segments = html.split('`');
  html = segments.map((seg, i) => i % 2 === 1 ? '<code style="background:#f0f0f0;padding:1px 4px;border-radius:3px;">' + seg + '</code>' : seg).join('');

  html = html
    .replace(/^###### (.+)$/gm, '<h6 style="font-size:0.875em;font-weight:700;margin:1em 0 0.5em;">$1</h6>')
    .replace(/^##### (.+)$/gm, '<h5 style="font-size:1em;font-weight:700;margin:1em 0 0.5em;">$1</h5>')
    .replace(/^#### (.+)$/gm, '<h4 style="font-size:1.125em;font-weight:700;margin:1em 0 0.5em;">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1.25em;font-weight:700;margin:1em 0 0.5em;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.5em;font-weight:700;margin:1.2em 0 0.6em;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:1.875em;font-weight:700;margin:1.2em 0 0.6em;">$1</h1>');

  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e2e5e9;margin:1.5em 0;">');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|mailto:[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#005bb1;text-decoration:underline;">$1</a>');

  html = html.replace(/^&gt; (.+)$/gm,
    '<blockquote style="border-left:4px solid #005bb1;padding:0.5em 1em;margin:1em 0;background:#edf5ff;color:#414753;">$1</blockquote>');

  html = html.replace(/((?:^- .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(l => '<li>' + l.replace(/^- /, '') + '</li>').join('');
    return '<ul style="list-style:disc;padding-left:1.5em;margin:0.75em 0;">' + items + '</ul>';
  });

  html = html.replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
    const items = match.trim().split('\n').map(l => '<li>' + l.replace(/^\d+\. /, '') + '</li>').join('');
    return '<ol style="list-style:decimal;padding-left:1.5em;margin:0.75em 0;">' + items + '</ol>';
  });

  const blocks = html.split(/\n\n+/);
  html = blocks.map(block => {
    const t = block.trim();
    if (!t) return '';
    if (/^<(h[1-6]|ul|ol|pre|hr|blockquote)/.test(t)) return t;
    return '<p style="margin:0 0 1em;line-height:1.7;">' + t.replace(/\n/g, '<br>') + '</p>';
  }).join('');

  return html;
}

function markdownToText(src) {
  if (!src) return '';
  return src
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/---/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

window.loadConfig = loadConfig;
window.isAdmin = isAdmin;
window.requireAdmin = requireAdmin;
window.getPosts = getPosts;
window.getPost = getPost;
window.savePost = savePost;
window.deletePost = deletePost;
window.renderMarkdown = renderMarkdown;
window.markdownToText = markdownToText;
window.escapeHtml = escapeHtml;
