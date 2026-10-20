// Page-scoped presentation assets. Original product records and galleries stay intact.
const cutouts: Record<string, string> = {
  "ChatGPT Image Aug 19, 2026, 12_49_16 AM-01M0BDKX27AVCJF69F4JKESFAG.png": "/images/avodat-cutouts/kinot.webp",
  "0033-01KYJFWS6J5XMHG2T9TFE5Q7KD.jpg": "/images/avodat-cutouts/zemirot-soft.webp",
  "0032-01KYJH1Z1RD7F7TBJNB0S4NGXB.jpg": "/images/avodat-cutouts/zemirot.webp",
  "0025-01KYKWKYCAAJH6BREE927ZPNFN.jpg": "/images/avodat-cutouts/siddur.webp",
}

export function getAvodatCutout(source?: string | null): string | undefined {
  if (!source) return
  try {
    const filename = decodeURIComponent(source.split("?")[0].split("/").pop() || "")
    return Object.prototype.hasOwnProperty.call(cutouts, filename) ? cutouts[filename] : undefined
  } catch {
    return undefined
  }
}
