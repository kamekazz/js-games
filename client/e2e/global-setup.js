/**
 * Pre-flight check: fail fast if the Django backend isn't running.
 * Playwright calls this before any test file is loaded.
 */
export default async function globalSetup() {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

  try {
    const res = await fetch(`${backendUrl}/api/health/`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      throw new Error(`Backend responded with status ${res.status}`);
    }
  } catch (err) {
    console.error('\n\x1b[31m' + '='.repeat(60));
    console.error('  Backend is not running!');
    console.error('  Start it before running E2E tests:');
    console.error('    docker-compose -f docker-compose.dev.yml up redis django');
    console.error('  Or:');
    console.error('    cd server && python manage.py runserver');
    console.error('='.repeat(60) + '\x1b[0m\n');
    console.error(`  Error: ${err.message}\n`);
    process.exit(1);
  }
}
