import { ImageResponse } from "next/og";
import { LOGO_DATA_URI, LOGO_BG } from "./logoMark";

// Apple touch icon — the engine-style grid mark, rasterised at build (next/og).
export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: LOGO_BG }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_DATA_URI} width={180} height={180} alt="" />
      </div>
    ),
    { ...size },
  );
}
