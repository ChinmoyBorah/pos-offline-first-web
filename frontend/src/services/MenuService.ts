export async function initMenu() {
  const ROLE = (import.meta as any).env?.VITE_ROLE || "generic";
  const KEY = `${ROLE}_pos_products`;
  if (localStorage.getItem(KEY)) return;
  try {
    const res = await fetch("http://localhost:5000/menu");
    const data = await res.json();
    
    localStorage.setItem(KEY, JSON.stringify(data.menu));
  } catch (e) {
    console.error(e);
  }
}
