export default function Home() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Acuity API</h1>
      <p>Backend is running.</p>
      <h2>Endpoints:</h2>
      <ul>
        <li>POST /api/auth/signup</li>
        <li>POST /api/auth/login</li>
        <li>POST /api/analyze</li>
        <li>GET /api/history</li>
        <li>GET /api/tasks</li>
        <li>POST /api/tasks</li>
      </ul>
    </div>
  );
}
