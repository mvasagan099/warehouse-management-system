/** Current position for the optional GPS check. Never blocks: after 8 seconds, or if the person says no, we carry on without it. */
export function getPosition(timeoutMs = 8000): Promise<{ lat: number; lon: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    const t = setTimeout(() => resolve(null), timeoutMs)
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); resolve({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lon: Math.round(p.coords.longitude * 1e6) / 1e6 }) },
      () => { clearTimeout(t); resolve(null) },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    )
  })
}
