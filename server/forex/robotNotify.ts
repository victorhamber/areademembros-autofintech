export async function postRobotJson(url: string | undefined, body: object): Promise<void> {
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'MembersArea-Licenses/1.0' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000)
    });
  } catch (e) {
    console.error('[robotNotify]', url, e);
  }
}
