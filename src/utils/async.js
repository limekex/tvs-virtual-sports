// Async helpers for TVS app
export function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function withTimeout(promise, ms, label = 'operation') {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(label + ' timed out')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
